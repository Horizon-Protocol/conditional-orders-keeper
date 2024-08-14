import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();  // Load environment variables from .env file 

import { ethers } from 'ethers';
import { WebSocketProvider } from './customWebsocket';
import { ABI } from './constants';
import { logger } from './logger';

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

export const checkForSeeding = async (): Promise<boolean> => {
    const lastProcessedBlockFile: string = "data/lastProcessedBlock.json";

    let lastProcessedBlock: number = 0;
    if (fs.existsSync(lastProcessedBlockFile)) {
        lastProcessedBlock = JSON.parse(fs.readFileSync(lastProcessedBlockFile, 'utf-8'));
    }

    logger.info(`lastProcessedBlock: ${lastProcessedBlock}`);
    
    // Update the current block to avoid seeding data at restart
    const currentBlock = await rpcprovider.getBlockNumber();
    logger.info(`currentBlock: ${currentBlock}`);

    // Seeding required
    if (lastProcessedBlock === 0 || lastProcessedBlock <= seedBlock || lastProcessedBlock <= currentBlock) return true;

    return false;
}