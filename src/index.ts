import 'dotenv/config'
import { listenEvents } from "./orderListener";
import { executeOrders } from "./orderExecutor";
import { checkForSeeding } from "./utils";
import { seedOrders } from "./seedConditionalOrders";
import fs from 'fs'


const main = async () => {
    // Check for seeding
    const seed = await checkForSeeding();
    if (seed) {
        // logger.info(`Seeding Required: ${lastProcessedBlock}`);
        await seedOrders();
    }

    // Start the listener
    await listenEvents();

    // Start the executor
    await executeOrders();
}

main();


