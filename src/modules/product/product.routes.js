const express = require("express");

const productController = require("./product.controller");
const uploadProductExcel = require("./product.upload");
const protect = require("../../shared/middlewares/auth.middleware");
const allowRoles = require("../../shared/middlewares/permission.middleware");
const ROLES = require("../../shared/constants/roles");

const router = express.Router();

router.use(protect);

router.get("/", productController.getProducts);

const uploadExcelMiddlewares = [
  allowRoles(ROLES.ADMIN),
  uploadProductExcel,
  productController.uploadProductExcel,
];

router.post("/upload-excel", uploadExcelMiddlewares);
router.post("/upload", uploadExcelMiddlewares);

module.exports = router;
