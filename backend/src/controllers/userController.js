const { db } = require('../db/index');
const { users } = require('../db/schema');
const { useRealOtp, verifyStoredOtp, isEmailAuthorized } = require('./authController');

/**
 * Controller to create a new user record after verifying OTP
 */
async function createUser(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] userController.createUser - Params:', req.body);

  const { name, pno, mobile, email, otp } = req.body;

  try {
    // 1. Validation Segment
    console.log('>>> [LOGICAL SEGMENT - VALIDATION] Validating required parameters...');
    if (!name || !pno || !mobile || !email || !otp) {
      console.log('>>> [CONTROLLER EXIT] userController.createUser - Error: Missing parameters');
      return res.status(400).json({ error: 'All fields (Name, PNO, Mobile, Email, and OTP) are required.' });
    }

    if (!isEmailAuthorized(email)) {
      console.log(`>>> [CONTROLLER EXIT] userController.createUser - Error: Unauthorized email ${email}`);
      return res.status(403).json({ error: 'This email is not authorized to register.' });
    }

    // 2. Authentication Segment
    console.log('>>> [LOGICAL SEGMENT - OTP VERIFICATION] Verifying OTP...');
    if (useRealOtp) {
      const isValid = verifyStoredOtp(email, otp);
      if (!isValid) {
        console.log('>>> [CONTROLLER EXIT] userController.createUser - Error: OTP invalid or expired');
        return res.status(401).json({ error: 'OTP verification failed. Invalid or expired OTP code.' });
      }
      console.log('>>> [LOGICAL SEGMENT - OTP VERIFICATION] OTP successfully verified.');
    } else {
      console.log('>>> [MOCK VERIFICATION] Verifying simulated OTP...');
      if (otp.length < 4) {
        console.log('>>> [CONTROLLER EXIT] userController.createUser - Error: Mock OTP too short');
        return res.status(401).json({ error: 'OTP must be at least 4 digits.' });
      }
      console.log('>>> [MOCK VERIFICATION] Simulated OTP successfully verified.');
    }

    // 3. Database Insertion Segment
    console.log('>>> [LOGICAL SEGMENT - DB INSERTION] Inserting user via Drizzle ORM...');
    try {
      const insertedUsers = await db.insert(users).values({
        name,
        pno,
        mobile,
        email
      }).returning();

      console.log('>>> [DB SUCCESS] Record inserted successfully:', insertedUsers[0]);
      console.log('>>> [CONTROLLER EXIT] userController.createUser - Status: Success');
      return res.status(201).json({
        message: 'Registration successful!',
        user: insertedUsers[0]
      });
    } catch (dbError) {
      // Check for PostgreSQL Unique Constraint Violation (PNO must be unique)
      if (dbError.code === '23505') {
        console.warn(`>>> [DB WARNING] Unique constraint violation on pno: ${pno}`);
        console.log('>>> [CONTROLLER EXIT] userController.createUser - Error: PNO already exists');
        return res.status(409).json({ error: 'A user with this Personal Number (PNO) already exists.' });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.createUser failed:', error);
    next(error);
  }
}

/**
 * Controller to fetch all user records
 */
async function getUsers(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] userController.getUsers');

  try {
    console.log('>>> [LOGICAL SEGMENT - DB FETCH] Fetching users list via Drizzle ORM...');
    const usersList = await db.select().from(users);
    
    console.log(`>>> [DB SUCCESS] Fetched ${usersList.length} users successfully.`);
    console.log('>>> [CONTROLLER EXIT] userController.getUsers - Status: Success');
    return res.status(200).json(usersList);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] userController.getUsers failed:', error);
    next(error);
  }
}

module.exports = {
  createUser,
  getUsers
};
