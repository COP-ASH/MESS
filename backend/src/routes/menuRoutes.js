const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// Get weekly menu (accessible to all authenticated users)
router.get('/', authenticate, menuController.getMenu);

// Update menu details (Admin only)
router.post('/update', authenticate, requireAdmin, menuController.updateMenu);

module.exports = router;
