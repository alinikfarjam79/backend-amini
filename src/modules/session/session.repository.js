const Session = require("./session.model");

const create = (payload) => {
    return Session.create(payload);
};

const findActiveById = (sessionId, userId) => {
    return Session.findOne({
        _id: sessionId,
        user: userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
    });
};

const revokeById = (sessionId) => {
    return Session.findByIdAndUpdate(sessionId, {
        isActive: false,
        revokedAt: new Date(),
    });
};

const revokeAllByUserId = (userId) => {
    return Session.updateMany(
        {
            user: userId,
            isActive: true,
        },
        {
            isActive: false,
            revokedAt: new Date(),
        }
    );
};

module.exports = {
    create,
    findActiveById,
    revokeById,
    revokeAllByUserId,
};