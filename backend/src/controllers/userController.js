const userService = require('../services/userService');
const { sendSuccess } = require('../utils/response');

const listUsers = async (req, res, next) => {
  try {
    const list = await userService.listUsers(req.user);
    return sendSuccess(res, list, 'Users list retrieved.');
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.getUser(parseInt(id), req.user);
    return sendSuccess(res, user, 'User details retrieved.');
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body, req.user.id, req.user.role, req.user.districtId);
    return sendSuccess(res, user, 'User created successfully.', 201);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await userService.updateUser(parseInt(id), req.body, req.user);
    return sendSuccess(res, updated, 'User updated successfully.');
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await userService.deleteUser(parseInt(id), req.user);
    return sendSuccess(res, deleted, 'User deleted successfully.');
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const results = await userService.searchUsers(q || '', req.user);
    return sendSuccess(res, results, 'Search results retrieved.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  searchUsers,
};
