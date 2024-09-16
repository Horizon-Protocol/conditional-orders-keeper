import 'dotenv/config'
import { executeOrders } from "./orderExecutor";
import { executeFailedOrders } from "./failedOrderExecutor";
import { seedAndQueryForOrders } from './seedOrders'


// import { listenEvents } from "./orderListener";

const main = async () => {
    seedAndQueryForOrders();
    executeOrders();
    executeFailedOrders()
};

main();

