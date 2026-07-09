const User = require("./user.model");

const create = (payload) => {
    return User.create(payload);
};

const count = () => {
    return User.countDocuments();
};

const findById = (id) => {
    return User.findById(id);
};

const findByUsername = (username, withPassword = false) => {
    const query = User.findOne({ username });

    if (withPassword) {
        query.select("+password +otpCode +otpExpiresAt");
    }

    return query;
};

const findByPhoneNumber = (phoneNumber, withSecrets = false) => {
    const query = User.findOne({ phoneNumber });

    if (withSecrets) {
        query.select("+password +otpCode +otpExpiresAt");
    }

    return query;
};

const findAll = () => {
    return User.find().select("-password");
};

const updateById = (id, payload) => {
    return User.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    }).select("-password");
};

const softDeleteById = (id) => {
    return User.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
    ).select("-password");
};

module.exports = {
    create,
    count,
    findById,
    findByUsername,
    findByPhoneNumber,
    findAll,
    updateById,
    softDeleteById,
};
