const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Post router to request email OTP verification
router.post('/send-otp', authController.sendOtp);

module.exports = router;
