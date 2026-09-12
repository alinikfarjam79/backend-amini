const express = require("express");

const companyController = require("./company.controller");
const uploadCompanyFile = require("./company.upload");
const validate = require("../../shared/middlewares/validate.middleware");
const protect = require("../../shared/middlewares/auth.middleware");
const allowRoles = require("../../shared/middlewares/permission.middleware");
const ROLES = require("../../shared/constants/roles");
const { createCompanySchema } = require("./company.validation");

const router = express.Router();

router.use(protect);

router.post("/files", uploadCompanyFile, companyController.uploadCompanyFile);
router.post("/:companyId/files", uploadCompanyFile, companyController.uploadCompanyFile);

router.use(allowRoles(ROLES.ADMIN));
router.post("/", validate(createCompanySchema), companyController.createCompany);
router.get("/", companyController.getCompanies);
router.delete(
  "/:companyId/files/:fileId",
  companyController.deleteCompanyFile
);

module.exports = router;
