const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

let supabase;
const isSupabaseConfigured = supabaseUrl && supabaseUrl !== 'placeholder' && supabaseAnonKey && supabaseAnonKey !== 'placeholder';
const isResendConfigured = resendApiKey && resendApiKey !== 'placeholder';
const bypassOtp = process.env.DEV_BYPASS_OTP === 'true';
const useRealOtp = isResendConfigured && !bypassOtp;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('>>> [AUTH INIT] Supabase client initialized.');
}

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
 * Helper to check if an email is authorized
 */
function isEmailAuthorized(email) {
  const allowedEmailsStr = process.env.ALLOWED_EMAILS || '';
  if (!allowedEmailsStr) {
    // If no restriction list is specified, we authorize all emails for development ease
    return true;
  }
  const allowedEmails = allowedEmailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowedEmails.includes(email.trim().toLowerCase());
}

/**
 * Controller to send OTP to the specified email
 */
async function sendOtp(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] authController.sendOtp - Params:', req.body);
  
  const { email } = req.body;
  
  try {
    if (!email) {
      console.log('>>> [CONTROLLER EXIT] authController.sendOtp - Error: Missing email');
      return res.status(400).json({ error: 'Email field is required.' });
    }

    if (!isEmailAuthorized(email)) {
      console.log(`>>> [CONTROLLER EXIT] authController.sendOtp - Unauthorized Email Attempt: ${email}`);
      return res.status(403).json({ error: 'This email is not authorized for Mess Management access.' });
    }

    if (useRealOtp) {
      console.log(`>>> [AUTH LOG] Sending OTP via Resend for: ${email}`);
      
      // Generate a 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in memory
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
          subject: 'Your OTP Verification Code',
          html: `<p>Your OTP verification code is <strong>${otp}</strong>.</p><p>This code is valid for 5 minutes.</p>`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend email sending failed: ${errorText}`);
      }
      
      console.log('>>> [CONTROLLER EXIT] authController.sendOtp - Status: Success');
      return res.status(200).json({ message: 'OTP sent successfully! Please check your inbox.' });
    } else {
      console.log(`>>> [MOCK AUTH] Simulated OTP successfully sent to: ${email}`);
      console.log('>>> [CONTROLLER EXIT] authController.sendOtp - Status: Success');
      return res.status(200).json({ 
        message: 'Development Bypass Mode: Enter any 6-digit code (e.g., 123456).' 
      });
    }
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] authController.sendOtp failed:', error);
    next(error);
  }
}

module.exports = {
  sendOtp,
  isEmailAuthorized,
  isSupabaseConfigured,
  useRealOtp,
  verifyStoredOtp,
  activeOtps,
  supabase
};
