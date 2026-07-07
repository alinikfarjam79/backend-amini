const mongoose = require("mongoose");
const ROLES = require("../../shared/constants/roles");
const LOGIN_METHODS = require("../../shared/constants/loginMethods");
const { normalizeIranPhoneNumber } = require("../../shared/utils/phoneNumber");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 30,
        },

        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"],
            unique: true,
            trim: true,
            set: normalizeIranPhoneNumber,
            match: [/^09\d{9}$/, "Phone number must be a valid Iran mobile number"],
        },

        loginMethod: {
            type: String,
            enum: Object.values(LOGIN_METHODS),
            default: LOGIN_METHODS.PASSWORD,
        },

        password: {
            type: String,
            required: function () {
                return this.loginMethod === LOGIN_METHODS.PASSWORD;
            },
            minlength: 6,
            select: false,
        },

        otpCode: {
            type: String,
            select: false,
        },

        otpExpiresAt: {
            type: Date,
            select: false,
        },

        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.USER,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);
