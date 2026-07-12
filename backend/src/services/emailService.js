const { Resend } = require('resend');
const config = require('../config');
const { getOtpEmailTemplate } = require('../emails/templates/otpTemplate');
const { getWelcomeEmailTemplate } = require('../emails/templates/welcomeTemplate');
const { getResetPasswordEmailTemplate } = require('../emails/templates/resetTemplate');
const { getAlertEmailTemplate } = require('../emails/templates/alertTemplate');

let resend;
if (config.RESEND_API_KEY) {
  resend = new Resend(config.RESEND_API_KEY);
}

const sendEmail = async (to, subject, htmlContent) => {
  if (config.DEV_BYPASS_OTP) {
    console.log(`>>> [EMAIL BYPASS] Development Mode Enabled. Skipping actual email dispatch.`);
    console.log(`>>> [EMAIL BYPASS] To: ${to}`);
    console.log(`>>> [EMAIL BYPASS] Subject: ${subject}`);
    console.log(`>>> [EMAIL BYPASS] Content preview contains key values.`);
    return { success: true, bypassed: true };
  }

  if (!resend) {
    console.warn('>>> [EMAIL WARNING] Resend API Key is missing. Email was NOT sent. Printing HTML to stdout:');
    console.log(htmlContent);
    return { success: false, error: 'Resend API key missing' };
  }

  try {
    const data = await resend.emails.send({
      from: config.EMAIL_FROM,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`>>> [EMAIL SUCCESS] Sent email to ${to}. Resend ID:`, data.id || data);
    return { success: true, data };
  } catch (error) {
    console.error(`>>> [EMAIL ERROR] Failed to send email to ${to}:`, error);
    return { success: false, error };
  }
};

const sendOtp = async (email, otp) => {
  const html = getOtpEmailTemplate(otp);
  return sendEmail(email, 'Verify Your Email - Mess Management Portal', html);
};

const sendWelcome = async (email, fullName) => {
  const html = getWelcomeEmailTemplate(fullName);
  return sendEmail(email, 'Welcome to Mess Management Portal', html);
};

const sendResetOtp = async (email, otp) => {
  const html = getResetPasswordEmailTemplate(otp);
  return sendEmail(email, 'Reset Your Password - Mess Management Portal', html);
};

const sendLoginAlert = async (email, fullName, details = '') => {
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const message = `A new login was recorded for your account on ${dateStr}. Details: ${details || 'Web browser access'}.`;
  const html = getAlertEmailTemplate(fullName, message);
  return sendEmail(email, 'Security Alert: New Login Detected', html);
};

module.exports = {
  sendOtp,
  sendWelcome,
  sendResetOtp,
  sendLoginAlert,
};
