require("dotenv").config();

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGO_URI,
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};

module.exports = env;