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
    { new: true, runValidators: true }
  );
};

module.exports = {
  create,
  findAll,
  findById,
  findByCode,
  findByName,
  addFilesById,
};
