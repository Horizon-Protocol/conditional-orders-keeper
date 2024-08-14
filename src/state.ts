require('dotenv').config();
import { ethers } from "ethers";


interface IORDER {
    account: string;
    conditionalOrderId: number;
    marketKey: string;
    long: boolean;
    targetPrice: ethers.BigNumber;
    conditionalOrderType: number
}

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
    conditionalOrderType: number
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
}

export function deleteOrders(
    account: string,
    conditionalOrderId: number
) {
    orders = orders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));
}