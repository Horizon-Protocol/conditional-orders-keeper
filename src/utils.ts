import dotenv from 'dotenv';
dotenv.config();  // Load environment variables from .env file 

import { ethers } from 'ethers';
import { WebSocketProvider } from './customWebsocket';
import { ABI } from './constants';

import {
    wss,
    rpc,
    signerPrivateKey,
    eventsContractAddress,
    accountContractAddress,
    multicallAddress
} from './config';


// Ethers Provider and Signer
const wsprovider1 = new WebSocketProvider(wss);
export const rpcprovider = new ethers.providers.JsonRpcProvider(rpc);
const wallet = new ethers.Wallet(signerPrivateKey);
export const signer = wallet.connect(rpcprovider);

export const createContracts = () => {
    const eventsContract = new ethers.Contract(eventsContractAddress, ABI, wsprovider1);
    const multicall = new ethers.Contract(multicallAddress, ABI, rpcprovider);
    const accountContract = new ethers.Contract(accountContractAddress, ABI, rpcprovider);

    return { eventsContract, multicall, accountContract };
}