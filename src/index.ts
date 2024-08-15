import 'dotenv/config'
import { executeOrders } from "./orderExecutor";

// import { listenEvents } from "./orderListener";

const main = async () => {
    // Start the executor
    await executeOrders();
}

main();


