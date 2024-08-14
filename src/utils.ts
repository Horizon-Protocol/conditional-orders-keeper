import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();  // Load environment variables from .env file 

import { ethers } from 'ethers';
import { WebSocketProvider } from './customWebsocket';
import { ABI } from './constants';
import { logger } from './logger';
import { seedOrdersFromBlock } from "./seedConditionalOrders";

import {
    rpc,
    seedBlock,
    signerPrivateKey,
    eventsContractAddress,
    accountContractAddress,
    multicallAddress
} from './config';


// Ethers Provider and Signer
const wsprovider1 = new WebSocketProvider(rpc!.replace(/https/, 'wss'));
export const rpcprovider = new ethers.providers.JsonRpcProvider(
    process.env.RPC1
);
const wallet = new ethers.Wallet(signerPrivateKey!);
export const signer = wallet.connect(rpcprovider);


export const createContracts = () => {
    const eventsContract = new ethers.Contract(eventsContractAddress, ABI, wsprovider1);
    const multicall = new ethers.Contract(multicallAddress, ABI, rpcprovider);
    const accountContract = new ethers.Contract(accountContractAddress, ABI, rpcprovider);

    return { eventsContract, multicall, accountContract };
}

export const seedOrders = async () => {
    const currentBlock = await rpcprovider.getBlockNumber();
    
    const lastProcessedBlockFile: string = "data/lastProcessedBlock.json";
    let lastProcessedBlock: number = 0;
    if (fs.existsSync(lastProcessedBlockFile)) {
        lastProcessedBlock = JSON.parse(fs.readFileSync(lastProcessedBlockFile, 'utf-8'));
    }

    logger.info(`lastProcessedBlock: ${lastProcessedBlock}, currentBlock: ${currentBlock}`);

    if (lastProcessedBlock === 0 || lastProcessedBlock == undefined) {
        console.log('No seeded Data found');

        await seedOrdersFromBlock(seedBlock, currentBlock);
    }
    else await seedOrdersFromBlock(lastProcessedBlock, currentBlock);
}