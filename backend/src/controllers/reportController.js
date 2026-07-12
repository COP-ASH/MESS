const { eq, and, sql, gt, lt, inArray } = require('drizzle-orm');
const { db } = require('../db');
const { users, districts, activityLogs, mealAttendance } = require('../db/schema');
const { sendSuccess } = require('../utils/response');
const { ForbiddenError, BadRequestError } = require('../utils/errors');
const fs = require('fs');
const path = require('path');

const ratesFilePath = path.join(__dirname, '../config/rates.json');

function loadRates() {
  try {
    if (fs.existsSync(ratesFilePath)) {
      return JSON.parse(fs.readFileSync(ratesFilePath, 'utf8'));
    }
  } catch (err) {
    console.error('>>> [RATES READ ERROR] Failed to load rates config:', err);
  }
  return { normalDiet: 30.00, halfSpecialDiet: 50.00, fullSpecialDiet: 50.00 }; // Indian Rupees defaults
}

const generateReport = async (req, res, next) => {
  try {
    const { type, startDate, endDate, districtFilterId } = req.query;
    const { role, districtId } = req.user;

    // Build date filters if provided
    let dateConditions = [];
    if (startDate) dateConditions.push(gt(users.createdAt, new Date(startDate)));
    if (endDate) dateConditions.push(lt(users.createdAt, new Date(endDate)));

    let logsDateConditions = [];
    if (startDate) logsDateConditions.push(gt(activityLogs.createdAt, new Date(startDate)));
    if (endDate) logsDateConditions.push(lt(activityLogs.createdAt, new Date(endDate)));

    // Ensure data isolation
    let finalDistrictId = null;
    if (role === 'district_admin') {
      finalDistrictId = districtId;
    } else if (role === 'super_admin' && districtFilterId) {
      finalDistrictId = parseInt(districtFilterId);
    }

    if (type === 'users') {
      // User Report - Mess Members only
      let conditions = [eq(users.role, 'user')];
      if (finalDistrictId) {
        conditions.push(eq(users.districtId, finalDistrictId));
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(lt(users.createdAt, endDateTime));
      }

      const list = await db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        districtName: districts.districtName,
        isActive: users.isActive,
        isVerified: users.isVerified,
        createdAt: users.createdAt
      })
      .from(users)
      .leftJoin(districts, eq(users.districtId, districts.id))
      .where(and(...conditions))
      .orderBy(users.id);

      if (list.length === 0) {
        return sendSuccess(res, [], 'Users report generated.');
      }

      const userIds = list.map(u => u.id);
      let attendanceConditions = [inArray(mealAttendance.userId, userIds)];
      if (startDate) {
        attendanceConditions.push(sql`${mealAttendance.date} >= ${startDate}`);
      }
      if (endDate) {
        attendanceConditions.push(sql`${mealAttendance.date} <= ${endDate}`);
      }

      const attendanceRecords = await db.select()
        .from(mealAttendance)
        .where(and(...attendanceConditions));

      const attendanceMap = {};
      userIds.forEach(id => {
        attendanceMap[id] = {
          normalDietCount: 0,
          halfSpecialDietCount: 0,
          fullSpecialDietCount: 0
        };
      });

      attendanceRecords.forEach(record => {
        const userAtt = attendanceMap[record.userId];
        if (userAtt) {
          if (record.morningNormal) userAtt.normalDietCount++;
          if (record.eveningNormal) userAtt.normalDietCount++;
          if (record.morningHalfSpecial) userAtt.halfSpecialDietCount++;
          if (record.eveningHalfSpecial) userAtt.halfSpecialDietCount++;
          if (record.morningFullSpecial) userAtt.fullSpecialDietCount++;
          if (record.eveningFullSpecial) userAtt.fullSpecialDietCount++;
        }
      });

      const rates = loadRates();
      const enrichedList = list.map(u => {
        const counts = attendanceMap[u.id];
        const totalNormalDiet = counts.normalDietCount;
        const totalHalfSpecialDiet = counts.halfSpecialDietCount;
        const totalFullSpecialDiet = counts.fullSpecialDietCount;
        const totalDietTaken = totalNormalDiet + totalHalfSpecialDiet + totalFullSpecialDiet;
        const totalAmount = (totalNormalDiet * rates.normalDiet) + (totalHalfSpecialDiet * rates.halfSpecialDiet) + (totalFullSpecialDiet * rates.fullSpecialDiet);

        return {
          ...u,
          totalNormalDiet,
          totalHalfSpecialDiet,
          totalFullSpecialDiet,
          totalDietTaken,
          totalAmount: totalAmount.toFixed(2)
        };
      });

      return sendSuccess(res, enrichedList, 'Users report generated.');

    } else if (type === 'districts') {
      if (role !== 'super_admin') {
        throw new ForbiddenError('Only Super Admins can generate district reports.');
      }

      const list = await db.select({
        id: districts.id,
        districtName: districts.districtName,
        districtCode: districts.districtCode,
        adminName: users.fullName,
        adminEmail: users.email,
        status: districts.status,
        createdAt: districts.createdAt
      })
      .from(districts)
      .leftJoin(users, eq(districts.adminId, users.id))
      .orderBy(districts.id);

      return sendSuccess(res, list, 'Districts report generated.');

    } else if (type === 'activity_logs') {
      let conditions = [...logsDateConditions];
      if (role === 'district_admin') {
        conditions.push(eq(users.districtId, districtId));
      }

      const list = await db.select({
        id: activityLogs.id,
        userName: users.fullName,
        userEmail: users.email,
        action: activityLogs.action,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt
      })
      .from(activityLogs)
      .innerJoin(users, eq(activityLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(activityLogs.id);

      return sendSuccess(res, list, 'Activity logs report generated.');

    } else if (type === 'registrations') {
      // Registrations count by date
      let conditions = [...dateConditions];
      if (finalDistrictId) {
        conditions.push(eq(users.districtId, finalDistrictId));
      }

      const list = await db.select({
        date: sql`DATE(${users.createdAt})`,
        count: sql`count(*)`
      })
      .from(users)
      .where(and(...conditions))
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

      return sendSuccess(res, list, 'Registration report metrics compiled.');

    } else {
      throw new BadRequestError('Invalid report type specified.');
    }

  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateReport,
};
