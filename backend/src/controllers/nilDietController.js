const { db } = require('../db/index');
const { nilDietRequests, users, mealAttendance, districts } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

/**
 * Submit a Nil Diet Request (Member only)
 */
async function submitRequest(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] nilDietController.submitRequest - Params:', req.body);
  const { fromDate, toDate } = req.body;
  try {
    const { fromDate, toDate, morningDiet, eveningDiet } = req.body;
    const userId = req.user.id;
    const districtId = req.user.districtId;

    const isMorningSelected = morningDiet !== undefined ? !!morningDiet : true;
    const isEveningSelected = eveningDiet !== undefined ? !!eveningDiet : true;

    if (!isMorningSelected && !isEveningSelected) {
      return res.status(400).json({ error: 'At least one session (Morning or Evening) must be selected for the Nil Diet request.' });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'Both From Date and Till Date are required.' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date formats provided.' });
    }

    if (start > end) {
      return res.status(400).json({ error: 'From Date cannot be later than Till Date.' });
    }

    // Fetch district cutoff times
    const [district] = await db.select().from(districts).where(eq(districts.id, districtId)).limit(1);
    if (!district) {
      return res.status(404).json({ error: 'District configuration not found.' });
    }

    const { morningCutoff, eveningCutoff } = district;
    
    // Enforce cutoff limits based on current time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Past date check
    if (fromDate < todayStr) {
      return res.status(400).json({ error: 'Cannot submit a Nil Diet Request for past dates.' });
    }

    // Today check: Today's morning/evening diets are locked if past their respective cutoffs
    if (fromDate === todayStr) {
      if (isMorningSelected) {
        const [cutoffHour, cutoffMin] = morningCutoff.split(':').map(Number);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffHour, cutoffMin, 0, 0);

        if (now > cutoffTime) {
          return res.status(400).json({ 
            error: `Cannot submit a Nil Diet Request starting today for the Morning session. The morning diet cutoff time of ${morningCutoff} for today has already passed.` 
          });
        }
      }

      if (isEveningSelected) {
        const [cutoffHour, cutoffMin] = eveningCutoff.split(':').map(Number);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffHour, cutoffMin, 0, 0);

        if (now > cutoffTime) {
          return res.status(400).json({ 
            error: `Cannot submit a Nil Diet Request starting today for the Evening session. The evening diet cutoff time of ${eveningCutoff} for today has already passed.` 
          });
        }
      }
    }

    const [newRequest] = await db.insert(nilDietRequests).values({
      userId,
      districtId,
      fromDate,
      toDate,
      morningDiet: isMorningSelected,
      eveningDiet: isEveningSelected,
      status: 'pending'
    }).returning();

    await logAudit(userId, 'SUBMIT_NIL_DIET_REQUEST', `Submitted Nil Diet from ${fromDate} to ${toDate} (Morning: ${isMorningSelected}, Evening: ${isEveningSelected})`);

    return res.status(201).json({ message: 'Request submitted successfully!', request: newRequest });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] nilDietController.submitRequest failed:', error);
    next(error);
  }
}

/**
 * Retrieve Nil Diet Requests
 * - Admin: view all pending/past requests in their district
 * - Member: view their own requests history
 */
async function getRequests(req, res, next) {
  try {
    let list;
    if (req.user.role === 'district_admin' || req.user.role === 'super_admin') {
      const conditions = [];
      if (req.user.role === 'district_admin') {
        conditions.push(eq(nilDietRequests.districtId, req.user.districtId));
      }

      list = await db.select({
        id: nilDietRequests.id,
        userId: nilDietRequests.userId,
        fromDate: nilDietRequests.fromDate,
        toDate: nilDietRequests.toDate,
        morningDiet: nilDietRequests.morningDiet,
        eveningDiet: nilDietRequests.eveningDiet,
        status: nilDietRequests.status,
        createdAt: nilDietRequests.createdAt,
        memberName: users.fullName,
        memberEmail: users.email
      })
      .from(nilDietRequests)
      .leftJoin(users, eq(nilDietRequests.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${nilDietRequests.createdAt} DESC`);
    } else {
      // Member view
      list = await db.select({
        id: nilDietRequests.id,
        fromDate: nilDietRequests.fromDate,
        toDate: nilDietRequests.toDate,
        morningDiet: nilDietRequests.morningDiet,
        eveningDiet: nilDietRequests.eveningDiet,
        status: nilDietRequests.status,
        createdAt: nilDietRequests.createdAt
      })
      .from(nilDietRequests)
      .where(eq(nilDietRequests.userId, req.user.id))
      .orderBy(sql`${nilDietRequests.createdAt} DESC`);
    }

    return res.status(200).json(list);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] nilDietController.getRequests failed:', error);
    next(error);
  }
}

/**
 * Approve a Nil Diet Request
 */
async function approveRequest(req, res, next) {
  const { id } = req.params;
  const adminId = req.user.id;

  try {
    const requestId = parseInt(id);
    const [request] = await db.select().from(nilDietRequests).where(eq(nilDietRequests.id, requestId));

    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    if (req.user.role === 'district_admin' && request.districtId !== req.user.districtId) {
      return res.status(403).json({ error: 'Not authorized to manage requests outside your district.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request cannot be approved because status is already '${request.status}'.` });
    }

    // Update status to approved
    await db.update(nilDietRequests).set({ status: 'approved' }).where(eq(nilDietRequests.id, requestId));

    // Generate date range array (inclusive)
    const start = new Date(request.fromDate);
    const end = new Date(request.toDate);
    const dateList = [];
    let current = new Date(start);

    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dateList.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
    }

    // Upsert each date as false for all meals
    for (const d of dateList) {
      const [existing] = await db.select().from(mealAttendance).where(
        and(
          eq(mealAttendance.userId, request.userId),
          eq(mealAttendance.date, d)
        )
      );

      if (existing) {
        const updateObj = {};
        if (request.morningDiet) {
          updateObj.morningNormal = false;
          updateObj.morningHalfSpecial = false;
          updateObj.morningFullSpecial = false;
        }
        if (request.eveningDiet) {
          updateObj.eveningNormal = false;
          updateObj.eveningHalfSpecial = false;
          updateObj.eveningFullSpecial = false;
        }
        if (Object.keys(updateObj).length > 0) {
          await db.update(mealAttendance).set(updateObj).where(eq(mealAttendance.id, existing.id));
        }
      } else {
        await db.insert(mealAttendance).values({
          userId: request.userId,
          districtId: request.districtId,
          date: d,
          morningNormal: false,
          morningHalfSpecial: false,
          morningFullSpecial: false,
          eveningNormal: false,
          eveningHalfSpecial: false,
          eveningFullSpecial: false
        });
      }
    }

    await logAudit(adminId, 'APPROVE_NIL_DIET_REQUEST', `Approved Request #${requestId} for user #${request.userId} from ${request.fromDate} to ${request.toDate}`);

    return res.status(200).json({ message: 'Nil Diet Request approved and ledger updated successfully!' });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] nilDietController.approveRequest failed:', error);
    next(error);
  }
}

/**
 * Reject a Nil Diet Request
 */
async function rejectRequest(req, res, next) {
  const { id } = req.params;
  const adminId = req.user.id;

  try {
    const requestId = parseInt(id);
    const [request] = await db.select().from(nilDietRequests).where(eq(nilDietRequests.id, requestId));

    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    if (req.user.role === 'district_admin' && request.districtId !== req.user.districtId) {
      return res.status(403).json({ error: 'Not authorized to manage requests outside your district.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request cannot be rejected because status is already '${request.status}'.` });
    }

    // Update status to rejected
    await db.update(nilDietRequests).set({ status: 'rejected' }).where(eq(nilDietRequests.id, requestId));

    await logAudit(adminId, 'REJECT_NIL_DIET_REQUEST', `Rejected Request #${requestId} for user #${request.userId}`);

    return res.status(200).json({ message: 'Nil Diet Request rejected successfully!' });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] nilDietController.rejectRequest failed:', error);
    next(error);
  }
}

/**
 * Delete Nil Diet Request
 * - Owner member or administrative user can delete the request
 */
async function deleteRequest(req, res, next) {
  const requestId = parseInt(req.params.id);
  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID.' });
  }

  try {
    const [request] = await db.select().from(nilDietRequests).where(eq(nilDietRequests.id, requestId));
    if (!request) {
      return res.status(404).json({ error: 'Nil Diet Request not found.' });
    }

    // Verify permission: Must be owner or admin of the same district
    const isOwner = request.userId === req.user.id;
    const isAdminOfDistrict = (req.user.role === 'district_admin' || req.user.role === 'super_admin') &&
      (req.user.role === 'super_admin' || request.districtId === req.user.districtId);

    if (!isOwner && !isAdminOfDistrict) {
      return res.status(403).json({ error: 'Access denied. You do not have permission to delete this request.' });
    }

    // A standard user (member) cannot delete a request that has already been approved or rejected
    if (isOwner && request.status !== 'pending' && req.user.role === 'user') {
      return res.status(400).json({ error: 'Cannot cancel or delete a request that has already been approved or rejected.' });
    }

    // Delete request from database
    await db.delete(nilDietRequests).where(eq(nilDietRequests.id, requestId));

    await logAudit(req.user.id, 'DELETE_NIL_DIET_REQUEST', `Deleted Request #${requestId} of user #${request.userId}`);

    return res.status(200).json({ message: 'Nil Diet Request deleted successfully.' });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] nilDietController.deleteRequest failed:', error);
    next(error);
  }
}

module.exports = {
  submitRequest,
  getRequests,
  approveRequest,
  rejectRequest,
  deleteRequest
};
