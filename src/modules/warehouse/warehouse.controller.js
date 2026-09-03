const warehouseService = require("./warehouse.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const createWarehouse = asyncHandler(async (req, res) => {
  const warehouse = await warehouseService.createWarehouse(req.body);

  res.status(201).json({
    success: true,
    data: warehouse,
  });
});

const getWarehouses = asyncHandler(async (req, res) => {
  const warehouses = await warehouseService.getWarehouses();

  res.status(200).json({
    success: true,
    data: warehouses,
  });
});

const getWarehouseItems = asyncHandler(async (req, res) => {
  const items = await warehouseService.getWarehouseItems(req.params.warehouseId);

  res.status(200).json({
    success: true,
    data: items,
  });
});

const uploadWarehouseProductsExcel = asyncHandler(async (req, res) => {
  const result = await warehouseService.uploadWarehouseProductsExcel({
    warehouseId: req.params.warehouseId,
    file: req.file,
  });

  res.status(200).json({
    success: true,
    message: "Warehouse products Excel uploaded successfully",
    data: result,
  });
});

module.exports = {
  createWarehouse,
  getWarehouseItems,
  getWarehouses,
  uploadWarehouseProductsExcel,
};
