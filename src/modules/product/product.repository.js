const Product = require("./product.model");

const findAll = (filter = {}) => {
  return Product.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: "warehouses", select: "-items" });
};

const findByProductCodes = (productCodes) => {
  return Product.find({ productCode: { $in: productCodes } }).select(
    "productCode title"
  );
};

const bulkUpsert = (products) => {
  const operations = products.map((product) => ({
    updateOne: {
      filter: { productCode: product.productCode },
      update: { $set: product },
      upsert: true,
    },
  }));

  return Product.bulkWrite(operations, { ordered: false });
};

const bulkUpdateQuantities = ({ quantityByProductCode, missingQuantity = 0 }) => {
  const productCodes = Array.from(quantityByProductCode.keys());
  const operations = productCodes.map((productCode) => ({
    updateOne: {
      filter: { productCode },
      update: { $set: { quantity: quantityByProductCode.get(productCode) } },
    },
  }));

  operations.push({
    updateMany: {
      filter: { productCode: { $nin: productCodes } },
      update: { $set: { quantity: missingQuantity } },
    },
  });

  return Product.bulkWrite(operations, { ordered: false });
};

const bulkUpdateWarehouseInventory = ({ inventorySummaries }) => {
  if (!Array.isArray(inventorySummaries) || inventorySummaries.length === 0) {
    return {
      matchedCount: 0,
      modifiedCount: 0,
    };
  }

  const operations = inventorySummaries.map((item) => ({
    updateOne: {
      filter: { productCode: item.productCode },
      update: {
        $set: {
          quantity: item.quantity,
          warehouses: item.warehouses,
        },
      },
    },
  }));

  return Product.bulkWrite(operations, { ordered: false });
};

module.exports = {
  findAll,
  findByProductCodes,
  bulkUpsert,
  bulkUpdateQuantities,
  bulkUpdateWarehouseInventory,
};
