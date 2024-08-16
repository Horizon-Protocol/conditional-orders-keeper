import fs from 'fs';
import { ethers } from "ethers";
import { IORDER } from './types';

// Shared Array to store event data
let orders: Array<IORDER> = [];

export function initializeOrders(initialOrders: Array<IORDER>) {
    console.log("Initial Orders", initialOrders);
    orders = initialOrders;
}

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
    
    fs.writeFileSync("data/ordersToFullfill.json", JSON.stringify(orders));
}

export function deleteOrders(
    account: string,
    conditionalOrderId: number,
) {
    orders = orders.filter(order => !(order.account === account && order.conditionalOrderId === conditionalOrderId));
    fs.writeFileSync("data/ordersToFullfill.json", JSON.stringify(orders));
}