const { db } = require('../db/index');
const { policeUsers, roles, mealAttendance } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

/**
 * Fetch profile of currently logged-in user
 */
async function getProfile(req, res, next) {
  const userId = req.user.id;
  try {
    const [user] = await db.select({
      id: policeUsers.id,
      name: policeUsers.name,
      pno: policeUsers.pno,
      rank: policeUsers.rank,
      postingUnit: policeUsers.postingUnit,
      mobile: policeUsers.mobile,
      email: policeUsers.email,
      status: policeUsers.status,
      createdAt: policeUsers.createdAt
    })
    .from(policeUsers)
    .where(eq(policeUsers.id, userId));

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.getProfile failed:', error);
    next(error);
  }
}

/**
 * Update personal profile details
 */
async function updateProfile(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] userController.updateProfile - Params:', req.body);
  const { name, rank, postingUnit, mobile } = req.body;
  const userId = req.user.id;

  try {
    if (!name || !rank || !postingUnit || !mobile) {
      return res.status(400).json({ error: 'Name, Rank, Posting Unit, and Mobile Number are required.' });
    }

    const [updated] = await db.update(policeUsers)
      .set({
        name: name.trim(),
        rank: rank.trim(),
        postingUnit: postingUnit.trim(),
        mobile: mobile.trim()
      })
      .where(eq(policeUsers.id, userId))
      .returning();

    await logAudit(userId, 'UPDATE_PROFILE', 'Updated profile details (name, rank, unit, mobile).');

    return res.status(200).json({ message: 'Profile updated successfully!', user: updated });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.updateProfile failed:', error);
    next(error);
  }
}

/**
 * Fetch all registered users by status (Admin only)
 */
async function getUsersList(req, res, next) {
  const statusFilter = req.query.status || 'active'; // 'active', 'pending', 'deactivated'
  try {
    const list = await db.select({
      id: policeUsers.id,
      name: policeUsers.name,
      pno: policeUsers.pno,
      rank: policeUsers.rank,
      postingUnit: policeUsers.postingUnit,
      mobile: policeUsers.mobile,
      email: policeUsers.email,
      status: policeUsers.status,
      createdAt: policeUsers.createdAt,
      roleName: roles.name
    })
    .from(policeUsers)
    .leftJoin(roles, eq(policeUsers.roleId, roles.id))
    .where(eq(policeUsers.status, statusFilter))
    .orderBy(sql`${policeUsers.createdAt} DESC`);

    return res.status(200).json(list);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.getUsersList failed:', error);
    next(error);
  }
}

/**
 * Approve or deactivate user (Admin only)
 */
async function updateUserStatus(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] userController.updateUserStatus - Params:', req.body);
  const { userId, status } = req.body; // status: 'active', 'deactivated'
  const adminId = req.user.id;

  try {
    if (!userId || !status) {
      return res.status(400).json({ error: 'User ID and Status are required.' });
    }

    if (!['active', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be active or deactivated.' });
    }

    const [updated] = await db.update(policeUsers)
      .set({ status })
      .where(eq(policeUsers.id, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await logAudit(adminId, 'UPDATE_USER_STATUS', `Set status of User #${userId} to "${status}"`);

    return res.status(200).json({ message: `User account is now ${status}.`, user: updated });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.updateUserStatus failed:', error);
    next(error);
  }
}

/**
 * Export attendance records as CSV (Admin only)
 */
async function exportAttendanceCsv(req, res, next) {
  const { month, year } = req.query;
  const adminId = req.user.id;

  try {
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and Year parameters are required for export.' });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const records = await db.select({
      id: mealAttendance.id,
      date: mealAttendance.date,
      userName: policeUsers.name,
      pno: policeUsers.pno,
      rank: policeUsers.rank,
      postingUnit: policeUsers.postingUnit,
      breakfast: mealAttendance.breakfast,
      lunch: mealAttendance.lunch,
      dinner: mealAttendance.dinner
    })
    .from(mealAttendance)
    .leftJoin(policeUsers, eq(mealAttendance.userId, policeUsers.id))
    .where(
      and(
        sql`${mealAttendance.date} >= ${startDate}`,
        sql`${mealAttendance.date} <= ${endDate}`
      )
    )
    .orderBy(sql`${mealAttendance.date} ASC`);

    let csvContent = 'ID,Date,Officer Name,PNO,Rank,Posting Unit,Breakfast,Lunch,Dinner\n';
    records.forEach(r => {
      csvContent += `${r.id},${r.date},"${r.userName}",${r.pno},"${r.rank}","${r.postingUnit}",${r.breakfast ? 'Yes' : 'No'},${r.lunch ? 'Yes' : 'No'},${r.dinner ? 'Yes' : 'No'}\n`;
    });

    await logAudit(adminId, 'EXPORT_ATTENDANCE', `Exported attendance report for ${month}/${year}`);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${month}_${year}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.exportAttendanceCsv failed:', error);
    next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getUsersList,
  updateUserStatus,
  exportAttendanceCsv
};
