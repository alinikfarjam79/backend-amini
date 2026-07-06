const express = require("express");

const userController = require("./user.controller");
const validate = require("../../shared/middlewares/validate.middleware");
const protect = require("../../shared/middlewares/auth.middleware");
const allowRoles = require("../../shared/middlewares/permission.middleware");
const ROLES = require("../../shared/constants/roles");

const {
    createUserSchema,
    updateUserSchema,
} = require("./user.validation");

const router = express.Router();

router.post(
    "/initial",
    validate(createUserSchema),
    userController.createInitialUser
);

router.use(protect);

router.get("/", allowRoles(ROLES.ADMIN), userController.getUsers);

router.get("/:id", userController.getUserById);

router.patch(
    "/:id",
    validate(updateUserSchema),
    userController.updateUser
);

router.delete(
    "/:id",
    allowRoles(ROLES.ADMIN),
    userController.deleteUser
);

module.exports = router;