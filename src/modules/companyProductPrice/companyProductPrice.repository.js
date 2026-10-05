const CompanyProductPrice = require("./companyProductPrice.model");

const findAll = (filter = {}) => {
  return CompanyProductPrice.find(filter).sort({ companyName: 1, title: 1 }).lean();
};

const findHistory = (filter = {}) => {
  return CompanyProductPrice.find(filter).sort({ createdAt: -1, title: 1 }).lean();
};

const createVersions = async (products) => {
  if (!products.length) {
    return { insertedCount: 0, replacedCurrentCount: 0 };
  }

  const session = await CompanyProductPrice.db.startSession();
  let insertedCount = 0;
  let replacedCurrentCount = 0;

  try {
    await session.withTransaction(async () => {
      const identityKeys = products.map((product) => product.identityKey);
      const replaced = await CompanyProductPrice.updateMany(
        { identityKey: { $in: identityKeys }, isCurrent: true },
        { $set: { isCurrent: false } },
        { session }
      );
      const inserted = await CompanyProductPrice.insertMany(
        products.map((product) => ({ ...product, isCurrent: true })),
        { session, ordered: true }
      );

      replacedCurrentCount = replaced.modifiedCount || 0;
      insertedCount = inserted.length;
    });
  } finally {
    await session.endSession();
  }

  return { insertedCount, replacedCurrentCount };
};

const syncIndexes = () => CompanyProductPrice.syncIndexes();

module.exports = {
  findAll,
  findHistory,
  createVersions,
  syncIndexes,
};
