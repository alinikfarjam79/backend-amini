const Product = require("./product.model");

const findAll = ({ filter = {}, skip = 0, limit = 20 } = {}) => {
  return Product.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

const count = (filter = {}) => {
  return Product.countDocuments(filter);
};

const findByProductCodes = (productCodes) => {
  return Product.find({ productCode: { $in: productCodes } }).select("productCode");
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

module.exports = {
  findAll,
  count,
  findByProductCodes,
  bulkUpsert,
  bulkUpdateQuantities,
};
