const getWelcomeEmailTemplate = (fullName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Mess Management</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px 30px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        p { line-height: 1.6; margin: 10px 0; }
        .btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>WELCOME TO THE PORTAL</h1>
        </div>
        <div class="content">
          <h2>Hello, ${fullName}!</h2>
          <p>Your account has been successfully verified and created on the Mess Management System.</p>
          <p>You can now log in to the portal using your registered email address and password to view mess information, update your profile, and manage your billing history.</p>
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/login.html" class="btn" style="color: #ffffff;">Access Portal</a>
          </div>
        </div>
        <div class="footer">
          <p>&copy; 2026 Mess Management System. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { getWelcomeEmailTemplate };
