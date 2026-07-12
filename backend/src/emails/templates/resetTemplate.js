const getResetPasswordEmailTemplate = (otp, expiryMinutes = 10) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px 30px; text-align: center; }
        .otp-box { display: inline-block; background: #f3f4f6; border: 2px dashed #ef4444; border-radius: 8px; font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #ef4444; padding: 15px 30px; margin: 30px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        p { line-height: 1.6; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RESET PASSWORD REQUEST</h1>
        </div>
        <div class="content">
          <h2>Reset Password Verification</h2>
          <p>We received a request to reset your password. Use the verification code below to authorize the password reset:</p>
          <div class="otp-box">${otp}</div>
          <p>This code is valid for <strong>${expiryMinutes} minutes</strong>. If you did not request a password reset, please secure your account immediately.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 Mess Management System. Security Alerts.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { getResetPasswordEmailTemplate };
