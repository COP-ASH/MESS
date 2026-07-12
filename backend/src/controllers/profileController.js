const userService = require('../services/userService');
const { sendSuccess } = require('../utils/response');

const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getUser(req.user.id, req.user);
    return sendSuccess(res, user, 'Profile details retrieved.');
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName } = req.body;
    // Simple users can only update their name
    const updated = await userService.updateUser(req.user.id, { fullName }, req.user);
    return sendSuccess(res, updated, 'Profile updated successfully.');
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await userService.changePassword(req.user.id, currentPassword, newPassword);
    return sendSuccess(res, result, 'Password changed successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};
