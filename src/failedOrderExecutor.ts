import { ethers } from 'ethers';
import chalk from 'chalk';

import { IORDER, IRates, STATIC_CALL_ERROR, STATIC_CALL_RESULT } from './types';
import { RESTART_TIMEOUT, paymentReceiverAddress } from './config';
import { showFailedOrders, incrementOrderRetries } from './state';
import { rpcprovider, signer, createContracts, validLimitOrder, validStopOrder } from './utils';
import { makeLogger } from './logger';

const MULTICALL_PAGE_SIZE = 1;
const errorKeeperLogger = makeLogger('ERROR_KEEPER', chalk.yellowBright);

export async function executeFailedOrders() {
    errorKeeperLogger.info(`ERROR_KEEPER: STARTED`);
    while (true) {
        try {
            // Execute failed orders
            let failedConditionalOrders = showFailedOrders();
            if (failedConditionalOrders.length > 0) {

                // Filter out failed orders who exceeded max-retries
                // let failedConditionalOrders: Array<IORDER> = orders.filter(order => order.retries >= MAX_RETRIES)

                errorKeeperLogger.info(`ERROR_KEEPER: Available Orders: ${failedConditionalOrders.length}`);

                if (failedConditionalOrders.length > 0) {
                    const { multicall, accountContract } = createContracts();

                    // Find Onchain Price
                    const zUSDRates: IRates[] = await accountContract.zUSDRates();
                    const zUSDRatesMapping = zUSDRates.reduce((rates, rate) => {
                        rates[rate.marketKey] = rate.price;
                        return rates;
                    }, {} as Record<string, ethers.BigNumber>)

                    // Match orders
                    let validConditionalOrders: Array<IORDER> = failedConditionalOrders.filter(order => {
                        // Limit Orders
                        if (order.conditionalOrderType === 0) {
                            return validLimitOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                        }
                        // Stop Loss Orders
                        else {
                            return validStopOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                        }
                    })

                    errorKeeperLogger.info(`ERROR_KEEPER: Valid Orders: ${validConditionalOrders.length}`);
                    errorKeeperLogger.info(`ERROR_KEEPER: Valid Orders: ${validConditionalOrders}`);

                    if (validConditionalOrders.length > 0) {
                        const pageSize = MULTICALL_PAGE_SIZE;
                        let successfulOrders: Array<IORDER> = [];

                        // Array to store promises for each callStatic result
                        const staticCallPromises: Promise<any>[] = [];

                        // Paginate the orders
                        for (let i = 0; i < validConditionalOrders.length; i += pageSize) {
                            const paginatedOrders = validConditionalOrders.slice(i, i + pageSize);

                            const staticCalls = paginatedOrders.map(order => {
                                return {
                                    target: order.account,
                                    callData: accountContract.interface.encodeFunctionData("executeConditionalOrderWithPaymentReceiver", [order.conditionalOrderId, paymentReceiverAddress]),
                                    allowFailure: true, // Don't Allow failures in static calls
                                }
                            })

                            // Add the static call to the promises array
                            staticCallPromises.push(multicall.callStatic.aggregate3(staticCalls));
                        }

                        console.log('staticCallPromises', staticCallPromises);
                        errorKeeperLogger.info(`ERROR_KEEPER: StaticCall Promises: ${staticCallPromises}`);

                        // Execute all static calls in parallel and accumulate results
                        const staticResultsArray: STATIC_CALL_RESULT[][] = await Promise.all(staticCallPromises);

                        console.log('staticResults', staticResultsArray);
                        errorKeeperLogger.info(`MAIN_KEEPER: StaticCall Results: ${staticResultsArray}`);


                        // Filter and accumulate the successful orders
                        staticResultsArray.forEach((staticResults: STATIC_CALL_RESULT[], index) => {
                            const paginatedOrders = validConditionalOrders.slice(index * pageSize, (index + 1) * pageSize);
                            const successfulPageOrders = paginatedOrders.filter((_, i) => staticResults[i].success);
                            successfulOrders = successfulOrders.concat(successfulPageOrders);
                        });


                        // console.log('Total Failed Successful Orders', successfulOrders);
                        errorKeeperLogger.info(`ERROR_KEEPER: Ready to execute: ${successfulOrders.length}`);
                        if (successfulOrders.length > 0) {
                            // Create the actual execution payload
                            const executeCalls = successfulOrders.slice(0, MULTICALL_PAGE_SIZE).map(order => {
                                incrementOrderRetries(order.account, order.conditionalOrderId, order.retries + 1);

                                return {
                                    target: order.account,
                                    callData: accountContract.interface.encodeFunctionData("executeConditionalOrderWithPaymentReceiver", [order.conditionalOrderId, paymentReceiverAddress]),
                                    allowFailure: true,  // Allow failures in the actual execution
                                }
                            });

                            // Estimate gas and gas price
                            const gasLimit = await multicall.estimateGas.aggregate3(executeCalls);
                            const gasPrice = await rpcprovider.getGasPrice();

                            errorKeeperLogger.info(`ERROR_KEEPER: GasLimit: ${gasLimit.toString()}, GasPrice: ${gasPrice.toString()}`);

                            // Execute the transaction
                            const tx = await multicall.connect(signer).aggregate3(executeCalls, {
                                gasLimit: gasLimit.mul(6).div(5),
                                gasPrice: gasPrice.mul(6).div(5),
                            });
                            await tx.wait(2);
                            errorKeeperLogger.info(`ERROR_KEEPER: Order Filled Tx: ${chalk.green(tx.hash)}`);
                        }
                        else {
                            errorKeeperLogger.info("ERROR_KEEPER: Restarting ....");
                            await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                            continue;
                        }
                    } else {
                        errorKeeperLogger.info("ERROR_KEEPER: Restarting ....");
                        await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                        continue;
                    }
                }
                else {
                    errorKeeperLogger.info("ERROR_KEEPER: Restarting ....");
                    await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                    continue;
                }

            } else {
                errorKeeperLogger.info("ERROR_KEEPER: Restarting.....");
                // No task available, wait a bit before retrying, Ideally for bsc it's 3 seconds
                await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            }
        }
        catch (error) {
            errorKeeperLogger.error(`error ${error as Error}`);
            await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            continue;
        }
    }
}