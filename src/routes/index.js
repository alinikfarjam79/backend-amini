const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const companyRoutes = require("../modules/company/company.routes");
const productRoutes = require("../modules/product/product.routes");
const userRoutes = require("../modules/user/user.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/companies", companyRoutes);
router.use("/products", productRoutes);
router.use("/users", userRoutes);

module.exports = router;
