const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// Get bills list
router.get('/', authenticate, billController.getBills);

// Retrieve billing unit rates
router.get('/rates', authenticate, billController.getRates);

// Update meal cost rates (Admin only)
router.post('/rates', authenticate, requireAdmin, billController.setRates);

// Execute batch generate monthly bills (Admin only)
router.post('/generate', authenticate, requireAdmin, billController.generateMonthlyBills);

// Record manual cash/online payment collection (Admin only)
router.post('/pay', authenticate, requireAdmin, billController.markBillAsPaid);

module.exports = router;
