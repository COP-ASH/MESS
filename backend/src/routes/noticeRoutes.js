const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Get all notices feed (accessible to all logged-in users)
router.get('/', authenticateToken, noticeController.getNotices);

// Post a new official notice (Admin only)
router.post('/', authenticateToken, requireRole('Admin'), noticeController.createNotice);

module.exports = router;
