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
    "productCode title enable"
  );
};

const ensureEnableDefaults = () => {
  return Product.updateMany(
    { enable: { $exists: false } },
    { $set: { enable: true } }
  );
};

const ensureAliases = async () => {
  const products = await Product.find({
      enable: { $ne: false },
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

const ensureThresholdDefaults = async () => {
  const updates = [
    ["warningThreshold", 15],
    ["criticalThreshold", 10],
  ];

  const thresholdResults = await Promise.all(
    updates.map(([field, value]) =>
      Product.updateMany(
        {
          enable: { $ne: false },
          $or: [{ [field]: { $exists: false } }, { [field]: null }],
        },
        { $set: { [field]: value } }
      )
    )
  );

  const legacyDisabledResult = await Product.updateMany(
    {
      enable: { $ne: false },
      $and: [
        {
          $or: [
            { thresholdEnabled: { $exists: false } },
            { thresholdEnabled: null },
          ],
        },
        {
          $or: [
            { warningThresholdEnabled: false },
            { criticalThresholdEnabled: false },
          ],
        },
      ],
    },
    { $set: { thresholdEnabled: false } }
  );
  const enabledDefaultResult = await Product.updateMany(
    {
      enable: { $ne: false },
      $or: [
        { thresholdEnabled: { $exists: false } },
        { thresholdEnabled: null },
      ],
    },
    { $set: { thresholdEnabled: true } }
  );
  const legacyCleanupResult = await Product.updateMany(
    {
      enable: { $ne: false },
      $or: [
        { warningThresholdEnabled: { $exists: true } },
        { criticalThresholdEnabled: { $exists: true } },
      ],
    },
    {
      $unset: {
        warningThresholdEnabled: "",
        criticalThresholdEnabled: "",
      },
    }
  );
  const results = [
    ...thresholdResults,
    legacyDisabledResult,
    enabledDefaultResult,
    legacyCleanupResult,
  ];

  return {
    matchedCount: results.reduce(
      (total, result) => total + (result.matchedCount || 0),
      0
    ),
    modifiedCount: results.reduce(
      (total, result) => total + (result.modifiedCount || 0),
      0
    ),
  };
};

const bulkUpsert = (products, existingProductCodes = new Set()) => {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      upsertedCount: 0,
      modifiedCount: 0,
      matchedCount: 0,
    };
  }

  const operations = products.map((product) => ({
    updateOne: {
      filter: existingProductCodes.has(product.productCode)
        ? { productCode: product.productCode, enable: { $ne: false } }
        : { productCode: product.productCode },
      update: {
        $set: product,
        $setOnInsert: {
          alias: product.title,
        },
      },
      upsert: !existingProductCodes.has(product.productCode),
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
      filter: { productCode: item.productCode, enable: { $ne: false } },
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
  return Product.findOneAndUpdate(
    { _id: id, enable: { $ne: false } },
    { alias },
    { returnDocument: "after", runValidators: true }
  );
};

const updateThresholdsById = (id, thresholds) => {
  return Product.findOneAndUpdate(
    { _id: id, enable: { $ne: false } },
    thresholds,
    {
      returnDocument: "after",
      runValidators: true,
    }
  )
    .populate({
      path: "warehouses",
      select: "-items",
    })
    .lean();
};

const updateEnableById = (id, enable) => {
  return Product.findOneAndUpdate(
    enable ? { _id: id } : { _id: id, enable: { $ne: false } },
    { enable },
    { returnDocument: "after", runValidators: true }
  )
    .populate({ path: "warehouses", select: "-items" })
    .lean();
};

module.exports = {
  findAll,
  findById,
  findByProductCodes,
  ensureEnableDefaults,
  ensureAliases,
  ensureThresholdDefaults,
  bulkUpsert,
  bulkCreateMissingWithZeroPrice,
  bulkUpdateWarehouseInventory,
  updateAliasById,
  updateThresholdsById,
  updateEnableById,
};
