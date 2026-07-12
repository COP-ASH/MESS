const { eq, and, gt, sql, desc } = require('drizzle-orm');
const { db } = require('../db');
const schema = require('../db/schema');
const UserRepository = require('../repositories/userRepository');
const emailService = require('./emailService');
const { logAction } = require('./logService');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/password');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../utils/errors');
const config = require('../config');

// Helper to check whitelisted emails
const getWhitelistedEmails = async () => {
  try {
    const whitelistSetting = await db.select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'allowed_emails'))
      .limit(1);
    const emailsStr = whitelistSetting[0]?.value || '';
    return emailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  } catch (error) {
    console.error('Failed to load whitelisted emails, falling back to config ALLOWED_EMAILS:', error);
    return (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
};

const requestOtp = async (email) => {
  const emailLower = email.toLowerCase();

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

  // Store in database
  await db.insert(schema.otpVerifications).values({
    email: emailLower,
    otp,
    expiresAt,
  });

  console.log(`>>> [OTP GENERATED] To: ${emailLower} | Code: ${otp}`);
  
  // Dispatch via Resend
  await emailService.sendOtp(emailLower, otp);
  return { success: true, message: 'OTP sent to email.' };
};

const verifyOtpHelper = async (email, otp) => {
  const emailLower = email.toLowerCase();

  // Dev bypass check
  if (config.DEV_BYPASS_OTP && otp === '123456') {
    return true;
  }

  // Find recent active OTP
  const records = await db.select()
    .from(schema.otpVerifications)
    .where(
      and(
        eq(schema.otpVerifications.email, emailLower),
        eq(schema.otpVerifications.otp, otp),
        gt(schema.otpVerifications.expiresAt, sql`timezone('utc', now())`)
      )
    )
    .orderBy(desc(schema.otpVerifications.createdAt))
    .limit(1);

  if (records.length === 0) {
    return false;
  }

  // Delete used OTP
  await db.delete(schema.otpVerifications).where(eq(schema.otpVerifications.id, records[0].id));
  return true;
};

const register = async (registerData) => {
  const emailLower = registerData.email.toLowerCase();

  // 1. Verify OTP first
  const isValidOtp = await verifyOtpHelper(emailLower, registerData.otp);
  if (!isValidOtp) {
    throw new BadRequestError('Invalid or expired OTP code.');
  }

  // 2. Check if user already exists
  const existingUser = await UserRepository.findByEmail(emailLower);
  if (existingUser) {
    throw new BadRequestError('Email address is already registered.');
  }

  // 3. Verify district exists and is active
  const district = await db.select().from(schema.districts).where(eq(schema.districts.id, registerData.districtId)).limit(1);
  if (district.length === 0) {
    throw new NotFoundError('Selected district not found.');
  }
  if (district[0].status !== 'active') {
    throw new BadRequestError('Cannot register under an inactive district.');
  }

  // 4. Create user
  const hashedPassword = await hashPassword(registerData.password);
  const newUser = await UserRepository.create({
    fullName: registerData.fullName,
    email: emailLower,
    passwordHash: hashedPassword,
    role: 'user', // Register flow defaults to simple user
    districtId: registerData.districtId,
    isVerified: true,
    isActive: true,
  });

  await logAction(newUser.id, 'USER_REGISTRATION', `User successfully registered account via Email OTP verification.`);
  await emailService.sendWelcome(newUser.email, newUser.fullName);

  return newUser;
};

const login = async (email, password) => {
  const emailLower = email.toLowerCase();
  const user = await UserRepository.findByEmail(emailLower);

  if (!user) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Your account has been deactivated. Contact your district administrator.');
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Save session
  await db.insert(schema.sessions).values({
    userId: user.id,
    refreshToken,
    expiresAt,
  });

  // Remove sensitive passwordHash from returned object
  const { passwordHash, ...safeUser } = user;

  await logAction(user.id, 'USER_LOGIN', `User logged in successfully.`);
  await emailService.sendLoginAlert(user.email, user.fullName, 'Portal secure web login');

  return {
    user: safeUser,
    token: accessToken,
    refreshToken,
  };
};

const refreshToken = async (rToken) => {
  // Check in DB
  const sessionsList = await db.select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.refreshToken, rToken),
        gt(schema.sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (sessionsList.length === 0) {
    throw new UnauthorizedError('Refresh token is invalid or expired.');
  }

  const session = sessionsList[0];
  const user = await UserRepository.findById(session.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User session is inactive.');
  }

  const newAccessToken = generateAccessToken(user);
  return { token: newAccessToken };
};

const logout = async (rToken) => {
  const deleted = await db.delete(schema.sessions)
    .where(eq(schema.sessions.refreshToken, rToken))
    .returning();
  
  if (deleted.length > 0) {
    await logAction(deleted[0].userId, 'USER_LOGOUT', `User logged out and refresh session terminated.`);
  }
  return { success: true };
};

const forgotPassword = async (email) => {
  const emailLower = email.toLowerCase();
  const user = await UserRepository.findByEmail(emailLower);
  
  if (!user) {
    // Return success to prevent email enumeration attacks in production
    console.log(`>>> [FORGOT PASSWORD] Attempted for unregistered email: ${emailLower}`);
    return { success: true, message: 'If the email exists, a reset code was sent.' };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

  await db.insert(schema.otpVerifications).values({
    email: emailLower,
    otp,
    expiresAt,
  });

  console.log(`>>> [FORGOT PASSWORD OTP] Email: ${emailLower} | Code: ${otp}`);
  await emailService.sendResetOtp(emailLower, otp);

  return { success: true, message: 'Password reset OTP sent.' };
};

const resetPassword = async (email, otp, newPassword) => {
  const emailLower = email.toLowerCase();
  const user = await UserRepository.findByEmail(emailLower);
  
  if (!user) {
    throw new NotFoundError('User account not found.');
  }

  const isValidOtp = await verifyOtpHelper(emailLower, otp);
  if (!isValidOtp) {
    throw new BadRequestError('Invalid or expired OTP code.');
  }

  const hashedPassword = await hashPassword(newPassword);
  await UserRepository.update(user.id, { passwordHash: hashedPassword });

  await logAction(user.id, 'PASSWORD_RESET', `User password reset successfully using recovery OTP.`);
  await emailService.sendLoginAlert(user.email, user.fullName, 'Password changed via recovery OTP reset');

  return { success: true, message: 'Password reset completed successfully.' };
};

module.exports = {
  requestOtp,
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
