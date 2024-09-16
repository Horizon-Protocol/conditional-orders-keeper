export const ABI = [
    "event ConditionalOrderPlaced(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, bytes32 marketKey, int256 marginDelta, int256 sizeDelta, uint256 targetPrice, uint8 conditionalOrderType, uint256 desiredFillPrice, bool reduceOnly)",
    "event ConditionalOrderCancelled(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, uint8 reason)",
    "event ConditionalOrderFilled(address indexed account, uint256 indexed conditionalOrderId, bytes32 indexed gelatoTaskId, uint256 fillPrice, uint256 keeperFee, uint8 priceOracle)",

    'function executeConditionalOrder(uint256 _conditionalOrderId) external',
    'function executeConditionalOrderWithPaymentReceiver(uint256 _conditionalOrderId, address _paymentReceiver) external returns(bool)',

    'function zUSDRates() public view returns (tuple(bytes32 marketKey, uint256 price, uint8 priceOracle)[] memory)',

    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',

    'function transfer(address to, uint256 amount)',
];
