const authService = require("./auth.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const login = asyncHandler(async (req, res) => {
    const result = await authService.login({
        username: req.body.username,
        password: req.body.password,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
    });

    res.status(200).json({
        success: true,
        data: result,
    });
});

const logout = asyncHandler(async (req, res) => {
    await authService.logout(req.session._id);

    res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
});

const logoutUserFromAllDevices = asyncHandler(async (req, res) => {
    await authService.logoutUserFromAllDevices(req.params.userId);

    res.status(200).json({
        success: true,
        message: "User logged out from all devices",
    });
});

module.exports = {
    login,
    logout,
    logoutUserFromAllDevices,
};