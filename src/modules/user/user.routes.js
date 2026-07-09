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

router.post(
    "/",
    allowRoles(ROLES.ADMIN),
    validate(createUserSchema),
    userController.createUser
);

router.get("/", allowRoles(ROLES.ADMIN), userController.getUsers);

router.get("/:id", allowRoles(ROLES.ADMIN), userController.getUserById);

router.patch(
    "/:id",
    allowRoles(ROLES.ADMIN),
    validate(updateUserSchema),
    userController.updateUser
);

router.delete(
    "/:id",
    allowRoles(ROLES.ADMIN),
    userController.deleteUser
);

module.exports = router;
