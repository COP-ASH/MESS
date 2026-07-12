const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createUserSchema, updateUserSchema } = require('../validators/userValidator');

const router = express.Router();

// Apply administrative auth guards to user management endpoints
router.get('/', authenticate, requireAdmin, userController.listUsers);
router.get('/search', authenticate, requireAdmin, userController.searchUsers);
router.get('/:id', authenticate, userController.getUser);
router.post('/', authenticate, requireAdmin, validate(createUserSchema), userController.createUser);
router.put('/:id', authenticate, requireAdmin, validate(updateUserSchema), userController.updateUser);
router.delete('/:id', authenticate, requireAdmin, userController.deleteUser);

module.exports = router;
