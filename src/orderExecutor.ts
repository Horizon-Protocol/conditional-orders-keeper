import fs from 'fs';
import { ethers } from 'ethers';
import { showOrders, pushOrders, deleteOrders } from './state';
import { rpcprovider, signer, createContracts } from './utils';
import { logger } from './logger';

interface IORDER {
    account: string;
    conditionalOrderId: number;
    marketKey: string;
    long: boolean;
    targetPrice: ethers.BigNumber;
    conditionalOrderType: number
}

interface IRates {
    marketKey: string;
    price: ethers.BigNumber;
    priceOracle: number;
}

export async function executeOrders() {

    while (true) {
        // logger.info("Event Listener Started");

        // Update the current block to avoid seeding data at restart
        const currentBlock = await rpcprovider.getBlockNumber();

        fs.writeFileSync("data/lastProcessedBlock.json", `lastProcessedBlock: ${currentBlock}`);


        let orders = showOrders();
        if (orders.length > 0) {

            const { multicall, accountContract } = createContracts();

            // Find Onchain Price
            const zUSDRates: IRates[] = await accountContract.zUSDRates();
            const zUSDRatesMapping = zUSDRates.reduce((rates, rate) => {
                rates[rate.marketKey] = rate.price;
                return rates;
            }, {} as Record<string, ethers.BigNumber>)

            // Match orders
            let validConditionalOrders: Array<IORDER> = orders.filter(order => {
                // Limit Orders
                if (order.conditionalOrderType === 0) {
                    return validLimitOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                }
                // Stop Loss Orders
                else {
                    return validStopOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                }
            })

            console.log("Total Orders to be Executed: ", validConditionalOrders.length);
            if (validConditionalOrders.length > 0) {
                // Create Payload
                const executeCalls = validConditionalOrders.slice(0, 50).map(order => {
                    // console.log("OrderReady", order.account, order.conditionalOrderId, order.long, order.targetPrice, order.conditionalOrderType)

                    return {
                        target: order.account,
                        callData: accountContract.interface.encodeFunctionData("executeConditionalOrderWithPaymentReceiver", [order.conditionalOrderId, "0x3a10A18Ca6d9378010D446068d2Fd4dE5D272915"]),
                        allowFailure: true,
                    }
                })

                const tx = await multicall.connect(signer).aggregate3(executeCalls);
                await tx.wait(1);
                // return {
                //     canExec: true,
                //     callData: [
                //         {
                //             to: multicall.address,
                //             data: multicall.interface.encodeFunctionData("aggregate3", [executeCalls]),
                //         },
                //     ],
                // };
            }
            else continue;

        } else {
            logger.info("executeOrders ReStarted");
            // No task available, wait a bit before retrying, Ideally for bsc it's 3 seconds
            await new Promise(res => setTimeout(res, 3000));
        }
    }
}

const validLimitOrder = (oraclePrice: ethers.BigNumber | undefined, targetPrice: ethers.BigNumber, long: boolean): boolean => {
    if (oraclePrice === undefined) {
        return false;
    }
    if (long) {
        return oraclePrice.lte(targetPrice);
    }
    return oraclePrice.gte(targetPrice);
}

const validStopOrder = (oraclePrice: ethers.BigNumber | undefined, targetPrice: ethers.BigNumber, long: boolean): boolean => {
    if (oraclePrice === undefined) {
        return false;
    }
    if (long) return oraclePrice.gte(targetPrice);
    return oraclePrice.lte(targetPrice);
}