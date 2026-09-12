const { z } = require("zod");

const updateProductAliasSchema = z.object({
  alias: z.string().trim().min(1, "Product alias is required").max(200),
});

module.exports = {
  updateProductAliasSchema,
};
