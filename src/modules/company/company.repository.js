const Company = require("./company.model");

const create = (payload) => {
  return Company.create(payload);
};

const findAll = (filter = {}) => {
  return Company.find(filter).sort({ createdAt: -1 });
};

const findById = (id) => {
  return Company.findById(id);
};

const findByCode = (code) => {
  return Company.findOne({ code });
};

const findByName = (name) => {
  return Company.findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
};

const addFilesById = (id, files) => {
  return Company.findByIdAndUpdate(
    id,
    { $push: { files: { $each: files } } },
    { returnDocument: "after", runValidators: true }
  );
};

const removeFileById = (companyId, fileId) => {
  return Company.findByIdAndUpdate(
    companyId,
    { $pull: { files: { _id: fileId } } },
    { returnDocument: "after" }
  );
};

const updateFileTitleById = (companyId, fileId, title) => {
  return Company.findOneAndUpdate(
    { _id: companyId, "files._id": fileId },
    { $set: { "files.$.title": title } },
    { returnDocument: "after", runValidators: true }
  );
};

const findWithPdfPages = () => {
  return Company.find({ "files.sourceType": "pdf-page" })
    .select("_id files")
    .lean();
};

const bulkUpdateFileOrder = (companies) => {
  if (!Array.isArray(companies) || companies.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return Company.bulkWrite(
    companies.map((company) => ({
      updateOne: {
        filter: { _id: company._id },
        update: { $set: { files: company.files } },
      },
    })),
    { ordered: false }
  );
};

module.exports = {
  create,
  findAll,
  findById,
  findByCode,
  findByName,
  addFilesById,
  removeFileById,
  updateFileTitleById,
  findWithPdfPages,
  bulkUpdateFileOrder,
};
