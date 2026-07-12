const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, notificationController.listNotices);
router.post('/', authenticate, requireAdmin, notificationController.createNotice);
router.delete('/:id', authenticate, requireAdmin, notificationController.deleteNotice);

module.exports = router;
