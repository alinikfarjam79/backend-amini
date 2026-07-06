const { z } = require("zod");

const createUserSchema = z.object({
    username: z.string().min(3).max(30),
    password: z.string().min(6),
    role: z.enum(["admin", "user"]).optional(),
});

const updateUserSchema = z.object({
    username: z.string().min(3).max(30).optional(),
    isActive: z.boolean().optional(),
});

module.exports = {
    createUserSchema,
    updateUserSchema,
};