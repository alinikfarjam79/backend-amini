const express = require("express");

const warehouseController = require("./warehouse.controller");
const uploadWarehouseExcel = require("./warehouse.upload");
const validate = require("../../shared/middlewares/validate.middleware");
const protect = require("../../shared/middlewares/auth.middleware");
const allowRoles = require("../../shared/middlewares/permission.middleware");
const ROLES = require("../../shared/constants/roles");
const { createWarehouseSchema } = require("./warehouse.validation");

const router = express.Router();

router.use(protect);
router.use(allowRoles(ROLES.ADMIN));

router.post("/", validate(createWarehouseSchema), warehouseController.createWarehouse);
router.get("/", warehouseController.getWarehouses);
router.get("/:warehouseId/items", warehouseController.getWarehouseItems);
router.post(
  "/:warehouseId/products/upload-excel",
  uploadWarehouseExcel,
  warehouseController.uploadWarehouseProductsExcel
);

module.exports = router;
