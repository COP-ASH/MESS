const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Get weekly menu (accessible to all authenticated users)
router.get('/', authenticateToken, menuController.getMenu);

// Update menu details (Admin only)
router.post('/update', authenticateToken, requireRole('Admin'), menuController.updateMenu);

module.exports = router;
