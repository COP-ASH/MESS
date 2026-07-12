const getOtpEmailTemplate = (otp, expiryMinutes = 10) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
        .content { padding: 40px 30px; text-align: center; }
        .otp-box { display: inline-block; background: #f3f4f6; border: 2px dashed #6366f1; border-radius: 8px; font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #6366f1; padding: 15px 30px; margin: 30px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        p { line-height: 1.6; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MESS MANAGEMENT PORTAL</h1>
        </div>
        <div class="content">
          <h2>Email Verification</h2>
          <p>Please use the following One-Time Password (OTP) to complete your verification or login process.</p>
          <div class="otp-box">${otp}</div>
          <p>This OTP is valid for <strong>${expiryMinutes} minutes</strong>. Please do not share this code with anyone.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 Mess Management System. Built with Antigravity IDE.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { getOtpEmailTemplate };
