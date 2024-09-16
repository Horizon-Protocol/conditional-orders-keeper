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

export type STATIC_CALL_ERROR = {
    errorArgs: Array<string>;
}

export type STATIC_CALL_RESULT = {
    success: boolean,
    returnData: string,
}