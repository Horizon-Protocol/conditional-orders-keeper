export const wss = process.env.WSS!;
export const rpc = process.env.RPC!;
export const signerPrivateKey = process.env.PVTKEY!;
export const seedBlock = Number(process.env.SEEDBLOCK!);
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE!); // limit range of events to comply with rpc providers
export const RESTART_TIMEOUT = Number(process.env.RESTART_TIMEOUT!); // Main keeper restart timeout
export const ERROR_RESTART_TIMEOUT = Number(process.env.ERROR_RESTART_TIMEOUT!); // Error keeper restart timeout
export const MAX_RETRIES = Number(process.env.MAX_RETRIES!); // Main keeper retries limit restart timeout
export const ERROR_MAX_RETRIES = Number(process.env.ERROR_MAXRETRIES!); // Error keeper retries limit
export const eventsContractAddress = process.env.EVENTS!
export const multicallAddress = process.env.MULTICALL!
export const accountContractAddress = process.env.ACCOUNT!
export const paymentReceiverAddress = process.env.PAYMENTRECEIVER!
export const etherscanUrl = process.env.ETHERSCAN_URL!
export const network = process.env.NETWORK!




