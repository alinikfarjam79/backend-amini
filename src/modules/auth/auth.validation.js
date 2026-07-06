const { z } = require("zod");

const loginSchema = z.object({
    username: z.string().min(3).max(30),
    password: z.string().min(6),
});

module.exports = {
    loginSchema,
};