const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const { ensureDefaultWarehouses } = require("./modules/warehouse/warehouse.seed");

const startServer = async () => {
    await connectDB();
    await ensureDefaultWarehouses();

    app.listen(env.port, "0.0.0.0", () => {
        console.log(`Server running on port ${env.port}`);
    });
};

startServer();
