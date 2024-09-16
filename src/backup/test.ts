// import fs from 'fs';
// import { ethers } from 'ethers';

import { IORDER, IRates, STATIC_CALL_ERROR } from '../types';
// import { CHUNK_SIZE, seedBlock, RESTART_TIMEOUT, MAX_RETRIES, paymentReceiverAddress } from './config';
// import { showLastProcessedBlock, showOrders, pushOrders, deleteOrders, incrementOrderRetries, saveLastProcessedBlock } from './state';
// import { logger } from './logger';

import { ethers } from 'ethers';
import { rpcprovider, signer, createContracts } from '../utils';

export const ABI = [
    'function transfer(address to, uint256 amount)',
];

const first = async () => {
    // Instead of sending txn simulate them individually
    const { multicall, accountContract } = createContracts();

    type CallStaticERROR = {
        errorArgs: Array<string>;
    }

    type StaticCallResult = {
        success: boolean,
        returnData: string,
    }

    // type StaticCallResult = [boolean, string, { success: boolean; returnData: string }];


    try {
        // const staticCall = await accountContract.attach('0xBB947227A0998Fb76C911e4224DC3A19f9Bc488a').connect(signer).callStatic.executeConditionalOrderWithPaymentReceiver('1', '0x3a10A18Ca6d9378010D446068d2Fd4dE5D272915');
        // console.log('staticCall', staticCall);


        const contract = new ethers.Contract('0x33da318E0D034f65Dc11F095E58EFd987b71428d', ABI)


        const calls = [
            {
                target: contract.address,
                callData: contract.interface.encodeFunctionData("transfer", ['0x0b56a002f55EF92c75c1b73011D0c4b427E9161D', ethers.utils.parseEther('20')]),
                allowFailure: true,
            },
            {
                target: contract.address,
                callData: contract.interface.encodeFunctionData("transfer", ['0x852AD4Eee1679CD64057F50480b3A7c6e89955f6', ethers.utils.parseEther('0.1')]),
                allowFailure: true,
            },
            {
                target: contract.address,
                callData: contract.interface.encodeFunctionData("transfer", ['0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7', ethers.utils.parseEther('15')]),
                allowFailure: true,
            },
            {
                target: contract.address,
                callData: contract.interface.encodeFunctionData("transfer", ['0xB0E41d1b92319B2340A7bF10D85758175Df4D05c', ethers.utils.parseEther('0.2')]),
                allowFailure: true,
            },
        ]

        const staticCall: StaticCallResult[] = await multicall.connect(signer).callStatic.aggregate3(calls);
        console.log('staticCall', staticCall);

        // const staticCall = await contract.connect(signer).callStatic.transfer('0x852AD4Eee1679CD64057F50480b3A7c6e89955f6', ethers.utils.parseEther('0.0001'))
        // console.log('staticCall', staticCall);

        if (staticCall) {
            console.log('staticCall 2', staticCall[1].returnData);
            // const tx = await multicall.connect(signer).aggregate3(calls);
            // await tx.wait(1);
            // console.log('tx Hash', tx.hash);

        }


    } catch (error) {
        console.log('staticCall error\n', error);
        const errorMessage = (error as CallStaticERROR).errorArgs;
        console.log('staticCall error\n', errorMessage[0]);
    }
}

// first()

first()


// [
//     [
//         false,
//         '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002f496e73756666696369656e742062616c616e636520616674657220616e7920736574746c656d656e74206f77696e670000000000000000000000000000000000',
//         success: false,
//         returnData: '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002f496e73756666696369656e742062616c616e636520616674657220616e7920736574746c656d656e74206f77696e670000000000000000000000000000000000'
//     ],
//     [
//         true,
//         '0x0000000000000000000000000000000000000000000000000000000000000001',
//         success: true,
//         returnData: '0x0000000000000000000000000000000000000000000000000000000000000001'
//     ],
//     [
//         false,
//         '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002f496e73756666696369656e742062616c616e636520616674657220616e7920736574746c656d656e74206f77696e670000000000000000000000000000000000',
//         success: false,
//         returnData: '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002f496e73756666696369656e742062616c616e636520616674657220616e7920736574746c656d656e74206f77696e670000000000000000000000000000000000'
//     ],
// ]