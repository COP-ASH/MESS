const { db } = require('../db/index');
const { mealAttendance, nilDietRequests } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

// Date-specific Nil check helper function
function formatDateStr(d) {
  if (!d) return '';
  if (typeof d === 'string') {
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
  }
  const dateObj = new Date(d);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function checkNilStatusForDate(dateStr, request) {
  const date = formatDateStr(dateStr);
  const from = formatDateStr(request.fromDate);
  const to = formatDateStr(request.toDate);

  let isMorningNil = false;
  let isEveningNil = false;

  // Fallback for legacy requests (where new columns are null/undefined)
  if (request.fromMorning === undefined || request.fromMorning === null) {
    if (date >= from && date <= to) {
      isMorningNil = !!request.morningDiet;
      isEveningNil = !!request.eveningDiet;
    }
    return { isMorningNil, isEveningNil };
  }

  if (date === from && date === to) {
    isMorningNil = !!request.fromMorning;
    isEveningNil = !!request.fromEvening;
  } else if (date === from) {
    isMorningNil = !!request.fromMorning;
    isEveningNil = !!request.fromEvening;
  } else if (date === to) {
    isMorningNil = !!request.toMorning;
    isEveningNil = !!request.toEvening;
  } else if (date > from && date < to) {
    isMorningNil = true;
    isEveningNil = true;
  }

  return { isMorningNil, isEveningNil };
}

/**
 * Mark or update meal attendance for a specific date
 */
async function markAttendance(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] attendanceController.markAttendance - Params:', req.body);
  const { date, morningNormal, morningHalfSpecial, morningFullSpecial, eveningNormal, eveningHalfSpecial, eveningFullSpecial, userId: targetUserId } = req.body;
  let userId = targetUserId ? parseInt(targetUserId) : req.user.id;
  let districtId = req.user.districtId;

  try {
    if (!date) {
      return res.status(400).json({ error: 'Date field is required (YYYY-MM-DD).' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (date > todayStr) {
      return res.status(400).json({ error: 'Cannot mark attendance for future dates.' });
    }

    // Verify permission: if targetUserId is different from req.user.id, caller must be admin
    if (userId !== req.user.id) {
      if (req.user.role !== 'district_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only administrative users can mark attendance for other members.' });
      }

      // If caller is district admin, verify target user is in their district
      const { users } = require('../db/schema');
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found.' });
      }

      if (req.user.role === 'district_admin' && targetUser.districtId !== req.user.districtId) {
        return res.status(403).json({ error: 'You can only mark attendance for members of your own district.' });
      }
      districtId = targetUser.districtId;
    }

    // Check if user has an active approved Nil Diet request for this date
    const [activeNil] = await db.select().from(nilDietRequests).where(
      and(
        eq(nilDietRequests.userId, userId),
        eq(nilDietRequests.status, 'approved'),
        sql`${date} >= ${nilDietRequests.fromDate}`,
        sql`${date} <= ${nilDietRequests.toDate}`
      )
    );

    if (activeNil) {
      const { isMorningNil, isEveningNil } = checkNilStatusForDate(date, activeNil);
      if (isMorningNil && (morningNormal === true || morningHalfSpecial === true || morningFullSpecial === true)) {
        return res.status(400).json({ error: 'Cannot mark Morning diet: This member has an approved Nil Diet request active for the Morning session on this date.' });
      }
      if (isEveningNil && (eveningNormal === true || eveningHalfSpecial === true || eveningFullSpecial === true)) {
        return res.status(400).json({ error: 'Cannot mark Evening diet: This member has an approved Nil Diet request active for the Evening session on this date.' });
      }
    }

    // Check if an attendance record already exists for this user and date
    const [existingRecord] = await db.select().from(mealAttendance)
      .where(
        and(
          eq(mealAttendance.userId, userId),
          eq(mealAttendance.date, date)
        )
      );

    let result;
    if (existingRecord) {
      // Update existing record
      [result] = await db.update(mealAttendance)
        .set({
          morningNormal: morningNormal !== undefined ? !!morningNormal : existingRecord.morningNormal,
          morningHalfSpecial: morningHalfSpecial !== undefined ? !!morningHalfSpecial : existingRecord.morningHalfSpecial,
          morningFullSpecial: morningFullSpecial !== undefined ? !!morningFullSpecial : existingRecord.morningFullSpecial,
          eveningNormal: eveningNormal !== undefined ? !!eveningNormal : existingRecord.eveningNormal,
          eveningHalfSpecial: eveningHalfSpecial !== undefined ? !!eveningHalfSpecial : existingRecord.eveningHalfSpecial,
          eveningFullSpecial: eveningFullSpecial !== undefined ? !!eveningFullSpecial : existingRecord.eveningFullSpecial
        })
        .where(eq(mealAttendance.id, existingRecord.id))
        .returning();
      console.log(`>>> [ATTENDANCE UPDATE] Updated record ID #${result.id} for user #${userId}`);
    } else {
      // Insert new record
      [result] = await db.insert(mealAttendance).values({
        userId,
        districtId,
        date,
        morningNormal: !!morningNormal,
        morningHalfSpecial: !!morningHalfSpecial,
        morningFullSpecial: !!morningFullSpecial,
        eveningNormal: !!eveningNormal,
        eveningHalfSpecial: !!eveningHalfSpecial,
        eveningFullSpecial: !!eveningFullSpecial
      }).returning();
      console.log(`>>> [ATTENDANCE INSERT] Created record ID #${result.id} for user #${userId}`);
    }

    await logAudit(req.user.id, 'MARK_ATTENDANCE', `Marked meals for user #${userId} on ${date} | MN: ${result.morningNormal}, MH: ${result.morningHalfSpecial}, MF: ${result.morningFullSpecial}, EN: ${result.eveningNormal}, EH: ${result.eveningHalfSpecial}, EF: ${result.eveningFullSpecial}`);

    return res.status(200).json({ message: 'Attendance logged successfully!', attendance: result });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] attendanceController.markAttendance failed:', error);
    next(error);
  }
}

/**
 * Retrieve personal attendance history
 */
async function getAttendanceHistory(req, res, next) {
  const userId = req.user.id;
  try {
    const history = await db.select().from(mealAttendance)
      .where(eq(mealAttendance.userId, userId))
      .orderBy(sql`${mealAttendance.date} DESC`);

    return res.status(200).json(history);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] attendanceController.getAttendanceHistory failed:', error);
    next(error);
  }
}

/**
 * Retrieve aggregate daily meal counts for today (Admin only)
 */
async function getDailyAttendanceSummary(req, res, next) {
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];
  const { users } = require('../db/schema');

  try {
    let memberQuery = db.select().from(users).where(eq(users.role, 'user'));
    let attendanceQuery = db.select().from(mealAttendance).where(eq(mealAttendance.date, targetDate));

    if (req.user.role === 'district_admin') {
      memberQuery = db.select().from(users).where(
        and(
          eq(users.role, 'user'),
          eq(users.districtId, req.user.districtId)
        )
      );
      attendanceQuery = db.select().from(mealAttendance).where(
        and(
          eq(mealAttendance.date, targetDate),
          eq(mealAttendance.districtId, req.user.districtId)
        )
      );
    }

    const districtMembers = await memberQuery;
    const records = await attendanceQuery;

    // Fetch approved nil requests active on targetDate
    const approvedNilRequests = await db.select().from(nilDietRequests).where(
      and(
        eq(nilDietRequests.status, 'approved'),
        sql`${targetDate} >= ${nilDietRequests.fromDate}`,
        sql`${targetDate} <= ${nilDietRequests.toDate}`
      )
    );

    const nilMap = {};
    approvedNilRequests.forEach(nr => {
      const { isMorningNil, isEveningNil } = checkNilStatusForDate(targetDate, nr);
      nilMap[nr.userId] = {
        morningDiet: isMorningNil,
        eveningDiet: isEveningNil
      };
    });

    // Map records by userId for quick lookup
    const recordsMap = {};
    records.forEach(r => {
      recordsMap[r.userId] = r;
    });

    let morningNormalCount = 0;
    let morningHalfSpecialCount = 0;
    let morningFullSpecialCount = 0;
    let eveningNormalCount = 0;
    let eveningHalfSpecialCount = 0;
    let eveningFullSpecialCount = 0;

    const details = districtMembers.map(member => {
      const record = recordsMap[member.id] || {
        morningNormal: false, morningHalfSpecial: false, morningFullSpecial: false,
        eveningNormal: false, eveningHalfSpecial: false, eveningFullSpecial: false
      };
      if (record.morningNormal) morningNormalCount++;
      if (record.morningHalfSpecial) morningHalfSpecialCount++;
      if (record.morningFullSpecial) morningFullSpecialCount++;
      if (record.eveningNormal) eveningNormalCount++;
      if (record.eveningHalfSpecial) eveningHalfSpecialCount++;
      if (record.eveningFullSpecial) eveningFullSpecialCount++;

      const nilReq = nilMap[member.id];
      const isNilExcluded = !!nilReq;

      return {
        userId: member.id,
        fullName: member.fullName,
        email: member.email,
        isActive: member.isActive,
        isNilExcluded,
        nilMorning: nilReq ? nilReq.morningDiet : false,
        nilEvening: nilReq ? nilReq.eveningDiet : false,
        attendance: {
          morningNormal: record.morningNormal,
          morningHalfSpecial: record.morningHalfSpecial,
          morningFullSpecial: record.morningFullSpecial,
          eveningNormal: record.eveningNormal,
          eveningHalfSpecial: record.eveningHalfSpecial,
          eveningFullSpecial: record.eveningFullSpecial
        }
      };
    });

    return res.status(200).json({
      date: targetDate,
      totalPersonnelServed: records.length,
      morningNormal: morningNormalCount,
      morningHalfSpecial: morningHalfSpecialCount,
      morningFullSpecial: morningFullSpecialCount,
      eveningNormal: eveningNormalCount,
      eveningHalfSpecial: eveningHalfSpecialCount,
      eveningFullSpecial: eveningFullSpecialCount,
      grandTotal: morningNormalCount + morningHalfSpecialCount + morningFullSpecialCount + eveningNormalCount + eveningHalfSpecialCount + eveningFullSpecialCount,
      membersAttendance: details
    });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] attendanceController.getDailyAttendanceSummary failed:', error);
    next(error);
  }
}

/**
 * Retrieve attendance history for a specific user (Admin only)
 */
async function getMemberAttendanceHistory(req, res, next) {
  const { userId } = req.params;
  const adminDistrictId = req.user.districtId;
  const adminRole = req.user.role;

  try {
    const targetUserId = parseInt(userId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    // If district admin, check if target user is in their district
    if (adminRole === 'district_admin') {
      const { users } = require('../db/schema');
      const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId));
      if (!targetUser || targetUser.districtId !== adminDistrictId) {
        return res.status(403).json({ error: 'Access denied. User is not in your district.' });
      }
    }

    const history = await db.select().from(mealAttendance)
      .where(eq(mealAttendance.userId, targetUserId))
      .orderBy(sql`${mealAttendance.date} DESC`);

    return res.status(200).json(history);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] attendanceController.getMemberAttendanceHistory failed:', error);
    next(error);
  }
}

module.exports = {
  markAttendance,
  getAttendanceHistory,
  getDailyAttendanceSummary,
  getMemberAttendanceHistory
};
