const jwt = require("jsonwebtoken");

const User = require("../../modules/user/user.model");
const sessionService = require("../../modules/session/session.service");

const AppError = require("../utils/AppError");
const env = require("../../config/env");

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError("Authentication token is required", 401);
        }

        const token = authHeader.split(" ")[1];

        const payload = jwt.verify(token, env.jwtSecret);

        const session = await sessionService.findActiveSession({
            sessionId: payload.sessionId,
            userId: payload.userId,
        });

        if (!session) {
            throw new AppError("Session is expired or revoked", 401);
        }

        const user = await User.findById(payload.userId);

        if (!user || !user.isActive) {
            throw new AppError("User is not allowed", 403);
        }

        req.user = user;
        req.session = session;

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = protect;