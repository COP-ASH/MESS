const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Log daily meal attendance choices (personnel)
router.post('/', authenticateToken, attendanceController.markAttendance);

// Retrieve personal attendance history (personnel)
router.get('/history', authenticateToken, attendanceController.getAttendanceHistory);

// Get total meal count summary (Admin only)
router.get('/summary', authenticateToken, requireRole('Admin'), attendanceController.getDailyAttendanceSummary);

module.exports = router;
