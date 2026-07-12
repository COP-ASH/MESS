const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, requireAdmin, reportController.generateReport);

module.exports = router;
