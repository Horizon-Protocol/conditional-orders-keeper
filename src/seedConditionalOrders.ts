import fs from 'fs';
import { ethers } from "ethers";

import { createContracts } from './utils';
import { CHUNK_SIZE } from './config';
import { pushOrders, deleteOrders } from './state';
import { IORDER } from './types';

export const seedOrdersFromBlock = async (seedBlock: number, currentBlock: number) => {
    console.log('seedOrdersFromBlock', seedBlock, currentBlock);

    const { eventsContract } = createContracts();

    let updatedOrders = await queryHistoricEvents(seedBlock, currentBlock, eventsContract, eventsContract.address)
}


