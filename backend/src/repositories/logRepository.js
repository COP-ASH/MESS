const { eq, desc, sql } = require('drizzle-orm');
const { db } = require('../db');
const { activityLogs, users, districts } = require('../db/schema');

const LogRepository = {
  async createLog(userId, action, details) {
    try {
      const result = await db.insert(activityLogs).values({
        userId,
        action,
        details,
      }).returning();
      return result[0];
    } catch (error) {
      console.error('>>> [AUDIT LOG ERROR] Failed to write log:', error);
      return null;
    }
  },

  async findAllLogs(limit = 100) {
    return db.select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      userEmail: users.email,
      userName: users.fullName,
      action: activityLogs.action,
      details: activityLogs.details,
      createdAt: activityLogs.createdAt
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  },

  async findLogsByDistrictId(districtId, limit = 100) {
    return db.select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      userEmail: users.email,
      userName: users.fullName,
      action: activityLogs.action,
      details: activityLogs.details,
      createdAt: activityLogs.createdAt
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(users.districtId, districtId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  }
};

module.exports = LogRepository;
