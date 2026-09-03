const { z } = require("zod");

const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, "Warehouse name is required").max(100),
  isActive: z.boolean().optional(),
});

module.exports = {
  createWarehouseSchema,
};
