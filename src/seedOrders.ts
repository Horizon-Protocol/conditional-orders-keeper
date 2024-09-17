import { ethers } from 'ethers';
import chalk from 'chalk';

import { CHUNK_SIZE, seedBlock, RESTART_TIMEOUT } from './config';
import { showLastProcessedBlock, showCurrentOrders, pushOrders, deleteOrders, saveLastProcessedBlock } from './state';
import { rpcprovider, createContracts, sendTG } from './utils';
import { makeLogger } from './logger';

const seedKeeperLogger = makeLogger('SEEDING', chalk.cyanBright);

export async function seedAndQueryForOrders() {
    seedKeeperLogger.info(`SEEDING: STARTED`);
    await seedOrders();
    seedKeeperLogger.info(`SEEDING: COMPLETE`);
    seedKeeperLogger.info(`QUERYING: STARTED`);

    while (true) {
        try {
            // throw new Error("DUMMY ERROR");
            
            // 1. Fetch Historic Events data and save it.
            const startBlock = showLastProcessedBlock();
            const currentBlock = await rpcprovider.getBlockNumber();

            // seedKeeperLogger.info(`QUERYING STARTED: lastProcessedBlock: ${startBlock}, currentBlock: ${currentBlock}`);
            
            const { eventsContract } = createContracts();
            await queryHistoricEventsAndSave(startBlock, currentBlock, eventsContract, eventsContract.address);
            
            saveLastProcessedBlock(currentBlock);
            // seedKeeperLogger.info(`QUERYING COMPLETE: lastProcessedBlock: ${startBlock}, currentBlock: ${currentBlock}`);
        } catch (error) {
            seedKeeperLogger.error(`QUERYING: error ${error as Error}`);
            await sendTG(`QUERYING: error ${error as Error}`);
            await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            continue;
        }
    }
}
export const seedOrders = async () => {
    try {
        seedKeeperLogger.info(`Seed Conditional Orders`);
    
        let lastProcessedBlock: number = 0;
        lastProcessedBlock = showLastProcessedBlock();
    
        // 1. Fetch Historic Events data and save it.
        const currentBlock = await rpcprovider.getBlockNumber();
        seedKeeperLogger.info(`Seed Only lastProcessedBlock: ${lastProcessedBlock}, currentBlock: ${currentBlock}`);
    
        let startBlock: number = 0;
        if ((lastProcessedBlock === 0 || lastProcessedBlock == undefined)) {
            startBlock = seedBlock;
        }
        else {
            startBlock = lastProcessedBlock;
            // initializeOrders(JSON.parse(fs.readFileSync(ordersToFullfillFile, 'utf-8')));
        }
    
        const { eventsContract } = createContracts();
        await queryHistoricEventsAndSave(startBlock, currentBlock, eventsContract, eventsContract.address);

        console.log('Reaching HERE 2')
    
        saveLastProcessedBlock(currentBlock);
    } catch (error) {
        seedKeeperLogger.error(`SEEDING: error ${error as Error}`);
        await sendTG(`SEEDING: error ${error as Error}`);
    }
}

const queryHistoricEventsAndSave = async (lastProcessedBlock: number, currentBlock: number, contract: ethers.Contract, contractAddress: string) => {
    try {
        let fromBlock = lastProcessedBlock + 1;
        while (fromBlock <= currentBlock) {
            // throw new Error("DUMMY ERROR");

            const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
            // console.log(`Fetching events from: ${fromBlock}, to:${toBlock}`);

            // Retry mechanism for transient errors
            let events: ethers.Event[] = [];
            let attempts = 3;
            while (attempts > 0) {
                try {
                    // Query past logs for the current chunk
                    events = await contract.queryFilter({ address: contractAddress }, fromBlock, toBlock);
                    break; // Exit loop if successful
                } catch (error) {
                    seedKeeperLogger.error(`Error fetching events, attempts left: ${attempts}, Error: ${error}`);
                    attempts--;
                    if (attempts === 0) {
                        throw new Error(`Failed to fetch events after multiple attempts.`);
                    }
                    // Implement a delay before retrying (exponential backoff)
                    await new Promise(res => setTimeout(res, 1000));
                    // await new Promise(res => setTimeout(res, 1000 * (4 - attempts)));
                }
            }

            for (const event of events) {
                const { event: eventName, args, transactionHash, blockNumber } = event;
                if (!args) continue; // Skip events without arguments

                if (eventName === "ConditionalOrderPlaced") {
                    const account = args?.[0];
                    const conditionalOrderId = args?.[1].toNumber();
                    const marketKey = args?.[3];
                    const sizeDelta = ethers.utils.formatEther(args?.[5]);
                    const targetPrice = args?.[6];
                    const conditionalOrderType = args?.[7];

                    pushOrders(
                        account,
                        conditionalOrderId,
                        marketKey,
                        Number(sizeDelta) > 0 ? true : false,
                        targetPrice,
                        Number(conditionalOrderType),
                        transactionHash,
                        blockNumber
                    );

                    seedKeeperLogger.info(`ConditionalOrderPlaced: Account: ${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                } else if (eventName === "ConditionalOrderCancelled" || eventName === "ConditionalOrderFilled") {
                    const account = args?.[0];
                    const conditionalOrderId = args?.[1].toNumber();
                    deleteOrders(account, conditionalOrderId)
                    seedKeeperLogger.info(`${eventName === "ConditionalOrderCancelled" ? "ConditionalOrderCancelled" : "ConditionalOrderFilled"}: Account:${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                }
            }

            // Update the lastProcessedBlock for this chunk
            lastProcessedBlock = toBlock;
            // Move to the next chunk
            fromBlock = toBlock + 1;
        }

    } catch (error) {
        seedKeeperLogger.error("Error in queryHistoricEvents:", error);
    }
};