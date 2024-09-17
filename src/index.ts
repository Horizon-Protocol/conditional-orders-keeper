import 'dotenv/config'
import { executeOrders } from "./orderExecutor";
import { executeFailedOrders } from "./failedOrderExecutor";
import { seedAndQueryForOrders } from './seedOrders'
import { sendTG } from './utils'

// import { listenEvents } from "./orderListener";

const main = async () => {
    // await sendTG("Keeper Started")
    seedAndQueryForOrders();
    executeOrders();
    executeFailedOrders()
};

main();

