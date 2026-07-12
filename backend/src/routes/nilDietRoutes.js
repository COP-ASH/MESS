const express = require('express');
const router = express.Router();
const nilDietController = require('../controllers/nilDietController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// Submit a new Nil Diet Request (Members)
router.post('/', authenticate, nilDietController.submitRequest);

// Retrieve requests (Admin view district requests / Member view personal requests)
router.get('/', authenticate, nilDietController.getRequests);

// Approve request (Admin only)
router.post('/:id/approve', authenticate, requireAdmin, nilDietController.approveRequest);

// Reject request (Admin only)
router.post('/:id/reject', authenticate, requireAdmin, nilDietController.rejectRequest);

// Delete request (Admin or Owner Member)
router.delete('/:id', authenticate, nilDietController.deleteRequest);

module.exports = router;
