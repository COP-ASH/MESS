const express = require('express');
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { changePasswordSchema } = require('../validators/userValidator');

const router = express.Router();

router.get('/', authenticate, profileController.getProfile);
router.put('/', authenticate, profileController.updateProfile);
router.put('/change-password', authenticate, validate(changePasswordSchema), profileController.changePassword);

module.exports = router;
