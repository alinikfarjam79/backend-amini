const Warehouse = require("./warehouse.model");

const create = (payload) => {
  return Warehouse.create(payload);
};

const findAll = (filter = {}) => {
  return Warehouse.find(filter).sort({ createdAt: -1 }).populate("items.product");
};

const findById = (id) => {
  return Warehouse.findById(id).populate("items.product");
};

const findByName = (name) => {
  return Warehouse.findOne({ name });
};

const bulkCreateDefaults = (names) => {
  const operations = names.map((name) => ({
    updateOne: {
      filter: { name },
      update: {
        $setOnInsert: {
          name,
          isDefault: true,
          isActive: true,
          items: [],
        },
      },
      upsert: true,
    },
  }));

  return Warehouse.bulkWrite(operations, { ordered: false });
};

const replaceItemsByProductCodes = (warehouseId, incomingItems) => {
  return Warehouse.findById(warehouseId).then(async (warehouse) => {
    if (!warehouse) {
      return null;
    }

    const existingCodes = new Set(
      warehouse.items.map((item) => item.productCode)
    );
    const newItems = incomingItems.filter(
      (item) => !existingCodes.has(item.productCode)
    );

    const updateOperations = incomingItems
      .filter((item) => existingCodes.has(item.productCode))
      .map((item) => ({
        updateOne: {
          filter: {
            _id: warehouseId,
            "items.productCode": item.productCode,
          },
          update: {
            $set: {
              "items.$.product": item.product,
              "items.$.productCode": item.productCode,
              "items.$.title": item.title,
              "items.$.quantity": item.quantity,
            },
          },
        },
      }));

    if (newItems.length > 0) {
      updateOperations.push({
        updateOne: {
          filter: { _id: warehouseId },
          update: { $push: { items: { $each: newItems } } },
        },
      });
    }

    if (updateOperations.length > 0) {
      await Warehouse.bulkWrite(updateOperations, { ordered: false });
    }

    return Warehouse.findById(warehouseId).populate("items.product");
  });
};

const getInventorySummariesByProductCodes = (productCodes) => {
  return Warehouse.aggregate([
    { $unwind: "$items" },
    { $match: { "items.productCode": { $in: productCodes } } },
    {
      $group: {
        _id: "$items.productCode",
        quantity: { $sum: "$items.quantity" },
        warehouses: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 0,
        productCode: "$_id",
        quantity: 1,
        warehouses: 1,
      },
    },
  ]);
};

module.exports = {
  create,
  findAll,
  findById,
  findByName,
  bulkCreateDefaults,
  getInventorySummariesByProductCodes,
  replaceItemsByProductCodes,
};
