const { db } = require('../db/index');
const { mealAttendance } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

/**
 * Mark or update meal attendance for a specific date
 */
async function markAttendance(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] attendanceController.markAttendance - Params:', req.body);
  const { date, breakfast, lunch, dinner } = req.body;
  const userId = req.user.id;

  try {
    if (!date) {
      return res.status(400).json({ error: 'Date field is required (YYYY-MM-DD).' });
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
          breakfast: breakfast !== undefined ? !!breakfast : existingRecord.breakfast,
          lunch: lunch !== undefined ? !!lunch : existingRecord.lunch,
          dinner: dinner !== undefined ? !!dinner : existingRecord.dinner
        })
        .where(eq(mealAttendance.id, existingRecord.id))
        .returning();
      console.log(`>>> [ATTENDANCE UPDATE] Updated record ID #${result.id} for user #${userId}`);
    } else {
      // Insert new record
      [result] = await db.insert(mealAttendance).values({
        userId,
        date,
        breakfast: !!breakfast,
        lunch: !!lunch,
        dinner: !!dinner
      }).returning();
      console.log(`>>> [ATTENDANCE INSERT] Created record ID #${result.id} for user #${userId}`);
    }

    await logAudit(userId, 'MARK_ATTENDANCE', `Marked meals for ${date} | B: ${result.breakfast}, L: ${result.lunch}, D: ${result.dinner}`);

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
  try {
    const records = await db.select().from(mealAttendance)
      .where(eq(mealAttendance.date, targetDate));

    let breakfastCount = 0;
    let lunchCount = 0;
    let dinnerCount = 0;

    records.forEach(r => {
      if (r.breakfast) breakfastCount++;
      if (r.lunch) lunchCount++;
      if (r.dinner) dinnerCount++;
    });

    return res.status(200).json({
      date: targetDate,
      totalPersonnelServed: records.length,
      breakfast: breakfastCount,
      lunch: lunchCount,
      dinner: dinnerCount,
      grandTotal: breakfastCount + lunchCount + dinnerCount
    });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] attendanceController.getDailyAttendanceSummary failed:', error);
    next(error);
  }
}

module.exports = {
  markAttendance,
  getAttendanceHistory,
  getDailyAttendanceSummary
};
