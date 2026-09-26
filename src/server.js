const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const {
    ensureProductAliases,
    ensureProductThresholds,
    ensureProductEnableDefaults,
} = require("./modules/product/product.service");
const { ensureDefaultWarehouses } = require("./modules/warehouse/warehouse.seed");
const {
    ensureCompanyPdfFileOrder,
} = require("./modules/company/company.service");

const startServer = async () => {
    await connectDB();
    await ensureDefaultWarehouses();
    await ensureProductEnableDefaults();
    await ensureProductAliases();
    await ensureProductThresholds();
    await ensureCompanyPdfFileOrder();

    app.listen(env.port, "0.0.0.0", () => {
        console.log(`Server running on port ${env.port}`);
    });
};

startServer();
