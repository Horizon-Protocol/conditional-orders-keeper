import fs from 'fs';
import { ethers } from "ethers";
import { IORDER } from './types';

// Shared Array to store event data
let orders: Array<IORDER> = [];

// To remove duplicate events
let processedEvents = new Set();

export function showOrders() {
    return orders;
}

export function pushOrders(
    account: string,
    conditionalOrderId: number,
    marketKey: string,
    long: boolean,
    targetPrice: ethers.BigNumber,
    conditionalOrderType: number,
) {
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
            conditionalOrderType: conditionalOrderType
        });
    }

    if (account === '0xDf3F08bE7d1C63871975a34EacCdd180381F1993' && conditionalOrderId === 16) {
        console.log("****************************************")
    }
    
    fs.writeFileSync("data/ordersToFullfill.json", JSON.stringify(orders));
}

export function deleteOrders(
    account: string,
    conditionalOrderId: number,
) {
    if (account === '0xDf3F08bE7d1C63871975a34EacCdd180381F1993' && conditionalOrderId === 16) {
        console.log("****************************************")
    }
    orders = orders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));
    fs.writeFileSync("data/ordersToFullfill.json", JSON.stringify(orders));
}