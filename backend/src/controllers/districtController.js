const districtService = require('../services/districtService');
const { sendSuccess } = require('../utils/response');

const listDistricts = async (req, res, next) => {
  try {
    const list = await districtService.listDistricts();
    return sendSuccess(res, list, 'Districts list retrieved.');
  } catch (error) {
    next(error);
  }
};

const getDistrict = async (req, res, next) => {
  try {
    const { id } = req.params;
    const district = await districtService.getDistrict(parseInt(id));
    return sendSuccess(res, district, 'District details retrieved.');
  } catch (error) {
    next(error);
  }
};

const createDistrict = async (req, res, next) => {
  try {
    const district = await districtService.createDistrict(req.body, req.user.id);
    return sendSuccess(res, district, 'District created successfully.', 201);
  } catch (error) {
    next(error);
  }
};

const updateDistrict = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await districtService.updateDistrict(parseInt(id), req.body, req.user.id);
    return sendSuccess(res, updated, 'District updated successfully.');
  } catch (error) {
    next(error);
  }
};

const deleteDistrict = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await districtService.deleteDistrict(parseInt(id), req.user.id);
    return sendSuccess(res, deleted, 'District deleted successfully.');
  } catch (error) {
    next(error);
  }
};

const updateCutoff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { morningCutoff, eveningCutoff } = req.body;
    const districtId = parseInt(id);

    // Check permissions: Must be Super Admin or the admin of this district
    if (req.user.role !== 'super_admin' && req.user.districtId !== districtId) {
      return res.status(403).json({ error: 'Access denied. You can only update your own district settings.' });
    }

    if (!morningCutoff || !eveningCutoff) {
      return res.status(400).json({ error: 'Both morning cutoff and evening cutoff times are required.' });
    }

    const updated = await districtService.updateDistrict(districtId, { morningCutoff, eveningCutoff }, req.user.id);
    return sendSuccess(res, updated, 'District cutoff settings updated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listDistricts,
  getDistrict,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  updateCutoff,
};
