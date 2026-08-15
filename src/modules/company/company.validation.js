const { z } = require("zod");

const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100),
  code: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  createCompanySchema,
};
