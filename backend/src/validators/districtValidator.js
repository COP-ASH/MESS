const { z } = require('zod');

const createDistrictSchema = z.object({
  districtName: z.string().min(2, 'District name must be at least 2 characters'),
  districtCode: z.string().min(2, 'District code must be at least 2 characters').toUpperCase(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateDistrictSchema = z.object({
  districtName: z.string().min(2, 'District name must be at least 2 characters').optional(),
  districtCode: z.string().min(2, 'District code must be at least 2 characters').toUpperCase().optional(),
  adminId: z.number().int().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

module.exports = {
  createDistrictSchema,
  updateDistrictSchema,
};
