const { db } = require('../db/index');
const { notices, policeUsers } = require('../db/schema');
const { eq, sql } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

/**
 * Fetch all posted notices (includes poster's name)
 */
async function getNotices(req, res, next) {
  try {
    const list = await db.select({
      id: notices.id,
      title: notices.title,
      content: notices.content,
      createdAt: notices.createdAt,
      postedByName: policeUsers.name,
      postedByRank: policeUsers.rank
    })
    .from(notices)
    .leftJoin(policeUsers, eq(notices.postedBy, policeUsers.id))
    .orderBy(sql`${notices.createdAt} DESC`);

    return res.status(200).json(list);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] noticeController.getNotices failed:', error);
    next(error);
  }
}

/**
 * Create a new official notice (Admin only)
 */
async function createNotice(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] noticeController.createNotice - Params:', req.body);
  const { title, content } = req.body;
  const adminId = req.user.id;

  try {
    if (!title || !content) {
      return res.status(400).json({ error: 'Notice Title and Content are required.' });
    }

    const [newNotice] = await db.insert(notices).values({
      title: title.trim(),
      content: content.trim(),
      postedBy: adminId
    }).returning();

    await logAudit(adminId, 'CREATE_NOTICE', `Posted Notice #${newNotice.id}: "${title.substring(0, 30)}..."`);

    return res.status(201).json({ message: 'Notice posted successfully!', notice: newNotice });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] noticeController.createNotice failed:', error);
    next(error);
  }
}

module.exports = {
  getNotices,
  createNotice
};
