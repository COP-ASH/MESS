const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Get bill history (all for admin, personal for personnel)
router.get('/', authenticateToken, billController.getBills);

// Get current meal rates
router.get('/rates', authenticateToken, billController.getRates);

// Set meal rates (Admin only)
router.post('/rates', authenticateToken, requireRole('Admin'), billController.setRates);

// Generate monthly bills (Admin only)
router.post('/generate', authenticateToken, requireRole('Admin'), billController.generateMonthlyBills);

// Mark bill as paid (Admin only)
router.post('/pay', authenticateToken, requireRole('Admin'), billController.markBillAsPaid);

module.exports = router;
