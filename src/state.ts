import fs from 'fs';
import { ethers } from "ethers";
import { IORDER } from './types';

// Shared Array to store event data
// let ordersMemory: Array<IORDER> = [];

const lastProcessedBlockFile: string = "data/lastProcessedBlock.json";
const ordersToFullfillFile: string = "data/ordersToFullfill.json";


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

const saveOrders = (data: IORDER[]): void => {
    fs.writeFileSync(ordersToFullfillFile, JSON.stringify(data, null, 2), "utf8");
};

// export function initializeOrders(initialOrders: Array<IORDER>) {
//     console.log("Initial Orders", initialOrders);
//     orders = initialOrders;
// }

// export function showOrders() {
//     return orders;
// }

// Function to read data from the JSON file
export const showOrders = (): IORDER[] => {
    if (fs.existsSync(ordersToFullfillFile)) {
        const fileContent = fs.readFileSync(ordersToFullfillFile, "utf8");
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
    let orders: Array<IORDER> = showOrders();

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
            transactionHash,
            blockNumber,
            retries: 0
        });
    }

    saveOrders(orders);
}

export function deleteOrders(
    account: string,
    conditionalOrderId: number,
) {
    let orders: Array<IORDER> = showOrders();
    orders = orders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));
    saveOrders(orders);
}

export function incrementOrderRetries(
    account: string,
    conditionalOrderId: number,
) {
    const orders: Array<IORDER> = showOrders();

    // Increment retries for the matching order
    let incrementedorders: Array<IORDER> = orders.map(order => {
        if (order.account === account && order.conditionalOrderId === conditionalOrderId) {
            return { ...order, retries: order.retries + 1 };
        }
        return order;
    });

    // Write updated orders back to the JSON file
    saveOrders(incrementedorders);
}