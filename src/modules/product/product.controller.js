const productService = require("./product.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const getProducts = asyncHandler(async (req, res) => {
  const result = await productService.getProducts(req.query, req.user.role);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.productId);

  res.status(200).json({ success: true, data: product });
});

const updateProductEnable = asyncHandler(async (req, res) => {
  const product = await productService.updateProductEnable(
    req.params.productId,
    req.body.enable
  );

  res.status(200).json({ success: true, data: product });
});

const updateProductAlias = asyncHandler(async (req, res) => {
  const product = await productService.updateProductAlias(
    req.params.productId,
    req.body
  );

  res.status(200).json({
    success: true,
    data: product,
  });
});

const updateProductThresholds = asyncHandler(async (req, res) => {
  const product = await productService.updateProductThresholds(
    req.params.productId,
    req.body
  );

  res.status(200).json({
    success: true,
    data: product,
  });
});

const uploadProductExcel = asyncHandler(async (req, res) => {
  const result = await productService.uploadProductExcel(req.file);

  res.status(200).json({
    success: true,
    message:
      result.invalidRows > 0 ||
      result.createdInvalidPriceProducts.length > 0 ||
      result.skippedInvalidPriceProducts.length > 0
        ? "Product Excel uploaded with row warnings"
        : "Product Excel uploaded successfully",
    data: result,
  });
});

module.exports = {
  getProducts,
  getProductById,
  updateProductEnable,
  updateProductAlias,
  updateProductThresholds,
  uploadProductExcel,
};
