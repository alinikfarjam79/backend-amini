require("dotenv").config();

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 5000,

    mongoUri: process.env.MONGO_URI,

    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

    sessionExpiresInDays: Number(process.env.SESSION_EXPIRES_IN_DAYS || 7),

    allowStaticOtp: process.env.ALLOW_STATIC_OTP === "true",
};

module.exports = Object.freeze(env);
