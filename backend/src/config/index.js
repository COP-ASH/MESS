require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'up_police_mess_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.SENDER_EMAIL || 'Mess Manager <otp@copash.shop>',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEV_BYPASS_OTP: process.env.DEV_BYPASS_OTP === 'true',
};
