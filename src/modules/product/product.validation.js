const { z } = require("zod");

const updateProductAliasSchema = z.object({
  alias: z.string().trim().min(1, "Product alias is required").max(200),
});

const updateProductThresholdsSchema = z
  .object({
    warningThreshold: z.number().finite().min(0).optional(),
    criticalThreshold: z.number().finite().min(0).optional(),
    thresholdEnabled: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one threshold field is required",
  });

module.exports = {
  updateProductAliasSchema,
  updateProductThresholdsSchema,
};
