import { ethers } from 'ethers';
import chalk from 'chalk';

import { IORDER, IRates, STATIC_CALL_RESULT } from './types';
import { CHUNK_SIZE, seedBlock, RESTART_TIMEOUT, MAX_RETRIES, paymentReceiverAddress } from './config';
import { showLastProcessedBlock, showCurrentOrders, pushOrders, deleteOrders, incrementOrderRetries, saveLastProcessedBlock } from './state';
import { rpcprovider, signer, createContracts, validLimitOrder, validStopOrder, sendTG } from './utils';
import { makeLogger } from './logger';

const MULTICALL_PAGE_SIZE = 10;
const mainKeeperLogger = makeLogger('MAIN_KEEPER', chalk.magentaBright);

export async function executeOrders() {
    mainKeeperLogger.info(`MAIN_KEEPER: STARTED`);
    while (true) {
        try {
            // 1. Execute the orders
            let orders = showCurrentOrders();
            if (orders.length > 0) {
                mainKeeperLogger.info(`MAIN_KEEPER: Available Orders: ${orders.length}`);

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

                mainKeeperLogger.info(`MAIN_KEEPER: Valid Orders: ${validConditionalOrders.length}`);
                mainKeeperLogger.info(`MAIN_KEEPER: Valid Orders: ${validConditionalOrders}`);

                // Filter out max-retries
                // let executableConditionalOrders: Array<IORDER> = validConditionalOrders.filter(order => order.retries < MAX_RETRIES)

                if (validConditionalOrders.length > 0) {
                    const pageSize = MULTICALL_PAGE_SIZE;
                    let successfulOrders: Array<IORDER> = [];

                    // Array to store promises for each callStatic result
                    const staticCallPromises: Promise<any>[] = [];
                    // console.log('staticCallPromises', staticCallPromises);

                    // Paginate the orders
                    for (let i = 0; i < validConditionalOrders.length; i += pageSize) {
                        const paginatedOrders = validConditionalOrders.slice(i, i + pageSize);

                        const staticCalls = paginatedOrders.map(order => {
                            incrementOrderRetries(order.account, order.conditionalOrderId, order.retries + 1);
                            return {
                                target: order.account,
                                callData: accountContract.interface.encodeFunctionData("executeConditionalOrderWithPaymentReceiver", [order.conditionalOrderId, paymentReceiverAddress]),
                                allowFailure: true,
                            }
                        })

                        // Add the static call to the promises array
                        staticCallPromises.push(multicall.callStatic.aggregate3(staticCalls));
                    }
                    console.log('staticCallPromises', staticCallPromises);
                    mainKeeperLogger.info(`MAIN_KEEPER: StaticCall Promises: ${staticCallPromises}`);
                    
                    // Execute all static calls in parallel and accumulate results
                    const staticResultsArray: STATIC_CALL_RESULT[][] = await Promise.all(staticCallPromises);

                    console.log('staticResults', staticResultsArray);
                    mainKeeperLogger.info(`MAIN_KEEPER: StaticCall Results: ${staticResultsArray}`);

                    // Filter and accumulate the successful orders
                    staticResultsArray.forEach((staticResults: STATIC_CALL_RESULT[], index) => {
                        const paginatedOrders = validConditionalOrders.slice(index * pageSize, (index + 1) * pageSize);
                        const successfulPageOrders = paginatedOrders.filter((_, i) => staticResults[i].success);
                        successfulOrders = successfulOrders.concat(successfulPageOrders);
                    });

                    // console.log('successfulOrders', successfulOrders);

                    // *******************
                    mainKeeperLogger.info(`MAIN_KEEPER: Ready to execute: ${successfulOrders.length}`);

                    if (successfulOrders.length > 0) {
                        // Create Payload
                        const executeCalls = successfulOrders.slice(0, MULTICALL_PAGE_SIZE).map(order => {
                            incrementOrderRetries(order.account, order.conditionalOrderId, order.retries + 1);
                            return {
                                target: order.account,
                                callData: accountContract.interface.encodeFunctionData("executeConditionalOrderWithPaymentReceiver", [order.conditionalOrderId, paymentReceiverAddress]),
                                allowFailure: true,                            }
                        });

                        // Estimate gas and gasprice
                        const gasLimit = await multicall.estimateGas.aggregate3(executeCalls);
                        const gasPrice = await rpcprovider.getGasPrice();

                        mainKeeperLogger.info(`MAIN_KEEPER: GasLimit: ${gasLimit.toString()}, GasPrice: ${gasPrice.toString()}`);

                        // Execute the transaction
                        const tx = await multicall.connect(signer).aggregate3(executeCalls, {
                            gasLimit: gasLimit.mul(6).div(5),
                            gasPrice: gasPrice.mul(6).div(5),
                        });
                        await tx.wait(2);
                        mainKeeperLogger.info(`MAIN_KEEPER: Order Filled Tx: ${chalk.green(tx.hash)}`)
                        // await sendTG(`MAIN_KEEPER - Order Filled Tx: ${tx.hash}`)
                    }
                    else {
                        mainKeeperLogger.info("MAIN_KEEPER: Restarting ....");
                        await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                        continue;
                    }
                } else {
                    mainKeeperLogger.info("MAIN_KEEPER: Restarting.....");
                    // No task available, wait a bit before retrying, Ideally for bsc it's 3 seconds
                    await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                    continue;
                }

            } else {
                mainKeeperLogger.info("No Conditional Orders Found Restarting.....");
                // No task available, wait a bit before retrying, Ideally for bsc it's 3 seconds
                await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                continue;
            }
        }
        catch (error) {
            mainKeeperLogger.error(`error ${error as Error}`);
            await sendTG(`MAIN_KEEPER - ${(error as Error).toString()}}`)
            await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            continue;
        }
    }
}