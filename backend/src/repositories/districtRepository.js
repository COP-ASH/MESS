const { eq, and, sql } = require('drizzle-orm');
const { db } = require('../db');
const { districts, users } = require('../db/schema');

const DistrictRepository = {
  async findById(id) {
    const result = await db.select({
      id: districts.id,
      districtName: districts.districtName,
      districtCode: districts.districtCode,
      adminId: districts.adminId,
      adminName: users.fullName,
      adminEmail: users.email,
      status: districts.status,
      morningCutoff: districts.morningCutoff,
      eveningCutoff: districts.eveningCutoff,
      createdAt: districts.createdAt,
      updatedAt: districts.updatedAt
    })
    .from(districts)
    .leftJoin(users, eq(districts.adminId, users.id))
    .where(eq(districts.id, id))
    .limit(1);

    return result[0] || null;
  },

  async findByCode(code) {
    const result = await db.select({
      id: districts.id,
      districtName: districts.districtName,
      districtCode: districts.districtCode,
      adminId: districts.adminId,
      adminName: users.fullName,
      status: districts.status,
      createdAt: districts.createdAt
    })
    .from(districts)
    .leftJoin(users, eq(districts.adminId, users.id))
    .where(eq(districts.districtCode, code.toUpperCase()))
    .limit(1);

    return result[0] || null;
  },

  async create(districtData) {
    const result = await db.insert(districts).values(districtData).returning();
    return result[0];
  },

  async update(id, updateData) {
    const result = await db.update(districts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(districts.id, id))
      .returning();
    return result[0];
  },

  async delete(id) {
    const result = await db.delete(districts).where(eq(districts.id, id)).returning();
    return result[0];
  },

  async findAll() {
    return db.select({
      id: districts.id,
      districtName: districts.districtName,
      districtCode: districts.districtCode,
      adminId: districts.adminId,
      adminName: users.fullName,
      adminEmail: users.email,
      status: districts.status,
      morningCutoff: districts.morningCutoff,
      eveningCutoff: districts.eveningCutoff,
      createdAt: districts.createdAt
    })
    .from(districts)
    .leftJoin(users, eq(districts.adminId, users.id))
    .orderBy(districts.id);
  },

  async countAll() {
    const result = await db.select({ count: sql`count(*)` }).from(districts);
    return parseInt(result[0].count, 10);
  },

  async countActive() {
    const result = await db.select({ count: sql`count(*)` })
      .from(districts)
      .where(eq(districts.status, 'active'));
    return parseInt(result[0].count, 10);
  },

  async countInactive() {
    const result = await db.select({ count: sql`count(*)` })
      .from(districts)
      .where(eq(districts.status, 'inactive'));
    return parseInt(result[0].count, 10);
  }
};

module.exports = DistrictRepository;
