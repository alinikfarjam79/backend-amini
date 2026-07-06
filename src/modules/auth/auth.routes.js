const express = require("express");

const authController = require("./auth.controller");

const validate = require("../../shared/middlewares/validate.middleware");
const protect = require("../../shared/middlewares/auth.middleware");
const allowRoles = require("../../shared/middlewares/permission.middleware");
const loginRateLimiter = require("../../shared/middlewares/loginRateLimit.middleware");

const ROLES = require("../../shared/constants/roles");

const { loginSchema } = require("./auth.validation");

const router = express.Router();

router.post(
    "/login",
    loginRateLimiter,
    validate(loginSchema),
    authController.login
);

router.post(
    "/logout",
    protect,
    authController.logout
);

router.post(
    "/users/:userId/logout-all",
    protect,
    allowRoles(ROLES.ADMIN),
    authController.logoutUserFromAllDevices
);

module.exports = router;