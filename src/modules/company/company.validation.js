const { z } = require("zod");

const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100),
  code: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

const updateCompanyFileTitleSchema = z.object({
  title: z.string().trim().min(1, "File title is required").max(200),
});

module.exports = {
  createCompanySchema,
  updateCompanyFileTitleSchema,
};
