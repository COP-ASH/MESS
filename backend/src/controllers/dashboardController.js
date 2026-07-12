const { eq, and, sql, desc, gt } = require('drizzle-orm');
const { db } = require('../db');
const { districts, users, activityLogs } = require('../db/schema');
const DistrictRepository = require('../repositories/districtRepository');
const UserRepository = require('../repositories/userRepository');
const LogRepository = require('../repositories/logRepository');
const { sendSuccess } = require('../utils/response');

const getDashboardStats = async (req, res, next) => {
  try {
    const { role, districtId } = req.user;

    if (role === 'super_admin') {
      // 1. Districts stats
      const totalDistricts = await DistrictRepository.countAll();
      const activeDistricts = await DistrictRepository.countActive();
      const inactiveDistricts = await DistrictRepository.countInactive();

      // 2. Users stats
      const totalUsers = await UserRepository.countAll();

      // 3. Users by district distribution
      const usersByDistrict = await db.select({
        districtId: users.districtId,
        districtName: districts.districtName,
        count: sql`count(${users.id})`
      })
      .from(users)
      .leftJoin(districts, eq(users.districtId, districts.id))
      .groupBy(users.districtId, districts.districtName);

      // 4. Daily registrations (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dailyRegistrations = await db.select({
        date: sql`DATE(${users.createdAt})`,
        count: sql`count(${users.id})`
      })
      .from(users)
      .where(gt(users.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

      // 5. Recent audit activity logs
      const recentActivities = await LogRepository.findAllLogs(15);

      // 6. System health
      let dbStatus = 'healthy';
      try {
        await db.execute(sql`SELECT 1`);
      } catch (err) {
        dbStatus = 'unreachable';
      }

      const systemHealth = {
        status: 'online',
        database: dbStatus,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed,
        nodeVersion: process.version,
      };

      return sendSuccess(res, {
        totalDistricts,
        activeDistricts,
        inactiveDistricts,
        totalUsers,
        usersByDistrict,
        dailyRegistrations,
        recentActivities,
        systemHealth
      }, 'Super Admin dashboard stats compiled.');

    } else if (role === 'district_admin') {
      if (!districtId) {
        return res.status(400).json({ success: false, error: 'District Admin is not assigned to any district.' });
      }

      // 1. Get district details
      const district = await DistrictRepository.findById(districtId);

      // 2. District-specific user stats
      const totalUsers = await UserRepository.countByDistrictId(districtId);
      const activeUsers = await UserRepository.countActive(districtId);
      const inactiveUsers = await UserRepository.countInactive(districtId);

      // 3. Recent registrations (last 30 days) in district
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentRegistrationsList = await db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt
      })
      .from(users)
      .where(
        and(
          eq(users.districtId, districtId),
          gt(users.createdAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(users.createdAt))
      .limit(10);

      // 4. District activity logs
      const recentActivities = await LogRepository.findLogsByDistrictId(districtId, 15);

      return sendSuccess(res, {
        district,
        totalUsers,
        activeUsers,
        inactiveUsers,
        recentRegistrations: recentRegistrationsList,
        recentActivities
      }, 'District Admin dashboard stats compiled.');

    } else {
      // Simple user dashboard summary
      const user = await UserRepository.findById(req.user.id);
      const district = user.districtId ? await DistrictRepository.findById(user.districtId) : null;
      return sendSuccess(res, { user, district }, 'User dashboard summary compiled.');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
};
