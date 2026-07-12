const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middleware/validationMiddleware');
const { authRateLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  getOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidator');

const router = express.Router();

// Apply rate limits on sensitive authentication endpoints
router.post('/otp', authRateLimiter, validate(getOtpSchema), authController.requestOtp);
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
