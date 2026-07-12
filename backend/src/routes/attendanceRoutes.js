const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// Submit meal attendance logs (Admin only)
router.post('/', authenticate, requireAdmin, attendanceController.markAttendance);

// Retrieve personal attendance logs history
router.get('/history', authenticate, attendanceController.getAttendanceHistory);

// Retrieve aggregate daily counts (Admin only)
router.get('/summary', authenticate, requireAdmin, attendanceController.getDailyAttendanceSummary);

// Retrieve attendance history for a specific member (Admin only)
router.get('/member/:userId', authenticate, requireAdmin, attendanceController.getMemberAttendanceHistory);

module.exports = router;
