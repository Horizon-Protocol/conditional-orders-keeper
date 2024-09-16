import { ethers } from 'ethers';
import { createContracts } from './utils';
import { pushOrders, deleteOrders } from './state';
import { logger } from './logger';

export const listenEvents = async () => {
    const { eventsContract } = createContracts();

    logger.info("Event Listener Started");

    // Subscribe to the events
    // Event listener for ConditionalOrderPlaced
    eventsContract.on("ConditionalOrderPlaced", (
        account: string,
        conditionalOrderId: ethers.BigNumber,
        gelatoTaskId: string,
        marketKey: string,
        marginDelta: ethers.BigNumber,
        sizeDelta: ethers.BigNumber,
        targetPrice: ethers.BigNumber,
        conditionalOrderType: ethers.BigNumber,
        desiredFillPrice: ethers.BigNumber,
        reduceOnly: boolean,
        event
    ) => {

        const { transactionHash, blockNumber } = event;
        pushOrders(
            account,
            Number(conditionalOrderId),
            marketKey,
            Number(ethers.utils.formatEther(sizeDelta)) > 0 ? true : false,
            targetPrice,
            Number(conditionalOrderType),
        );

        // writeDataToFile(data);
        console.log(`Order placed: ${account}, ID: ${conditionalOrderId.toString()}`);
    });

    // Event listener for ConditionalOrderCancelled
    eventsContract.on("ConditionalOrderCancelled", (account: string, conditionalOrderId: ethers.BigNumber) => {
        deleteOrders(account, conditionalOrderId.toNumber())
        console.log(`Order cancelled: ${account}, ID: ${conditionalOrderId.toString()}`);
    });

    // Event listener for ConditionalOrderFilled
    eventsContract.on("ConditionalOrderFilled", (account: string, conditionalOrderId: ethers.BigNumber) => {
        deleteOrders(account, conditionalOrderId.toNumber())
        console.log(`Order Filled: ${account}, ID: ${conditionalOrderId.toString()}`);
    });
}

// Start listening to events
// listenEvents();


