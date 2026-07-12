const DistrictRepository = require('../repositories/districtRepository');
const UserRepository = require('../repositories/userRepository');
const { logAction } = require('./logService');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const listDistricts = async () => {
  return DistrictRepository.findAll();
};

const getDistrict = async (id) => {
  const district = await DistrictRepository.findById(id);
  if (!district) {
    throw new NotFoundError('District not found.');
  }
  return district;
};

const createDistrict = async (districtData, adminUserId) => {
  const existingCode = await DistrictRepository.findByCode(districtData.districtCode);
  if (existingCode) {
    throw new BadRequestError('District code is already registered.');
  }

  const district = await DistrictRepository.create({
    districtName: districtData.districtName,
    districtCode: districtData.districtCode.toUpperCase(),
    status: districtData.status || 'active',
  });

  await logAction(adminUserId, 'DISTRICT_CREATION', `Created district "${district.districtName}" with code "${district.districtCode}"`);
  return district;
};

const updateDistrict = async (id, updateData, adminUserId) => {
  const district = await DistrictRepository.findById(id);
  if (!district) {
    throw new NotFoundError('District not found.');
  }

  // If assigning a new admin, check if that user exists and is a district admin
  if (updateData.adminId) {
    const user = await UserRepository.findById(updateData.adminId);
    if (!user) {
      throw new NotFoundError('Assigned admin user not found.');
    }
    if (user.role !== 'district_admin') {
      throw new BadRequestError('Assigned user must be a District Admin.');
    }

    // Ensure this admin is not already assigned to another district
    const districtsList = await DistrictRepository.findAll();
    const duplicateAdmin = districtsList.find(d => d.adminId === updateData.adminId && d.id !== parseInt(id));
    if (duplicateAdmin) {
      throw new BadRequestError(`This admin is already assigned to district "${duplicateAdmin.districtName}".`);
    }
  }

  const updated = await DistrictRepository.update(id, updateData);

  // If admin was assigned, make sure that user's districtId is also updated to this district!
  if (updateData.adminId) {
    await UserRepository.update(updateData.adminId, { districtId: parseInt(id) });
  }

  await logAction(adminUserId, 'DISTRICT_UPDATE', `Updated district ID ${id}. Changed values: ${JSON.stringify(updateData)}`);
  return updated;
};

const deleteDistrict = async (id, adminUserId) => {
  const district = await DistrictRepository.findById(id);
  if (!district) {
    throw new NotFoundError('District not found.');
  }

  // Check if there are users registered in this district
  const usersCount = await UserRepository.countByDistrictId(id);
  if (usersCount > 0) {
    throw new BadRequestError('Cannot delete district because it contains registered users. Deactivate it instead.');
  }

  const deleted = await DistrictRepository.delete(id);
  await logAction(adminUserId, 'DISTRICT_DELETION', `Deleted district ID ${id} ("${district.districtName}")`);
  return deleted;
};

module.exports = {
  listDistricts,
  getDistrict,
  createDistrict,
  updateDistrict,
  deleteDistrict,
};
