const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// OTP dispatch endpoint
router.post('/send-otp', authController.sendOtp);

// Personnel registration endpoint
router.post('/register', authController.register);

// Authentication endpoint (protected by rate limiting)
router.post('/login', loginRateLimiter, authController.login);

module.exports = router;
