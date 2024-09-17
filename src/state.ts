import fs from 'fs';
import { ethers } from "ethers";
import { IORDER } from './types';

import { etherscanUrl, network, MAX_RETRIES, ERROR_MAX_RETRIES } from './config'
import { sendTG } from './utils'

// Shared Array to store event data
// let ordersMemory: Array<IORDER> = [];

const lastProcessedBlockFile: string = `data/${network}/lastProcessedBlock.json`;
const currentOrdersFile: string = `data/${network}/currentOrders.json`;
const failedOrdersFile: string = `data/${network}/failedOrders.json`;
const droppedOrdersFile: string = `data/${network}/droppedOrders.json`;


export const showLastProcessedBlock = (): number => {
    if (fs.existsSync(lastProcessedBlockFile)) {
        const fileContent = fs.readFileSync(lastProcessedBlockFile, "utf8");
        return JSON.parse(fileContent) as number;
    }
    return 0;
}

export const saveLastProcessedBlock = (blockNumber: number) => {
    fs.writeFileSync(lastProcessedBlockFile, JSON.stringify(blockNumber, null, 2), "utf8");
}

const saveCurrentOrders = (data: IORDER[]): void => {
    fs.writeFileSync(currentOrdersFile, JSON.stringify(data, null, 2), "utf8");
};

const saveFailedOrders = (data: IORDER[]): void => {
    fs.writeFileSync(failedOrdersFile, JSON.stringify(data, null, 2), "utf8");
};

const saveDroppedOrders = (data: IORDER[]): void => {
    fs.writeFileSync(droppedOrdersFile, JSON.stringify(data, null, 2), "utf8");
};

// export function initializeOrders(initialOrders: Array<IORDER>) {
//     console.log("Initial Orders", initialOrders);
//     orders = initialOrders;
// }

// export function showOrders() {
//     return orders;
// }

// Function to read data from the JSON file
export const showCurrentOrders = (): IORDER[] => {
    if (fs.existsSync(currentOrdersFile)) {
        const fileContent = fs.readFileSync(currentOrdersFile, "utf8");
        return JSON.parse(fileContent);
    }
    return [];
};

export const showFailedOrders = (): IORDER[] => {
    if (fs.existsSync(failedOrdersFile)) {
        const fileContent = fs.readFileSync(failedOrdersFile, "utf8");
        return JSON.parse(fileContent);
    }
    return [];
};

export const showDroppedOrders = (): IORDER[] => {
    if (fs.existsSync(droppedOrdersFile)) {
        const fileContent = fs.readFileSync(droppedOrdersFile, "utf8");
        return JSON.parse(fileContent);
    }
    return [];
};

export function pushOrders(
    account: string,
    conditionalOrderId: number,
    marketKey: string,
    long: boolean,
    targetPrice: ethers.BigNumber,
    conditionalOrderType: number,
    transactionHash: string,
    blockNumber: number
) {
    let orders: Array<IORDER> = showCurrentOrders();

    // Check for duplicate orders
    const orderExists = orders.some(order =>
        order.account === account && order.conditionalOrderId === conditionalOrderId
    );

    if (!orderExists) {
        orders.push({
            account,
            conditionalOrderId: conditionalOrderId,
            marketKey,
            long: long,
            targetPrice: targetPrice,
            conditionalOrderType: conditionalOrderType,
            transactionHash: etherscanUrl + '/tx/' + transactionHash,
            blockNumber,
            retries: 0
        });
    }

    saveCurrentOrders(orders);
}

export function deleteOrders(
    account: string,
    conditionalOrderId: number,
) {
    let currentOrders: Array<IORDER> = showCurrentOrders();
    let failedOrders: Array<IORDER> = showFailedOrders();

    // Find the order in currentOrders else find failedOrders. Order always stays in one place.
    let order = currentOrders.find(order => (order.account === account && order.conditionalOrderId === conditionalOrderId));
    if (order) {
        // Remove from currentOrders
        currentOrders = currentOrders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));
        saveCurrentOrders(currentOrders);
    }
    else {
        failedOrders = failedOrders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));
        saveFailedOrders(failedOrders);
    }
}

export function incrementOrderRetries(
    account: string,
    conditionalOrderId: number,
    retriesCounter: number
) {
    let currentOrders: Array<IORDER> = showCurrentOrders();
    let failedOrders: Array<IORDER> = showFailedOrders();

    if (retriesCounter < MAX_RETRIES) {
        // Increment retries for the matching order
        let incrementedorders: Array<IORDER> = currentOrders.map(order => {
            if (order.account === account && order.conditionalOrderId === conditionalOrderId) {
                return { ...order, retries: retriesCounter };
            }
            return order;
        });

        // Write updated orders back to the JSON file
        saveCurrentOrders(incrementedorders);
    }
    else if (retriesCounter === MAX_RETRIES) {
        // Find the order in currentOrders and move it to failedOrders
        let order = currentOrders.find(order => (order.conditionalOrderId === conditionalOrderId && order.account === account));
        if (order) {
            // Remove from currentOrders
            currentOrders = currentOrders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));

            order.retries = retriesCounter;

            // Push to failedorders
            failedOrders.push(order);

            saveCurrentOrders(currentOrders);
            saveFailedOrders(failedOrders);
        }
        else {
            console.error(`Order ${account}-${conditionalOrderId} should exist in currentOrders but was not found.`);
            return;
        }
    }
    else {
        if (retriesCounter === ERROR_MAX_RETRIES) {
            let droppedOrders: Array<IORDER> = showDroppedOrders();

            // Find the order in failedOrders and move it to droppedOrders
            let order = failedOrders.find(order => (order.conditionalOrderId === conditionalOrderId && order.account === account));
            if (order) {
                // Remove from failedOrders
                failedOrders = failedOrders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));

                order.retries = retriesCounter;

                // Push to droppedorders
                droppedOrders.push(order);

                saveFailedOrders(failedOrders);
                saveDroppedOrders(droppedOrders);
                
                sendTG(`STATE: Order ${account}-${conditionalOrderId} should dropped.`);
                return;
            }
            else {
                console.error(`Order ${account}-${conditionalOrderId} should exist in failedOrders but was not found.`);
                sendTG(`STATE: Order ${account}-${conditionalOrderId} should exist in failedOrders but was not found.`);
                return;
            }
        }

        // Increment retries for the matching order
        let incrementedorders: Array<IORDER> = failedOrders.map(order => {
            if (order.account === account && order.conditionalOrderId === conditionalOrderId) {
                return { ...order, retries: retriesCounter };
            }
            return order;
        });

        // Write updated orders back to the JSON file
        saveFailedOrders(incrementedorders);
    }
}