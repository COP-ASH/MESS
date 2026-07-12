const { eq, and } = require('drizzle-orm');
const { db } = require('../db');
const { notices, users } = require('../db/schema');
const { sendSuccess } = require('../utils/response');
const { ForbiddenError, NotFoundError } = require('../utils/errors');
const { logAction } = require('../services/logService');

const listNotices = async (req, res, next) => {
  try {
    const { districtId, role } = req.user;

    let list;
    if (role === 'super_admin') {
      // Super Admin gets all notices
      list = await db.select({
        id: notices.id,
        districtId: notices.districtId,
        title: notices.title,
        content: notices.content,
        postedByName: users.fullName,
        createdAt: notices.createdAt
      })
      .from(notices)
      .leftJoin(users, eq(notices.postedBy, users.id))
      .orderBy(notices.id);
    } else {
      // Scoped to district
      list = await db.select({
        id: notices.id,
        districtId: notices.districtId,
        title: notices.title,
        content: notices.content,
        postedByName: users.fullName,
        createdAt: notices.createdAt
      })
      .from(notices)
      .leftJoin(users, eq(notices.postedBy, users.id))
      .where(eq(notices.districtId, districtId))
      .orderBy(notices.id);
    }

    return sendSuccess(res, list, 'Notices list retrieved.');
  } catch (error) {
    next(error);
  }
};

const createNotice = async (req, res, next) => {
  try {
    const { title, content, targetDistrictId } = req.body;
    const { id: userId, role, districtId } = req.user;

    let finalDistrictId = districtId;
    if (role === 'super_admin') {
      if (!targetDistrictId) {
        return res.status(400).json({ success: false, error: 'Target district ID is required.' });
      }
      finalDistrictId = parseInt(targetDistrictId);
    }

    if (!finalDistrictId) {
      return res.status(400).json({ success: false, error: 'User is not assigned to a district.' });
    }

    const newNotice = await db.insert(notices).values({
      districtId: finalDistrictId,
      title,
      content,
      postedBy: userId
    }).returning();

    await logAction(userId, 'NOTICE_CREATION', `Created notice "${title}" for district ID ${finalDistrictId}`);
    return sendSuccess(res, newNotice[0], 'Notice announcement created.', 201);
  } catch (error) {
    next(error);
  }
};

const deleteNotice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, districtId, id: userId } = req.user;

    const noticeRecords = await db.select().from(notices).where(eq(notices.id, parseInt(id))).limit(1);
    if (noticeRecords.length === 0) {
      throw new NotFoundError('Notice notification not found.');
    }

    const notice = noticeRecords[0];

    // Check permissions
    if (role !== 'super_admin' && notice.districtId !== districtId) {
      throw new ForbiddenError('You can only delete notices within your own district.');
    }

    await db.delete(notices).where(eq(notices.id, parseInt(id)));
    await logAction(userId, 'NOTICE_DELETION', `Deleted notice ID ${id} ("${notice.title}")`);

    return sendSuccess(res, null, 'Notice deleted successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotices,
  createNotice,
  deleteNotice,
};
