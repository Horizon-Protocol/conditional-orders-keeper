import 'dotenv/config'
import { listenEvents } from "./orderListener";
import { executeOrders } from "./orderExecutor";
import { seedOrders } from "./utils";
import fs from 'fs'


const main = async () => {
    // Initialize Seeding
    await seedOrders();

    // Start the listener
    await listenEvents();

    // Start the executor
    await executeOrders();
}

main();


