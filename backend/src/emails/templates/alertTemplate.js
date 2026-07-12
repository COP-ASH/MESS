const getAlertEmailTemplate = (fullName, alertMessage) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Account Notification</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: #3b82f6; padding: 30px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px 30px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        p { line-height: 1.6; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SYSTEM NOTIFICATION</h1>
        </div>
        <div class="content">
          <h2>Dear ${fullName},</h2>
          <p>${alertMessage}</p>
          <p>If you believe this is an error or did not perform this action, please contact the System Administrator immediately.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 Mess Management System. System Security Alerts.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { getAlertEmailTemplate };
