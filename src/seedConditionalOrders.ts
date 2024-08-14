import fs from 'fs';
import { ethers } from "ethers";

import { createContracts } from './utils';
import { CHUNK_SIZE } from './config';
import { pushOrders, deleteOrders } from './state';
import { IORDER } from './types';

export const seedOrdersFromBlock = async (seedBlock: number, currentBlock: number) => {
    console.log('seedOrdersFromBlock', seedBlock, currentBlock);

    let ordersToFullfill: IORDER[] = [];

    const { eventsContract } = createContracts();

    let updatedOrders = await checkNewEventsAndUpdateEventsData(seedBlock, currentBlock, eventsContract, eventsContract.address, ordersToFullfill)

    // const ordersToFullfill    fs.readFileSync('data/ordersToFullfill.json', JSON.stringify(updatedOrders));

    // fs.writeFileSync("data/ordersToFullfill.txt", JSON.stringify(JSON.stringify(updatedOrders)));
    console.log('currentBlock', currentBlock);
}

const checkNewEventsAndUpdateEventsData = async (lastProcessedBlock: number, currentBlock: number, contract: ethers.Contract, contractAddress: string, orders: IORDER[]): Promise<IORDER[]> => {
    try {
        let fromBlock = lastProcessedBlock + 1;

        while (fromBlock <= currentBlock) {
            const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
            console.log(`Fetching events from: ${fromBlock}, to:${toBlock}`);

            // Retry mechanism for transient errors
            let events: ethers.Event[] = [];
            let attempts = 3;
            while (attempts > 0) {
                try {
                    // Query past logs for the current chunk
                    events = await contract.queryFilter({ address: contractAddress }, fromBlock, toBlock);
                    break; // Exit loop if successful
                } catch (error) {
                    console.error(`Error fetching events, attempts left: ${attempts}, Error: ${error}`);
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
                    );

                    console.log(`ConditionalOrderPlaced: Account: ${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                } else if (eventName === "ConditionalOrderCancelled" || eventName === "ConditionalOrderFilled") {
                    const account = args?.[0];
                    const conditionalOrderId = args?.[1].toNumber();
                    deleteOrders(account, conditionalOrderId)
                    console.log(`${eventName === "ConditionalOrderCancelled" ? "ConditionalOrderCancelled" : "ConditionalOrderFilled"}: Account:${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                }
            }

            // Update the lastProcessedBlock for this chunk
            lastProcessedBlock = toBlock;
            // Move to the next chunk
            fromBlock = toBlock + 1;
        }

        return orders;
    } catch (error) {
        console.error("Error in checkNewEventsAndUpdateEventsData:", error);
        return orders;
    }
};
