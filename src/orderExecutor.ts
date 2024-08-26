import fs from 'fs';
import { ethers } from 'ethers';

import { IORDER, IRates } from './types';
import { CHUNK_SIZE, seedBlock, RESTART_TIMEOUT, MAX_RETRIES, paymentReceiverAddress } from './config';
import { showLastProcessedBlock, showOrders, pushOrders, deleteOrders, incrementOrderRetries, saveLastProcessedBlock } from './state';
import { rpcprovider, signer, createContracts } from './utils';
import { logger } from './logger';

export async function executeOrders() {
    await seedOrders();
    logger.info(`Execute Conditional Orders`);

    const lastProcessedBlockFile: string = "data/lastProcessedBlock.json";

    while (true) {
        try {
            // 1. Fetch Historic Events data and save it.
            const startBlock = showLastProcessedBlock();
            const currentBlock = await rpcprovider.getBlockNumber();

            logger.info(`While Only lastProcessedBlock: ${startBlock}, currentBlock: ${currentBlock}`);

            const { eventsContract } = createContracts();
            await queryHistoricEventsAndSave(startBlock, currentBlock, eventsContract, eventsContract.address);

            saveLastProcessedBlock(currentBlock);

            // 2. Execute the orders
            let orders = showOrders();
            if (orders.length > 0) {
                logger.info(`Total Available Orders: ${orders.length}`);

                const { multicall, accountContract } = createContracts();

                // Find Onchain Price
                const zUSDRates: IRates[] = await accountContract.zUSDRates();
                const zUSDRatesMapping = zUSDRates.reduce((rates, rate) => {
                    rates[rate.marketKey] = rate.price;
                    return rates;
                }, {} as Record<string, ethers.BigNumber>)

                // Match orders
                let validConditionalOrders: Array<IORDER> = orders.filter(order => {
                    // Limit Orders
                    if (order.conditionalOrderType === 0) {
                        return validLimitOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                    }
                    // Stop Loss Orders
                    else {
                        return validStopOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                    }
                })

                logger.info(`Total Valid Orders: ${validConditionalOrders.length}`);

                // Filter out max-retries
                let executableConditionalOrders: Array<IORDER> = validConditionalOrders.filter(order => order.retries < MAX_RETRIES)

                logger.info(`Total Executable Orders: ${executableConditionalOrders.length}`);
                if (executableConditionalOrders.length > 0) {
                    // Create Payload
                    const executeCalls = executableConditionalOrders.slice(0, 50).map(order => {
                        incrementOrderRetries(order.account, order.conditionalOrderId);

                        return {
                            target: order.account,
                            callData: accountContract.interface.encodeFunctionData("executeConditionalOrderWithPaymentReceiver", [order.conditionalOrderId, paymentReceiverAddress]),
                            allowFailure: true,
                        }
                    })

                    // Estimate gas and gasprice
                    const gasLimit = await multicall.estimateGas.aggregate3(executeCalls);
                    const gasPrice = await rpcprovider.getGasPrice();                    
                    
                    logger.info(`GasLimit: ${gasLimit.toString()}, GasPrice: ${gasPrice.toString()}`);

                    const tx = await multicall.connect(signer).aggregate3(executeCalls, {
                        gasLimit: gasLimit.mul(6).div(5),
                        gasPrice: gasPrice.mul(6).div(5),
                    });
                    await tx.wait(2);
                    logger.info(`Order Filled Tx: ${tx.hash}`)
                    // return {
                    //     canExec: true,
                    //     callData: [
                    //         {
                    //             to: multicall.address,
                    //             data: multicall.interface.encodeFunctionData("aggregate3", [executeCalls]),
                    //         },
                    //     ],
                    // };
                }
                else {
                    logger.info("No Valid Orders Found Continuing ....");
                    await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                    continue;
                }

            } else {
                logger.info("No Conditional Orders Found Restarting.....");
                // No task available, wait a bit before retrying, Ideally for bsc it's 3 seconds
                await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            }
        }
        catch (error) {
            logger.error(`error ${error as Error}`);
            await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            continue;
        }
    }
}


export const seedOrders = async () => {
    logger.info(`Seed Conditional Orders`);

    let lastProcessedBlock: number = 0;
    lastProcessedBlock = showLastProcessedBlock();

    // 1. Fetch Historic Events data and save it.
    const currentBlock = await rpcprovider.getBlockNumber();
    logger.info(`Seed Only lastProcessedBlock: ${lastProcessedBlock}, currentBlock: ${currentBlock}`);

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

    saveLastProcessedBlock(currentBlock);
}

const queryHistoricEventsAndSave = async (lastProcessedBlock: number, currentBlock: number, contract: ethers.Contract, contractAddress: string) => {
    try {
        let fromBlock = lastProcessedBlock + 1;
        while (fromBlock <= currentBlock) {
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
                    logger.error(`Error fetching events, attempts left: ${attempts}, Error: ${error}`);
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

                    logger.info(`ConditionalOrderPlaced: Account: ${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                } else if (eventName === "ConditionalOrderCancelled" || eventName === "ConditionalOrderFilled") {
                    const account = args?.[0];
                    const conditionalOrderId = args?.[1].toNumber();
                    deleteOrders(account, conditionalOrderId)
                    logger.info(`${eventName === "ConditionalOrderCancelled" ? "ConditionalOrderCancelled" : "ConditionalOrderFilled"}: Account:${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                }
            }

            // Update the lastProcessedBlock for this chunk
            lastProcessedBlock = toBlock;
            // Move to the next chunk
            fromBlock = toBlock + 1;
        }

    } catch (error) {
        logger.error("Error in queryHistoricEvents:", error);
    }
};

const validLimitOrder = (oraclePrice: ethers.BigNumber | undefined, targetPrice: ethers.BigNumber, long: boolean): boolean => {
    if (oraclePrice === undefined) {
        return false;
    }
    if (long) return oraclePrice.lte(targetPrice);
    return oraclePrice.gte(targetPrice);
}

const validStopOrder = (oraclePrice: ethers.BigNumber | undefined, targetPrice: ethers.BigNumber, long: boolean): boolean => {
    if (oraclePrice === undefined) {
        return false;
    }
    if (long) return oraclePrice.gte(targetPrice);
    return oraclePrice.lte(targetPrice);
}
