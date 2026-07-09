const { z } = require("zod");
const { IRAN_MOBILE_REGEX } = require("../../shared/utils/phoneNumber");

const loginSchema = z.object({
    phoneNumber: z.string().regex(IRAN_MOBILE_REGEX, "Phone number must be a valid Iran mobile number"),
    password: z.string().min(6).optional(),
    otpCode: z.string().regex(/^\d{4,6}$/, "OTP code must be 4 to 6 digits").optional(),
});

const loginMethodSchema = z.object({
    phoneNumber: z.string().regex(IRAN_MOBILE_REGEX, "Phone number must be a valid Iran mobile number"),
});

module.exports = {
    loginSchema,
    loginMethodSchema,
};
