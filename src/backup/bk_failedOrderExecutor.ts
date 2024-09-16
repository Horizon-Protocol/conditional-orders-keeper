import fs from 'fs';
import { ethers } from 'ethers';

import { IORDER, IRates, STATIC_CALL_ERROR } from './types';
import { CHUNK_SIZE, seedBlock, RESTART_TIMEOUT, MAX_RETRIES, paymentReceiverAddress } from './config';
import { showLastProcessedBlock, showOrders, pushOrders, deleteOrders, incrementOrderRetries, saveLastProcessedBlock } from './state';
import { rpcprovider, signer, createContracts, validLimitOrder, validStopOrder } from './utils';
import { logger } from './logger';

export async function executeFailedOrders() {
    logger.info(`Execute Failed Conditional Orders`);
    while (true) {
        try {
            // 2. Execute the orders
            let orders = showOrders();
            if (orders.length > 0) {
                logger.info(`Total Available Orders: ${orders.length}`);

                // Filter out failed orders who exceeded max-retries
                let nonexecutableConditionalOrders: Array<IORDER> = orders.filter(order => order.retries >= MAX_RETRIES)

                logger.info(`Total Failed Executable Orders: ${nonexecutableConditionalOrders.length}`);

                if (nonexecutableConditionalOrders.length > 0) {
                    const { multicall, accountContract } = createContracts();

                    // Find Onchain Price
                    const zUSDRates: IRates[] = await accountContract.zUSDRates();
                    const zUSDRatesMapping = zUSDRates.reduce((rates, rate) => {
                        rates[rate.marketKey] = rate.price;
                        return rates;
                    }, {} as Record<string, ethers.BigNumber>)

                    // Match orders
                    let validConditionalOrders: Array<IORDER> = nonexecutableConditionalOrders.filter(order => {
                        // Limit Orders
                        if (order.conditionalOrderType === 0) {
                            return validLimitOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                        }
                        // Stop Loss Orders
                        else {
                            return validStopOrder(zUSDRatesMapping[order.marketKey], order.targetPrice, order.long)
                        }
                    })
                    logger.info(`Total Failed Valid Orders: ${validConditionalOrders.length}`);

                    if (validConditionalOrders.length > 0) {
                        for (let index = 0; index < validConditionalOrders.length; index++) {
                            const order = validConditionalOrders[index];

                            incrementOrderRetries(order.account, order.conditionalOrderId);

                            // Instead of sending txn simulate them individually and retry them
                            try {
                                const staticCallSuccess = await accountContract.attach(order.account).connect(signer).callStatic.executeConditionalOrderWithPaymentReceiver(order.conditionalOrderId, paymentReceiverAddress);
                                if (staticCallSuccess) {
                                    // Estimate gas and gasprice
                                    const gasLimit = await accountContract.attach(order.account).connect(signer).estimateGas.executeConditionalOrderWithPaymentReceiver(order.conditionalOrderId, paymentReceiverAddress);
                                    const gasPrice = await rpcprovider.getGasPrice();

                                    logger.info(`GasLimit: ${gasLimit.toString()}, GasPrice: ${gasPrice.toString()}`);

                                    const tx = await accountContract.attach(order.account).connect(signer).executeConditionalOrderWithPaymentReceiver(order.conditionalOrderId, paymentReceiverAddress, {
                                        gasLimit: gasLimit.mul(6).div(5),
                                        gasPrice: gasPrice.mul(6).div(5),
                                    });
                                    await tx.wait(1);
                                    logger.info(`Order Filled Tx: ${tx.hash}`)
                                }
                            } catch (error) {
                                try {
                                    const staticError = error as unknown as STATIC_CALL_ERROR
                                    if (!!staticError && !!staticError.errorArgs) {
                                        if (staticError.errorArgs.length > 0) {
                                            console.log(`staticCall error for ${order.account}: ${order.conditionalOrderId}, ${staticError.errorArgs[0]}`);
                                            // updateErrorsInOrders(staticError.errorArgs[0] as string);
                                        }
                                        else {
                                            // console.error
                                            // updateErrorsInOrders(JSON.stringify(error));
                                            // Update with the default error
                                        }
                                    } else {
                                        // console.error
                                        // updateErrorsInOrders(JSON.stringify(error));
                                        // Update with the default error
                                    }
                                    continue;

                                } catch (error) {
                                    console.error(error);
                                    continue;
                                }
                            }
                        }
                    }
                }
                else {
                    logger.info("No Valid Orders Found Continuing ....");
                    await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
                    continue;
                }

            } else {
                logger.info("No Conditional Orders Found Restarting.....");
                // No task available, wait a bit before retrying, Ideally for bsc it's 3 seconds
                await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            }
        }
        catch (error) {
            logger.error(`error ${error as Error}`);
            await new Promise(res => setTimeout(res, RESTART_TIMEOUT));
            continue;
        }
    }
}