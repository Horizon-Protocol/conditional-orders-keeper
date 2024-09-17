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

export const validLimitOrder = (oraclePrice: ethers.BigNumber | undefined, targetPrice: ethers.BigNumber, long: boolean): boolean => {
    if (oraclePrice === undefined) {
        return false;
    }
    if (long) return oraclePrice.lte(targetPrice);
    return oraclePrice.gte(targetPrice);
}

export const validStopOrder = (oraclePrice: ethers.BigNumber | undefined, targetPrice: ethers.BigNumber, long: boolean): boolean => {
    if (oraclePrice === undefined) {
        return false;
    }
    if (long) return oraclePrice.gte(targetPrice);
    return oraclePrice.lte(targetPrice);
}

export const sendTG = async (text: string) => {
    console.log("Sending TG Message", text);
    const headers = { "Accept-Encoding": "zh-CN,zh;q=0.9", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36" };
    // const teleURL = `https://api.telegram.org/bot7086089934:AAG9k8WK1X_Ozjq3gMbQFRoPrXKjA_zdsH4/sendMessage?chat_id=-1002487098460-4599771883&text=${text}`
    const teleURL = `https://api.telegram.org/bot7086089934:AAG9k8WK1X_Ozjq3gMbQFRoPrXKjA_zdsH4/sendMessage?chat_id=-1002487098460&text=${text}`
    // 5303409425:AAEtJSpaMsN0L3Eg_23pVBwqPVymbLDFynk/


    const response = await fetch(teleURL, {
        method: 'GET',
        headers: headers
    })
    // const data = await response.json();
    // console.log('data', data);
}