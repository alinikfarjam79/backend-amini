const bcrypt = require("bcryptjs");

const userRepository = require("./user.repository");
const AppError = require("../../shared/utils/AppError");
const pick = require("../../shared/utils/pick");
const ROLES = require("../../shared/constants/roles");
const LOGIN_METHODS = require("../../shared/constants/loginMethods");
const { normalizeIranPhoneNumber } = require("../../shared/utils/phoneNumber");

const createInitialUser = async (payload) => {
  const phoneNumber = normalizeIranPhoneNumber(payload.phoneNumber);
  const existingUser = await userRepository.findByPhoneNumber(phoneNumber);

  if (existingUser) {
    throw new AppError("Phone number already exists", 409);
  }

  const loginMethod = payload.loginMethod || LOGIN_METHODS.PASSWORD;
  const hashedPassword = payload.password
    ? await bcrypt.hash(payload.password, 12)
    : undefined;
  const hashedOtpCode = payload.otpCode
    ? await bcrypt.hash(payload.otpCode, 12)
    : undefined;

  const user = await userRepository.create({
    username: payload.username,
    phoneNumber,
    loginMethod,
    password: hashedPassword,
    otpCode: hashedOtpCode,
    otpExpiresAt: payload.otpExpiresAt,
    role: payload.role || ROLES.USER,
  });

  return {
    id: user._id,
    username: user.username,
    phoneNumber: user.phoneNumber,
    loginMethod: user.loginMethod,
    role: user.role,
    isActive: user.isActive,
  };
};

const getUsers = async () => {
  return userRepository.findAll();
};

const getUserById = async (id) => {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const updateUser = async (id, payload) => {
  const allowedData = pick(payload, [
    "username",
    "phoneNumber",
    "loginMethod",
    "password",
    "otpCode",
    "otpExpiresAt",
    "isActive",
  ]);

  if (allowedData.phoneNumber) {
    allowedData.phoneNumber = normalizeIranPhoneNumber(allowedData.phoneNumber);
  }

  if (allowedData.password) {
    allowedData.password = await bcrypt.hash(allowedData.password, 12);
  }

  if (allowedData.otpCode) {
    allowedData.otpCode = await bcrypt.hash(allowedData.otpCode, 12);
  }

  const user = await userRepository.updateById(id, allowedData);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const deleteUser = async (id) => {
  const user = await userRepository.softDeleteById(id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return true;
};

module.exports = {
  createInitialUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
