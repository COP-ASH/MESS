const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route to get all users
router.get('/', userController.getUsers);

// Route to create a new user (with OTP verification validation)
router.post('/', userController.createUser);

module.exports = router;
