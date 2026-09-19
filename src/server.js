const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const {
    ensureProductAliases,
    ensureProductThresholds,
} = require("./modules/product/product.service");
const { ensureDefaultWarehouses } = require("./modules/warehouse/warehouse.seed");

const startServer = async () => {
    await connectDB();
    await ensureDefaultWarehouses();
    await ensureProductAliases();
    await ensureProductThresholds();

    app.listen(env.port, "0.0.0.0", () => {
        console.log(`Server running on port ${env.port}`);
    });
};

startServer();
