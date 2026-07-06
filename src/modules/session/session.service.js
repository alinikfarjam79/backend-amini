const sessionRepository = require("./session.repository");
const env = require("../../config/env");

const getSessionExpiresAt = () => {
    const date = new Date();
    date.setDate(date.getDate() + env.sessionExpiresInDays);
    return date;
};

const createSession = async ({ userId, userAgent, ip }) => {
    return sessionRepository.create({
        user: userId,
        userAgent,
        ip,
        expiresAt: getSessionExpiresAt(),
    });
};

const findActiveSession = async ({ sessionId, userId }) => {
    return sessionRepository.findActiveById(sessionId, userId);
};

const revokeSession = async (sessionId) => {
    return sessionRepository.revokeById(sessionId);
};

const revokeUserSessions = async (userId) => {
    return sessionRepository.revokeAllByUserId(userId);
};

module.exports = {
    createSession,
    findActiveSession,
    revokeSession,
    revokeUserSessions,
};