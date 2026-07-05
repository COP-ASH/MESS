const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Get personal user profile
router.get('/profile', authenticateToken, userController.getProfile);

// Update profile details
router.post('/profile', authenticateToken, userController.updateProfile);

// List users (Admin only)
router.get('/list', authenticateToken, requireRole('Admin'), userController.getUsersList);

// Set status (Admin only)
router.post('/status', authenticateToken, requireRole('Admin'), userController.updateUserStatus);

// Export attendance report as CSV (Admin only)
router.get('/export-attendance', authenticateToken, requireRole('Admin'), userController.exportAttendanceCsv);

module.exports = router;
