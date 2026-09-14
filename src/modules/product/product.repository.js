const Product = require("./product.model");

const findAll = (filter = {}) => {
  return Product.find(filter)
    .sort({ createdAt: -1 })
    .populate({
      path: "warehouses",
      select: "-items",
    })
    .lean();
};

const findById = (id) => {
  return Product.findById(id);
};

const findByProductCodes = (productCodes) => {
  return Product.find({ productCode: { $in: productCodes } }).select(
    "productCode title"
  );
};

const ensureAliases = async () => {
  const products = await Product.find({
      $or: [
        { alias: { $exists: false } },
        { alias: null },
        { alias: "" },
      ],
    }).select("_id title");

  if (products.length === 0) {
    return {
      matchedCount: 0,
      modifiedCount: 0,
    };
  }

  const operations = products.map((product) => ({
    updateOne: {
      filter: { _id: product._id },
      update: {
        $set: {
          alias: product.title,
        },
      },
    },
  }));

  return Product.bulkWrite(operations, { ordered: false });
};

const bulkUpsert = (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      upsertedCount: 0,
      modifiedCount: 0,
      matchedCount: 0,
    };
  }

  const operations = products.map((product) => ({
    updateOne: {
      filter: { productCode: product.productCode },
      update: {
        $set: product,
        $setOnInsert: {
          alias: product.title,
        },
      },
      upsert: true,
    },
  }));

  return Product.bulkWrite(operations, { ordered: false });
};

const bulkCreateMissingWithZeroPrice = (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      upsertedCount: 0,
      modifiedCount: 0,
      matchedCount: 0,
    };
  }

  const operations = products.map((product) => {
    const productOnInsert = {
      productCode: product.productCode,
      title: product.title,
      alias: product.title,
      originalPrice: 0,
    };

    if (product.barcode) {
      productOnInsert.barcode = product.barcode;
    }

    return {
      updateOne: {
        filter: { productCode: product.productCode },
        update: {
          $setOnInsert: productOnInsert,
        },
        upsert: true,
      },
    };
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
        $unset: {
          warehouse: "",
        },
      },
    },
  }));

  return Product.bulkWrite(operations, { ordered: false });
};

const updateAliasById = (id, alias) => {
  return Product.findByIdAndUpdate(
    id,
    { alias },
    { returnDocument: "after", runValidators: true }
  );
};

module.exports = {
  findAll,
  findById,
  findByProductCodes,
  ensureAliases,
  bulkUpsert,
  bulkCreateMissingWithZeroPrice,
  bulkUpdateWarehouseInventory,
  updateAliasById,
};
