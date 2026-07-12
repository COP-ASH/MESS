const { eq, and, or, ilike, sql } = require('drizzle-orm');
const { db } = require('../db');
const { users, districts } = require('../db/schema');

const UserRepository = {
  async findById(id) {
    const result = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      districtId: users.districtId,
      districtName: districts.districtName,
      isVerified: users.isVerified,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .leftJoin(districts, eq(users.districtId, districts.id))
    .where(eq(users.id, id))
    .limit(1);

    return result[0] || null;
  },

  async findByEmail(email) {
    const result = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      districtId: users.districtId,
      districtName: districts.districtName,
      isVerified: users.isVerified,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .leftJoin(districts, eq(users.districtId, districts.id))
    .where(eq(users.email, email))
    .limit(1);

    return result[0] || null;
  },

  async create(userData) {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  },

  async update(id, updateData) {
    const result = await db.update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  },

  async delete(id) {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result[0];
  },

  async findAll() {
    return db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      districtId: users.districtId,
      districtName: districts.districtName,
      isVerified: users.isVerified,
      isActive: users.isActive,
      createdAt: users.createdAt
    })
    .from(users)
    .leftJoin(districts, eq(users.districtId, districts.id))
    .orderBy(users.id);
  },

  async findAllByDistrictId(districtId) {
    return db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      districtId: users.districtId,
      districtName: districts.districtName,
      isVerified: users.isVerified,
      isActive: users.isActive,
      createdAt: users.createdAt
    })
    .from(users)
    .leftJoin(districts, eq(users.districtId, districts.id))
    .where(eq(users.districtId, districtId))
    .orderBy(users.id);
  },

  async search(searchTerm, districtId = null) {
    const matchTerm = `%${searchTerm}%`;
    const conditions = [
      or(
        ilike(users.fullName, matchTerm),
        ilike(users.email, matchTerm)
      )
    ];

    if (districtId !== null) {
      conditions.push(eq(users.districtId, districtId));
    }

    return db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      districtId: users.districtId,
      districtName: districts.districtName,
      isVerified: users.isVerified,
      isActive: users.isActive,
      createdAt: users.createdAt
    })
    .from(users)
    .leftJoin(districts, eq(users.districtId, districts.id))
    .where(and(...conditions))
    .orderBy(users.id);
  },

  async countAll() {
    const result = await db.select({ count: sql`count(*)` }).from(users);
    return parseInt(result[0].count, 10);
  },

  async countByDistrictId(districtId) {
    const result = await db.select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.districtId, districtId));
    return parseInt(result[0].count, 10);
  },

  async countActive(districtId = null) {
    const conditions = [eq(users.isActive, true)];
    if (districtId !== null) {
      conditions.push(eq(users.districtId, districtId));
    }
    const result = await db.select({ count: sql`count(*)` })
      .from(users)
      .where(and(...conditions));
    return parseInt(result[0].count, 10);
  },

  async countInactive(districtId = null) {
    const conditions = [eq(users.isActive, false)];
    if (districtId !== null) {
      conditions.push(eq(users.districtId, districtId));
    }
    const result = await db.select({ count: sql`count(*)` })
      .from(users)
      .where(and(...conditions));
    return parseInt(result[0].count, 10);
  }
};

module.exports = UserRepository;
