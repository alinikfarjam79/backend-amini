const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/user/user.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);

module.exports = router;