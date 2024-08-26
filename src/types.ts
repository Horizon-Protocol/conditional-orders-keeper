import { ethers } from 'ethers';

export type IORDER = {
    account: string;
    conditionalOrderId: number;
    marketKey: string;
    long: boolean;
    targetPrice: ethers.BigNumber;
    conditionalOrderType: number;
    retries: number;
    transactionHash: string;
    blockNumber: number;
}

export type IRates  = {
    marketKey: string;
    price: ethers.BigNumber;
    priceOracle: number;
}