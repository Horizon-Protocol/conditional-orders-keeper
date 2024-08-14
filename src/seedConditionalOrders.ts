import fs from 'fs';
import { ethers } from "ethers";

export const seedBlock = 68492739;
const CHUNK_SIZE = 10000; // limit range of events to comply with rpc providers

const ABI = [
    "event ConditionalOrderPlaced(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, bytes32 marketKey, int256 marginDelta, int256 sizeDelta, uint256 targetPrice, uint8 conditionalOrderType, uint256 desiredFillPrice, bool reduceOnly)",
    "event ConditionalOrderCancelled(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, uint8 reason)",
    "event ConditionalOrderFilled(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, uint256 fillPrice, uint256 keeperFee, uint8 priceOracle)",

    'function executeConditionalOrder(uint256 _conditionalOrderId) external',

    'function zUSDRates() public view returns (tuple(bytes32 marketKey, uint256 price, uint8 priceOracle)[] memory)',

    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
];

interface IORDER {
    account: string;
    conditionalOrderId: number;
    marketKey: string;
    long: boolean;
    targetPrice: ethers.BigNumber;
    conditionalOrderType: number
}

const checkNewEventsAndUpdateEventsData = async (lastProcessedBlock: number, currentBlock: number, contract: ethers.Contract, contractAddress: string, orders: IORDER[]): Promise<IORDER[]> => {
    try {
        let fromBlock = lastProcessedBlock + 1;

        while (fromBlock <= currentBlock) {
            const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
            console.log(`Fetching events from: ${fromBlock}, to:${toBlock}`);

            // Retry mechanism for transient errors
            let events: ethers.Event[] = [];
            let attempts = 3;
            while (attempts > 0) {
                try {
                    // Query past logs for the current chunk
                    events = await contract.queryFilter({ address: contractAddress }, fromBlock, toBlock);
                    break; // Exit loop if successful
                } catch (error) {
                    console.error(`Error fetching events, attempts left: ${attempts}, Error: ${error}`);
                    attempts--;
                    if (attempts === 0) {
                        throw new Error(`Failed to fetch events after multiple attempts.`);
                    }
                    // Implement a delay before retrying (exponential backoff)
                    await new Promise(res => setTimeout(res, 1000));
                    // await new Promise(res => setTimeout(res, 1000 * (4 - attempts)));
                }
            }

            for (const event of events) {
                const { event: eventName, args, transactionHash, blockNumber } = event;
                if (!args) continue; // Skip events without arguments

                // console.log('eventName', eventName, event.transactionHash);

                if (eventName === "ConditionalOrderPlaced") {
                    const account = args?.[0];
                    const conditionalOrderId = args?.[1].toNumber();
                    const marketKey = args?.[3];
                    const sizeDelta = ethers.utils.formatEther(args?.[5]);
                    const targetPrice = args?.[6];
                    const conditionalOrderType = args?.[7];

                    // Check for duplicate orders
                    const orderExists = orders.some(order =>
                        order.account === account && order.conditionalOrderId === conditionalOrderId
                    );

                    if (!orderExists) {
                        orders.push({
                            account,
                            conditionalOrderId: Number(conditionalOrderId),
                            marketKey,
                            long: Number(sizeDelta) > 0 ? true : false,
                            targetPrice: targetPrice,
                            conditionalOrderType: conditionalOrderType
                        });
                    }
                    console.log(`ConditionalOrderPlaced: Account: ${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                } else if (eventName === "ConditionalOrderCancelled" || eventName === "ConditionalOrderFilled") {
                    const account = args?.[0];
                    const conditionalOrderId = args?.[1].toNumber();
                    orders = orders.filter(
                        (order) => !(order.account === account && order.conditionalOrderId === conditionalOrderId)
                    );
                    console.log(`${eventName === "ConditionalOrderCancelled" ? "ConditionalOrderCancelled" : "ConditionalOrderFilled"}: Account:${account},ID:${conditionalOrderId},${blockNumber},${transactionHash}`);
                }
            }

            // Update the lastProcessedBlock for this chunk
            lastProcessedBlock = toBlock;
            // Move to the next chunk
            fromBlock = toBlock + 1;
        }

        return orders;
    } catch (error) {
        console.error("Error in checkNewEventsAndUpdateEventsData:", error);
        return orders;
    }
};

export const seedOrders = async () => {
    const provider = new ethers.providers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc")

    let ordersToFullfill: IORDER[] = [];
    const currentBlock = await provider.getBlockNumber();

    const eventsContract = new ethers.Contract("0x354b1c5e5e58f80Dfd0B7C72efA0aa0805fdf3c9", ABI, provider);


    let updatedOrders = await checkNewEventsAndUpdateEventsData(seedBlock, currentBlock, eventsContract, eventsContract.address, ordersToFullfill)

    // const ordersToFullfill    fs.readFileSync('data/ordersToFullfill.json', JSON.stringify(updatedOrders));

    fs.writeFileSync("data/ordersToFullfill.txt", JSON.stringify(JSON.stringify(updatedOrders)));
    fs.writeFileSync("data/ordersToFullfill.json", JSON.stringify(updatedOrders));

    console.log('currentBlock', currentBlock);
}

// first()
