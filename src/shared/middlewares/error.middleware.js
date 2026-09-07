const env = require("../../config/env");

const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    const response = {
        success: false,
        message: err.message || "Internal Server Error",
    };

    if (err.errors) {
        response.errors = err.errors;
    }

    if (err.zeroPriceProducts) {
        response.zeroPriceProducts = err.zeroPriceProducts;
    }

    if (err.zeroOrNegativeQuantityProducts) {
        response.zeroOrNegativeQuantityProducts = err.zeroOrNegativeQuantityProducts;
    }

    if (env.nodeEnv === "development") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

module.exports = errorMiddleware;
