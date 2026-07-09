const userService = require("./user.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const createInitialUser = asyncHandler(async (req, res) => {
    const user = await userService.createInitialUser(req.body);

    res.status(201).json({
        success: true,
        data: user,
    });
});

const createUser = asyncHandler(async (req, res) => {
    const user = await userService.createUser(req.body);

    res.status(201).json({
        success: true,
        data: user,
    });
});

const getUsers = asyncHandler(async (req, res) => {
    const users = await userService.getUsers();

    res.status(200).json({
        success: true,
        data: users,
    });
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);

    res.status(200).json({
        success: true,
        data: user,
    });
});

const updateUser = asyncHandler(async (req, res) => {
    const user = await userService.updateUser(req.params.id, req.body);

    res.status(200).json({
        success: true,
        data: user,
    });
});

const deleteUser = asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id);

    res.status(200).json({
        success: true,
        message: "User deleted successfully",
    });
});

module.exports = {
    createUser,
    createInitialUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
};
