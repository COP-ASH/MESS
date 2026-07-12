const express = require('express');
const settingsController = require('../controllers/settingsController');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, requireSuperAdmin, settingsController.getSettings);
router.put('/', authenticate, requireSuperAdmin, settingsController.updateSettings);

module.exports = router;
