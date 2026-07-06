const bcrypt = require("bcryptjs");

const userRepository = require("./user.repository");
const AppError = require("../../shared/utils/AppError");
const pick = require("../../shared/utils/pick");
const ROLES = require("../../shared/constants/roles");

const createInitialUser = async (payload) => {
  const existingUser = await userRepository.findByUsername(payload.username);

  if (existingUser) {
    throw new AppError("Username already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  const user = await userRepository.create({
    username: payload.username,
    password: hashedPassword,
    role: payload.role || ROLES.USER,
  });

  return {
    id: user._id,
    username: user.username,
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
  const allowedData = pick(payload, ["username", "isActive"]);

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
