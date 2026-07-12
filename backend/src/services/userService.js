const UserRepository = require('../repositories/userRepository');
const DistrictRepository = require('../repositories/districtRepository');
const { hashPassword, comparePassword } = require('../utils/password');
const { logAction } = require('./logService');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

const listUsers = async (requestingUser) => {
  if (requestingUser.role === 'super_admin') {
    return UserRepository.findAll();
  } else if (requestingUser.role === 'district_admin') {
    return UserRepository.findAllByDistrictId(requestingUser.districtId);
  } else {
    throw new ForbiddenError('You do not have permission to view users list.');
  }
};

const getUser = async (id, requestingUser) => {
  const user = await UserRepository.findById(id);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  // Isolation check: District Admins can only view users in their own district
  if (requestingUser.role === 'district_admin' && user.districtId !== requestingUser.districtId) {
    throw new ForbiddenError('You can only view users inside your own district.');
  }

  return user;
};

const createUser = async (userData, adminUserId, requestingUserRole, requestingUserDistrictId) => {
  const existingUser = await UserRepository.findByEmail(userData.email);
  if (existingUser) {
    throw new BadRequestError('Email address is already in use.');
  }

  let finalDistrictId = userData.districtId;
  let finalRole = userData.role || 'user';

  // Enforcement: District Admins can only create simple users for their own district
  if (requestingUserRole === 'district_admin') {
    finalDistrictId = requestingUserDistrictId;
    finalRole = 'user'; // Force user role
  }

  // Ensure district exists and is active
  if (finalDistrictId) {
    const district = await DistrictRepository.findById(finalDistrictId);
    if (!district) {
      throw new NotFoundError('Selected district does not exist.');
    }
    if (district.status !== 'active') {
      throw new BadRequestError('Cannot register users in an inactive district.');
    }
  } else if (finalRole !== 'super_admin') {
    throw new BadRequestError('District assignment is required for this role.');
  }

  const hashedPassword = await hashPassword(userData.password);

  const newUser = await UserRepository.create({
    fullName: userData.fullName,
    email: userData.email,
    passwordHash: hashedPassword,
    role: finalRole,
    districtId: finalDistrictId,
    isVerified: true, // Admin-created users are pre-verified
    isActive: userData.isActive !== undefined ? userData.isActive : true,
  });

  // If we just created a district admin, assign them as the adminId for their district!
  if (finalRole === 'district_admin' && finalDistrictId) {
    await DistrictRepository.update(finalDistrictId, { adminId: newUser.id });
  }

  await logAction(adminUserId, 'USER_CREATION', `Created user "${newUser.fullName}" (${newUser.email}) as role "${newUser.role}" in district ID ${newUser.districtId}`);
  return newUser;
};

const updateUser = async (id, updateData, requestingUser) => {
  const targetUser = await UserRepository.findById(id);
  if (!targetUser) {
    throw new NotFoundError('User not found.');
  }

  // Isolation check: District Admins can only update users in their own district
  if (requestingUser.role === 'district_admin') {
    if (targetUser.districtId !== requestingUser.districtId) {
      throw new ForbiddenError('You can only manage users within your own district.');
    }
    // District Admin cannot change roles or change district
    delete updateData.role;
    delete updateData.districtId;
  }

  // If role is changed to district admin, handle the update
  if (updateData.role === 'district_admin' && updateData.districtId) {
    // Verify district exists
    const dist = await DistrictRepository.findById(updateData.districtId);
    if (!dist) {
      throw new NotFoundError('District not found.');
    }
    // Set district admin link
    await DistrictRepository.update(updateData.districtId, { adminId: id });
  }

  const updated = await UserRepository.update(id, updateData);
  await logAction(requestingUser.id, 'USER_UPDATE', `Updated user ID ${id}. Modified fields: ${JSON.stringify(updateData)}`);
  return updated;
};

const deleteUser = async (id, requestingUser) => {
  const targetUser = await UserRepository.findById(id);
  if (!targetUser) {
    throw new NotFoundError('User not found.');
  }

  // Isolation check
  if (requestingUser.role === 'district_admin' && targetUser.districtId !== requestingUser.districtId) {
    throw new ForbiddenError('You can only delete users within your own district.');
  }

  // If deleting a district admin, clear the adminId from their district first
  if (targetUser.role === 'district_admin' && targetUser.districtId) {
    await DistrictRepository.update(targetUser.districtId, { adminId: null });
  }

  const deleted = await UserRepository.delete(id);
  await logAction(requestingUser.id, 'USER_DELETION', `Deleted user ID ${id} ("${targetUser.fullName}")`);
  return deleted;
};

const searchUsers = async (query, requestingUser) => {
  if (requestingUser.role === 'super_admin') {
    return UserRepository.search(query, null);
  } else if (requestingUser.role === 'district_admin') {
    return UserRepository.search(query, requestingUser.districtId);
  } else {
    throw new ForbiddenError('You do not have permission to search users.');
  }
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await UserRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  // Since UserRepository.findById doesn't return passwordHash (for security), we fetch via email or a custom selector
  const fullUser = await UserRepository.findByEmail(user.email);
  const isMatch = await comparePassword(currentPassword, fullUser.passwordHash);
  if (!isMatch) {
    throw new BadRequestError('Current password is incorrect.');
  }

  const newHash = await hashPassword(newPassword);
  await UserRepository.update(userId, { passwordHash: newHash });
  await logAction(userId, 'PASSWORD_CHANGE', `Successfully changed account password.`);
  return { success: true };
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  searchUsers,
  changePassword,
};
