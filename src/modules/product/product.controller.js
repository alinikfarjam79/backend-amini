const productService = require("./product.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const getProducts = asyncHandler(async (req, res) => {
  const result = await productService.getProducts(req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const uploadProductExcel = asyncHandler(async (req, res) => {
  const result = await productService.uploadProductExcel(req.file);

  res.status(200).json({
    success: true,
    message:
      result.invalidRows > 0
        ? "Product Excel uploaded with row errors"
        : "Product Excel uploaded successfully",
    data: result,
  });
});

module.exports = {
  getProducts,
  uploadProductExcel,
};
