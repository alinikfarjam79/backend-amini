const asyncHandler = require("../../shared/utils/asyncHandler");
const service = require("./companyProductPrice.service");

const getProducts = asyncHandler(async (req, res) => {
  const products = await service.getProducts(req.query);
  res.status(200).json({ success: true, data: products });
});

const getHistory = asyncHandler(async (req, res) => {
  const products = await service.getHistory(req.query);
  res.status(200).json({ success: true, data: products });
});

const uploadExcel = asyncHandler(async (req, res) => {
  const result = await service.uploadExcel({
    file: req.file,
    companyName: req.body.companyName || req.body.company || req.body.name,
    uploadDate: req.body.uploadDate || req.body.date,
  });

  res.status(200).json({
    success: true,
    message: result.invalidRows
      ? "Company product prices uploaded with row warnings"
      : "Company product prices uploaded successfully",
    data: result,
  });
});

module.exports = { getHistory, getProducts, uploadExcel };
