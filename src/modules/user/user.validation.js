const { z } = require("zod");
const LOGIN_METHODS = require("../../shared/constants/loginMethods");
const { IRAN_MOBILE_REGEX } = require("../../shared/utils/phoneNumber");

const createUserSchema = z.object({
    username: z.string().min(3).max(30).optional(),
    phoneNumber: z.string().regex(IRAN_MOBILE_REGEX, "Phone number must be a valid Iran mobile number"),
    loginMethod: z.enum(Object.values(LOGIN_METHODS)).optional(),
    password: z.string().min(6).optional(),
    otpCode: z.string().regex(/^\d{4,6}$/, "OTP code must be 4 to 6 digits").optional(),
    otpExpiresAt: z.coerce.date().optional(),
    role: z.enum(["admin", "user"]).optional(),
}).superRefine((data, ctx) => {
    const loginMethod = data.loginMethod || LOGIN_METHODS.PASSWORD;

    if (loginMethod === LOGIN_METHODS.PASSWORD && !data.password) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: "Password is required when loginMethod is password",
        });
    }
});

const updateUserSchema = z.object({
    username: z.string().min(3).max(30).optional(),
    phoneNumber: z.string().regex(IRAN_MOBILE_REGEX, "Phone number must be a valid Iran mobile number").optional(),
    loginMethod: z.enum(Object.values(LOGIN_METHODS)).optional(),
    password: z.string().min(6).optional(),
    otpCode: z.string().regex(/^\d{4,6}$/, "OTP code must be 4 to 6 digits").optional(),
    otpExpiresAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
});

module.exports = {
    createUserSchema,
    updateUserSchema,
};
