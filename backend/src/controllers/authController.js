const { db } = require('../db/index');
const { policeUsers, roles } = require('../db/schema');
const { eq } = require('drizzle-orm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/logger');
const { registerFailedAttempt, resetFailedAttempts } = require('../middleware/rateLimiter');

require('dotenv').config();

const resendApiKey = process.env.RESEND_API_KEY;
const isResendConfigured = resendApiKey && resendApiKey !== 'placeholder';
const bypassOtp = process.env.DEV_BYPASS_OTP === 'true';
const useRealOtp = isResendConfigured && !bypassOtp;

if (isResendConfigured) {
  console.log('>>> [AUTH INIT] Resend service configured.');
} else {
  console.warn('>>> [AUTH WARNING] Resend API Key is missing. Fallback to Mock OTP mode.');
}

if (bypassOtp) {
  console.log('>>> [AUTH INFO] DEV_BYPASS_OTP is enabled. Bypassing real OTP verification.');
}

// In-memory store for active OTP codes: email -> { otp, expiresAt }
const activeOtps = new Map();

/**
 * Verify a code for an email address
 */
function verifyStoredOtp(email, token) {
  if (!email || !token) return false;
  const key = email.trim().toLowerCase();
  const record = activeOtps.get(key);
  if (!record) {
    console.warn(`>>> [OTP VERIFY] No OTP record found for email: ${key}`);
    return false;
  }
  
  if (Date.now() > record.expiresAt) {
    console.warn(`>>> [OTP VERIFY] OTP code expired for: ${key}`);
    activeOtps.delete(key);
    return false;
  }

  if (record.otp === token.trim()) {
    console.log(`>>> [OTP VERIFY] OTP code successfully verified for: ${key}`);
    activeOtps.delete(key); // single-use OTP
    return true;
  }

  console.warn(`>>> [OTP VERIFY] Invalid OTP token code submitted for: ${key}`);
  return false;
}

/**
 * Helper to check if an email is authorized in the whitelist
 */
function isEmailAuthorized(email) {
  const allowedEmailsStr = process.env.ALLOWED_EMAILS || '';
  if (!allowedEmailsStr) {
    return true; // No restrictions in development
  }
  const allowedEmails = allowedEmailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowedEmails.includes(email.trim().toLowerCase());
}

/**
 * Endpoint to request signup OTP email
 */
async function sendOtp(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] authController.sendOtp - Params:', req.body);
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ error: 'Email field is required.' });
    }

    if (!isEmailAuthorized(email)) {
      console.warn(`>>> [SECURITY WARNING] Unauthorized email registration attempt: ${email}`);
      return res.status(403).json({ error: 'This email address is not authorized for Mess System registration.' });
    }

    if (useRealOtp) {
      console.log(`>>> [AUTH LOG] Sending OTP via Resend for: ${email}`);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      activeOtps.set(email.trim().toLowerCase(), {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes expiration
      });

      const senderEmail = process.env.SENDER_EMAIL || 'Mess Manager <onboarding@resend.dev>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [email.trim().toLowerCase()],
          subject: 'UP Police Mess Management - Registration OTP',
          html: `<h3>UP Police Mess Verification</h3><p>Your registration OTP is <strong>${otp}</strong>.</p><p>This code is valid for 5 minutes.</p>`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API error: ${errorText}`);
      }
      
      return res.status(200).json({ message: 'OTP sent successfully! Please check your email inbox.' });
    } else {
      console.log(`>>> [MOCK AUTH] Simulated OTP successfully sent to: ${email}`);
      return res.status(200).json({ 
        message: 'Development Bypass Mode: Enter any 6-digit code (e.g., 123456).' 
      });
    }
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] authController.sendOtp failed:', error);
    next(error);
  }
}

/**
 * Register a new police officer record
 */
async function register(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] authController.register - Params:', req.body);
  const { name, pno, rank, postingUnit, mobile, email, password, otp } = req.body;

  try {
    if (!name || !pno || !rank || !postingUnit || !mobile || !email || !password || !otp) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!isEmailAuthorized(email)) {
      return res.status(403).json({ error: 'This email is not whitelisted.' });
    }

    // 1. Verify OTP
    if (useRealOtp) {
      const isOtpValid = verifyStoredOtp(email, otp);
      if (!isOtpValid) {
        return res.status(401).json({ error: 'Invalid or expired OTP code.' });
      }
    } else {
      if (otp.length < 4) {
        return res.status(401).json({ error: 'Mock OTP must be at least 4 digits.' });
      }
    }

    // 2. Check if user already exists (by email or PNO)
    const existingPno = await db.select().from(policeUsers).where(eq(policeUsers.pno, pno.trim()));
    if (existingPno.length > 0) {
      return res.status(409).json({ error: 'A user with this Personal Number (PNO) already exists.' });
    }

    const existingEmail = await db.select().from(policeUsers).where(eq(policeUsers.email, email.trim().toLowerCase()));
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'A user with this Email address already exists.' });
    }

    // 3. Auto-promote admin emails for easier developer access
    const isAdminEmail = email.trim().toLowerCase() === 'vicky.nick1991@gmail.com' || email.trim().toLowerCase().startsWith('admin@');
    const roleId = isAdminEmail ? 1 : 2; // 1 = Admin, 2 = Police Personnel
    const status = isAdminEmail ? 'active' : 'pending'; // Admins auto-approved

    // 4. Hash password and insert record
    const passwordHash = bcrypt.hashSync(password, 10);
    const [newUser] = await db.insert(policeUsers).values({
      name: name.trim(),
      pno: pno.trim(),
      rank: rank.trim(),
      postingUnit: postingUnit.trim(),
      mobile: mobile.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      roleId,
      status
    }).returning();

    await logAudit(newUser.id, 'REGISTRATION', `User successfully registered. Rank: ${rank}, PNO: ${pno}. Status: ${status}`);

    return res.status(201).json({ 
      message: status === 'active' 
        ? 'Registration successful! You can log in now.' 
        : 'Registration successful! Your account is pending Admin approval.'
    });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] authController.register failed:', error);
    next(error);
  }
}

/**
 * Login handler returning JWT token
 */
async function login(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] authController.login - Params:', req.body);
  const { loginId, password } = req.body; // loginId can be PNO or Email
  const clientIp = req.ip;

  try {
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Login ID (PNO/Email) and Password are required.' });
    }

    // 1. Fetch user by email or pno
    let user;
    const isEmail = loginId.includes('@');
    if (isEmail) {
      [user] = await db.select().from(policeUsers).where(eq(policeUsers.email, loginId.trim().toLowerCase()));
    } else {
      [user] = await db.select().from(policeUsers).where(eq(policeUsers.pno, loginId.trim()));
    }

    if (!user) {
      registerFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Incorrect login credentials.' });
    }

    // 2. Validate Password
    const isPasswordCorrect = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordCorrect) {
      registerFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Incorrect login credentials.' });
    }

    // 3. Check Account Status
    if (user.status !== 'active') {
      return res.status(403).json({ 
        error: user.status === 'pending'
          ? 'Your account registration is pending Admin approval.'
          : 'Your account has been deactivated. Please contact the Mess In-Charge.'
      });
    }

    // 4. Fetch Role Name
    const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId));
    const roleName = role ? role.name : 'Police Personnel';

    // 5. Generate secure JWT token
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        pno: user.pno,
        email: user.email,
        rank: user.rank,
        roleId: user.roleId,
        roleName
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    resetFailedAttempts(clientIp);
    await logAudit(user.id, 'LOGIN', 'Successful login session started.');

    return res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleName
      }
    });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] authController.login failed:', error);
    next(error);
  }
}

module.exports = {
  sendOtp,
  register,
  login,
  useRealOtp
};
