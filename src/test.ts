import { ethers } from 'ethers';

const ABI = [
    "event ConditionalOrderPlaced(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, bytes32 marketKey, int256 marginDelta, int256 sizeDelta, uint256 targetPrice, uint8 conditionalOrderType, uint256 desiredFillPrice, bool reduceOnly)",
    "event ConditionalOrderCancelled(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, uint8 reason)",
    "event ConditionalOrderFilled(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, uint256 fillPrice, uint256 keeperFee, uint8 priceOracle)",

    'function executeConditionalOrder(uint256 _conditionalOrderId) external',
    'function executeConditionalOrderWithPaymentReceiver(uint256 _conditionalOrderId, address _paymentReceiver) external',
    'function getConditionalOrder(uint256 _conditionalOrderId) public view returns (tuple(bytes32 marketKey, int256 marginDelta, int256 sizeDelta, uint256 targetPrice, bytes32 gelatoTaskId, uint8 conditionalOrderType, uint256 desiredFillPrice, bool reduceOnly, bytes32 trackingCode, uint256 creationTime))',

    'function zUSDRates() public view returns (tuple(bytes32 marketKey, uint256 price, uint8 priceOracle)[] memory)',

    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
];

const rpcprovider = new ethers.providers.JsonRpcProvider(
    'https://sepolia-rollup.arbitrum.io/rpc'
);
const accountContract = new ethers.Contract('0xDf3F08bE7d1C63871975a34EacCdd180381F1993', ABI, rpcprovider);


const first = async () => {
    const cd = await accountContract.getConditionalOrder(38);
    console.log('cd', cd);
 }

 first()