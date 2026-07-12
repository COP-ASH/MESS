const express = require('express');
const districtController = require('../controllers/districtController');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createDistrictSchema, updateDistrictSchema } = require('../validators/districtValidator');

const router = express.Router();

// Public route to retrieve active districts list for registration select inputs
router.get('/public', async (req, res, next) => {
  try {
    const list = await require('../services/districtService').listDistricts();
    const activeOnly = list.filter(d => d.status === 'active').map(d => ({
      id: d.id,
      districtName: d.districtName,
      districtCode: d.districtCode
    }));
    return require('../utils/response').sendSuccess(res, activeOnly, 'Active districts list.');
  } catch (error) {
    next(error);
  }
});

// Admin-only district CRUD operations
router.get('/', authenticate, requireSuperAdmin, districtController.listDistricts);
router.get('/:id', authenticate, districtController.getDistrict);
router.post('/', authenticate, requireSuperAdmin, validate(createDistrictSchema), districtController.createDistrict);
router.put('/:id', authenticate, requireSuperAdmin, validate(updateDistrictSchema), districtController.updateDistrict);
router.put('/:id/cutoff', authenticate, districtController.updateCutoff);
router.delete('/:id', authenticate, requireSuperAdmin, districtController.deleteDistrict);

module.exports = router;
