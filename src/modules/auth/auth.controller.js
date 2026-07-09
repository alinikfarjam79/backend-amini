const authService = require("./auth.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const login = asyncHandler(async (req, res) => {
    const result = await authService.login({
        phoneNumber: req.body.phoneNumber,
        password: req.body.password,
        otpCode: req.body.otpCode,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
    });

    res.status(200).json({
        success: true,
        data: result,
    });
});

const getLoginMethod = asyncHandler(async (req, res) => {
    const result = await authService.getLoginMethod(req.body.phoneNumber);

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
    getLoginMethod,
    logout,
    logoutUserFromAllDevices,
};
