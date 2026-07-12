const { db } = require('../db/index');
const { monthlyBills, payments, users, mealAttendance } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');
const fs = require('fs');
const path = require('path');
const { logAudit } = require('../utils/logger');

const ratesFilePath = path.join(__dirname, '../config/rates.json');

/**
 * Retrieve current meal rates from config file (fallback to defaults if missing)
 */
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

/**
 * Persist updated meal rates to config JSON file
 */
function saveRates(rates) {
  try {
    const dir = path.dirname(ratesFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ratesFilePath, JSON.stringify(rates, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('>>> [RATES WRITE ERROR] Failed to save rates config:', err);
    return false;
  }
}

/**
 * GET endpoint to fetch active meal rates
 */
async function getRates(req, res, next) {
  try {
    const rates = loadRates();
    return res.status(200).json(rates);
  } catch (error) {
    next(error);
  }
}

/**
 * POST endpoint to set meal rates (Admin only)
 */
async function setRates(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] billController.setRates - Params:', req.body);
  const { normalDiet, halfSpecialDiet, fullSpecialDiet } = req.body;
  const adminId = req.user.id;

  try {
    if (normalDiet === undefined || halfSpecialDiet === undefined || fullSpecialDiet === undefined) {
      return res.status(400).json({ error: 'NormalDiet, HalfSpecialDiet, and FullSpecialDiet rates are required.' });
    }

    const rates = {
      normalDiet: parseFloat(normalDiet),
      halfSpecialDiet: parseFloat(halfSpecialDiet),
      fullSpecialDiet: parseFloat(fullSpecialDiet)
    };

    const success = saveRates(rates);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save updated rates.' });
    }

    await logAudit(adminId, 'SET_RATES', `Updated meal rates: N: ${rates.normalDiet}, H: ${rates.halfSpecialDiet}, F: ${rates.fullSpecialDiet}`);

    return res.status(200).json({ message: 'Rates updated successfully!', rates });
  } catch (error) {
    next(error);
  }
}

/**
 * POST endpoint to generate monthly bills for all active personnel (Admin only)
 */
async function generateMonthlyBills(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] billController.generateMonthlyBills - Params:', req.body);
  const { month, year } = req.body; // e.g. month: 7, year: 2026
  const adminId = req.user.id;
  const adminDistrictId = req.user.districtId;

  try {
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and Year parameters are required.' });
    }
    if (!adminDistrictId) {
      return res.status(400).json({ error: 'Admin is not assigned to a district.' });
    }

    const rates = loadRates();
    const activeUsers = await db.select().from(users).where(
      and(
        eq(users.isActive, true),
        eq(users.role, 'user'),
        eq(users.districtId, adminDistrictId)
      )
    );

    let generatedCount = 0;

    for (const user of activeUsers) {
      // 1. Fetch user attendance records for the target month & year
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`; // SQL date comparison will handle bounds

      const attendanceRecords = await db.select().from(mealAttendance)
        .where(
          and(
            eq(mealAttendance.userId, user.id),
            sql`${mealAttendance.date} >= ${startDate}`,
            sql`${mealAttendance.date} <= ${endDate}`
          )
        );

      // 2. Count consumed meals
      let normalDietCount = 0;
      let halfSpecialDietCount = 0;
      let fullSpecialDietCount = 0;

      attendanceRecords.forEach(record => {
        if (record.morningNormal) normalDietCount++;
        if (record.eveningNormal) normalDietCount++;
        if (record.morningHalfSpecial) halfSpecialDietCount++;
        if (record.eveningHalfSpecial) halfSpecialDietCount++;
        if (record.morningFullSpecial) fullSpecialDietCount++;
        if (record.eveningFullSpecial) fullSpecialDietCount++;
      });

      const totalMeals = normalDietCount + halfSpecialDietCount + fullSpecialDietCount;
      const totalAmount = (normalDietCount * rates.normalDiet) + (halfSpecialDietCount * rates.halfSpecialDiet) + (fullSpecialDietCount * rates.fullSpecialDiet);

      // 3. Insert or update the monthly bill record
      const [existingBill] = await db.select().from(monthlyBills)
        .where(
          and(
            eq(monthlyBills.userId, user.id),
            eq(monthlyBills.month, parseInt(month)),
            eq(monthlyBills.year, parseInt(year))
          )
        );

      if (existingBill) {
        // If unpaid, update the amount/meal count. Avoid overwriting already paid bills.
        if (existingBill.status === 'unpaid') {
          await db.update(monthlyBills)
            .set({
              totalMeals,
              totalAmount: totalAmount.toFixed(2),
              createdAt: new Date()
            })
            .where(eq(monthlyBills.id, existingBill.id));
          generatedCount++;
        }
      } else {
        await db.insert(monthlyBills).values({
          userId: user.id,
          districtId: user.districtId,
          month: parseInt(month),
          year: parseInt(year),
          totalMeals,
          totalAmount: totalAmount.toFixed(2),
          status: 'unpaid'
        });
        generatedCount++;
      }
    }

    await logAudit(adminId, 'GENERATE_BILLS', `Generated ${generatedCount} monthly bills for ${month}/${year}`);

    return res.status(200).json({ 
      message: `Successfully generated/updated ${generatedCount} bills for the period ${month}/${year}.` 
    });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] billController.generateMonthlyBills failed:', error);
    next(error);
  }
}

/**
 * GET endpoint to fetch bills. Admins get all, personnel get their own.
 */
async function getBills(req, res, next) {
  const userId = req.user.id;
  const role = req.user.role;
  const userDistrictId = req.user.districtId;

  try {
    let billsList;

    if (role === 'district_admin' || role === 'super_admin') {
      // Fetch all bills and join with user details
      const conditions = [];
      if (role === 'district_admin' && userDistrictId) {
        conditions.push(eq(monthlyBills.districtId, userDistrictId));
      }

      billsList = await db.select({
        id: monthlyBills.id,
        userId: monthlyBills.userId,
        userName: users.fullName,
        email: users.email,
        month: monthlyBills.month,
        year: monthlyBills.year,
        totalMeals: monthlyBills.totalMeals,
        totalAmount: monthlyBills.totalAmount,
        status: monthlyBills.status,
        createdAt: monthlyBills.createdAt
      })
      .from(monthlyBills)
      .leftJoin(users, eq(monthlyBills.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${monthlyBills.year} DESC`, sql`${monthlyBills.month} DESC`);
    } else {
      // Fetch user's own bills
      billsList = await db.select({
        id: monthlyBills.id,
        userId: monthlyBills.userId,
        month: monthlyBills.month,
        year: monthlyBills.year,
        totalMeals: monthlyBills.totalMeals,
        totalAmount: monthlyBills.totalAmount,
        status: monthlyBills.status,
        createdAt: monthlyBills.createdAt
      })
      .from(monthlyBills)
      .where(eq(monthlyBills.userId, userId))
      .orderBy(sql`${monthlyBills.year} DESC`, sql`${monthlyBills.month} DESC`);
    }

    return res.status(200).json(billsList);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] billController.getBills failed:', error);
    next(error);
  }
}

/**
 * POST endpoint to mark a monthly bill as paid (Admin only)
 */
async function markBillAsPaid(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] billController.markBillAsPaid - Params:', req.body);
  const { billId, paymentMode, transactionId } = req.body;
  const adminId = req.user.id;

  try {
    if (!billId || !paymentMode) {
      return res.status(400).json({ error: 'Bill ID and Payment Mode (Cash/Online) are required.' });
    }

    const [bill] = await db.select().from(monthlyBills).where(eq(monthlyBills.id, billId));
    if (!bill) {
      return res.status(404).json({ error: 'Bill record not found.' });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({ error: 'This bill is already marked as paid.' });
    }

    // 1. Update bill status to 'paid'
    await db.update(monthlyBills)
      .set({ status: 'paid' })
      .where(eq(monthlyBills.id, billId));

    // 2. Insert transaction payment record
    const [paymentRecord] = await db.insert(payments).values({
      billId,
      userId: bill.userId,
      districtId: bill.districtId,
      amount: bill.totalAmount,
      paymentMode: paymentMode.trim(),
      transactionId: transactionId ? transactionId.trim() : null
    }).returning();

    await logAudit(adminId, 'PAY_BILL', `Marked Bill #${billId} for User #${bill.userId} as PAID via ${paymentMode}`);

    return res.status(200).json({ 
      message: 'Bill successfully marked as paid!', 
      payment: paymentRecord 
    });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] billController.markBillAsPaid failed:', error);
    next(error);
  }
}

module.exports = {
  getRates,
  setRates,
  generateMonthlyBills,
  getBills,
  markBillAsPaid
};
