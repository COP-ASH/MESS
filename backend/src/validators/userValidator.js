const { z } = require('zod');

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['super_admin', 'district_admin', 'user']),
  districtId: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['super_admin', 'district_admin', 'user']).optional(),
  districtId: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
};
