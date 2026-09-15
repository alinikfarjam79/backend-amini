const Warehouse = require("./warehouse.model");

const create = (payload) => {
  return Warehouse.create(payload);
};

const populateItemProduct = {
  path: "items.product",
  select: "barcode originalPrice",
};

const findAll = (filter = {}) => {
  return Warehouse.find(filter).sort({ createdAt: -1 }).populate(populateItemProduct);
};

const findById = (id) => {
  return Warehouse.findById(id).populate(populateItemProduct);
};

const findSummaryById = (id) => {
  return Warehouse.findById(id)
    .select("_id name isDefault isActive createdAt updatedAt")
    .lean();
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

const replaceItemsByProductCodes = async (warehouseId, incomingItems) => {
  const warehouse = await Warehouse.findById(warehouseId)
    .select("_id name isDefault isActive createdAt updatedAt items.productCode")
    .lean();

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

  return {
    warehouse: {
      _id: warehouse._id,
      name: warehouse.name,
      isDefault: warehouse.isDefault,
      isActive: warehouse.isActive,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
      itemCount: existingCodes.size + newItems.length,
    },
    insertedItems: newItems.length,
    updatedItems: incomingItems.length - newItems.length,
  };
};

const getInventorySummaryPipeline = (matchStage, includeWarehouseLookup = true) => {
  return [
    { $unwind: "$items" },
    ...(matchStage ? [matchStage] : []),
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
    ...(includeWarehouseLookup
      ? [
          {
            $lookup: {
              from: "warehouses",
              localField: "warehouses",
              foreignField: "_id",
              as: "warehouses",
              pipeline: [
                {
                  $project: {
                    items: 0,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ];
};

const getInventorySummaries = () => {
  return Warehouse.aggregate(getInventorySummaryPipeline()).allowDiskUse(true);
};

const getInventorySummariesByProductCodes = (productCodes) => {
  if (!Array.isArray(productCodes) || productCodes.length === 0) {
    return [];
  }

  return Warehouse.aggregate(
    getInventorySummaryPipeline({
      $match: { "items.productCode": { $in: productCodes } },
    })
  ).allowDiskUse(true);
};

const getInventorySummariesForProductUpdate = (productCodes) => {
  if (!Array.isArray(productCodes) || productCodes.length === 0) {
    return [];
  }

  return Warehouse.aggregate(
    getInventorySummaryPipeline(
      {
        $match: { "items.productCode": { $in: productCodes } },
      },
      false
    )
  ).allowDiskUse(true);
};

module.exports = {
  create,
  findAll,
  findById,
  findSummaryById,
  findByName,
  bulkCreateDefaults,
  getInventorySummaries,
  getInventorySummariesByProductCodes,
  getInventorySummariesForProductUpdate,
  replaceItemsByProductCodes,
};
