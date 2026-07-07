const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userRepository = require("../user/user.repository");
const sessionService = require("../session/session.service");

const AppError = require("../../shared/utils/AppError");
const env = require("../../config/env");
const LOGIN_METHODS = require("../../shared/constants/loginMethods");
const { normalizeIranPhoneNumber } = require("../../shared/utils/phoneNumber");

const generateToken = (payload) => {
    return jwt.sign(payload, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
};

const verifyPasswordLogin = async (user, password) => {
    if (!password) {
        throw new AppError("Password is required for this user", 400);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        throw new AppError("Invalid phone number or password", 401);
    }
};

const verifyOtpLogin = async (user, otpCode) => {
    if (!otpCode) {
        throw new AppError("OTP code is required for this user", 400);
    }

    if (env.allowStaticOtp && otpCode === "6666") {
        return;
    }

    const isOtpValid = user.otpCode
        ? await bcrypt.compare(otpCode, user.otpCode)
        : false;

    if (!isOtpValid) {
        throw new AppError("Invalid phone number or OTP code", 401);
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
        throw new AppError("OTP code has expired", 401);
    }
};

const login = async ({ phoneNumber, password, otpCode, userAgent, ip }) => {
    const normalizedPhoneNumber = normalizeIranPhoneNumber(phoneNumber);
    const user = await userRepository.findByPhoneNumber(normalizedPhoneNumber, true);

    if (!user) {
        throw new AppError("Invalid phone number or credentials", 401);
    }

    if (!user.isActive) {
        throw new AppError("Your account is inactive", 403);
    }

    if (user.loginMethod === LOGIN_METHODS.OTP) {
        await verifyOtpLogin(user, otpCode);
    } else {
        await verifyPasswordLogin(user, password);
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
            phoneNumber: user.phoneNumber,
            loginMethod: user.loginMethod,
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
