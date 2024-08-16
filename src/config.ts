export const wss = process.env.WSS!;
export const rpc = process.env.RPC!;
export const signerPrivateKey = process.env.PVTKEY!;
export const seedBlock = Number(process.env.SEEDBLOCK!);
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE!); // limit range of events to comply with rpc providers
export const RESTART_TIMEOUT = Number(process.env.RESTART_TIMEOUT!); // Code restart timeout
export const eventsContractAddress = process.env.EVENTS!
export const multicallAddress = process.env.MULTICALL!
export const accountContractAddress = process.env.ACCOUNT!




