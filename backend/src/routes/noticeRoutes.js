const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// Get all notices feed (accessible to all logged-in users)
router.get('/', authenticate, noticeController.getNotices);

// Post a new official notice (Admin only)
router.post('/', authenticate, requireAdmin, noticeController.createNotice);

module.exports = router;
