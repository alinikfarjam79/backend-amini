const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userRepository = require("../user/user.repository");
const sessionService = require("../session/session.service");

const AppError = require("../../shared/utils/AppError");
const env = require("../../config/env");

const generateToken = (payload) => {
    return jwt.sign(payload, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
};

const login = async ({ username, password, userAgent, ip }) => {
    const user = await userRepository.findByUsername(username, true);

    if (!user) {
        throw new AppError("Invalid username or password", 401);
    }

    if (!user.isActive) {
        throw new AppError("Your account is inactive", 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        throw new AppError("Invalid username or password", 401);
    }

    const session = await sessionService.createSession({
        userId: user._id,
        userAgent,
        ip,
    });

    const token = generateToken({
        userId: user._id,
        sessionId: session._id,
        role: user.role,
    });

    return {
        token,
        user: {
            id: user._id,
            username: user.username,
            role: user.role,
        },
    };
};

const logout = async (sessionId) => {
    await sessionService.revokeSession(sessionId);
    return true;
};

const logoutUserFromAllDevices = async (userId) => {
    await sessionService.revokeUserSessions(userId);
    return true;
};

module.exports = {
    login,
    logout,
    logoutUserFromAllDevices,
};