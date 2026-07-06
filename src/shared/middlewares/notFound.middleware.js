const AppError = require("../utils/AppError");

const notFoundMiddleware = (req, res, next) => {
    next(
        new AppError(
            `Route ${req.originalUrl} not found`,
            404
        )
    );
};

module.exports = notFoundMiddleware;