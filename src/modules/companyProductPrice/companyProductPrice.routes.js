const express = require("express");

const protect = require("../../shared/middlewares/auth.middleware");
const allowRoles = require("../../shared/middlewares/permission.middleware");
const ROLES = require("../../shared/constants/roles");
const controller = require("./companyProductPrice.controller");
const uploadExcel = require("./companyProductPrice.upload");

const router = express.Router();

router.use(protect);
router.use(allowRoles(ROLES.ADMIN));
router.get("/history", controller.getHistory);
router.get("/", controller.getProducts);
router.post(
  "/upload-excel",
  uploadExcel,
  controller.uploadExcel
);

module.exports = router;
