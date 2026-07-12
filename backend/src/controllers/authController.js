const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

const requestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.requestOtp(email);
    return sendSuccess(res, result, 'Verification OTP dispatched.');
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return sendSuccess(res, result, 'Registration completed successfully.', 210);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return sendSuccess(res, result, 'Login authenticated.');
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    return sendSuccess(res, result, 'Access token refreshed.');
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.logout(refreshToken);
    return sendSuccess(res, result, 'Logged out.');
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return sendSuccess(res, result, 'Reset verification code dispatched.');
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const result = await authService.resetPassword(email, otp, newPassword);
    return sendSuccess(res, result, 'Password reset successful.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
