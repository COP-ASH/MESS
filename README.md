# Uttar Pradesh Police - Mess Management System (Full Stack)

A secure, production-ready full-stack government Mess Management System tailored for the Uttar Pradesh Police, featuring role-based access control, Resend email OTP verification, Drizzle ORM + Supabase, and a polished Navy-Crimson government-style UI.

---

## 📂 Project Structure

```
MESS/
├── CNAME                     # GitHub Pages apex domain routing (copash.shop)
├── README.md                 # Complete system documentation
├── frontend/                 # Client-side static application
│   ├── CNAME                 # Subdomain verification helper
│   ├── index.html            # Gateway (auto-redirects to login)
│   ├── login.html            # Secure credentials gateway
│   ├── register.html         # Personnel signup with voice dictation & Resend OTP
│   ├── personnel-dashboard.html # Portal for Constables/Inspectors to check meals, notices & bills
│   ├── admin-dashboard.html  # Admin panel (rates, approvals, menu editing, billing ledger, CSV reports)
│   ├── style.css             # Tri-color UP Police premium styling
│   └── app.js                # Core AJAX fetch routing controller
└── backend/                  # REST API Express Server
    ├── src/
    │   ├── db/
    │   │   ├── index.js      # DB initialization & roles auto-seeding
    │   │   └── schema.js     # Relational database table schemas
    │   ├── controllers/      # API controller logic
    │   │   ├── authController.js       # Signup OTPs, hashing, & JWT sessions
    │   │   ├── menuController.js       # Weekly menu administration
    │   │   ├── attendanceController.js # Attendance logging & summaries
    │   │   ├── billController.js       # Per-meal rates & dynamic calculations
    │   │   ├── noticeController.js     # Announcement boards
    │   │   └── userController.js       # Profiles, approvals & CSV report exports
    │   ├── middleware/       # Route filters
    │   │   ├── authMiddleware.js       # JWT validation & role permissions guard
    │   │   └── rateLimiter.js          # IP lockout for credential protection
    │   ├── routes/           # Express router endpoints
    │   │   ├── authRoutes.js
    │   │   ├── menuRoutes.js
    │   │   ├── attendanceRoutes.js
    │   │   ├── billRoutes.js
    │   │   ├── noticeRoutes.js
    │   │   └── userRoutes.js
    │   └── utils/
    │       └── logger.js     # Centralized database audit log service
    ├── drizzle/              # Generated Drizzle SQL migrations
    ├── drizzle.config.js     # Drizzle Kit CLI configuration
    ├── migrate.js            # Automated startup migrations execution
    ├── server.js             # Main server boot entry point
    ├── package.json          # Node dependencies
    └── .env.example          # Environment variables template
```

---

## 🗄️ Database Relational Schema

### 1. `roles`
*   `id`: `serial` (Primary Key)
*   `name`: `text` (Not Null) — `Admin` or `Police Personnel`

### 2. `police_users`
*   `id`: `serial` (Primary Key)
*   `name`: `text` (Not Null)
*   `pno`: `text` (Unique, Not Null) — Police Personal Number
*   `rank`: `text` (Not Null) — `Constable`, `Sub-Inspector`, etc.
*   `posting_unit`: `text` (Not Null)
*   `mobile`: `text` (Not Null)
*   `email`: `text` (Unique, Not Null) — Whitelist verified
*   `password_hash`: `text` (Not Null)
*   `role_id`: `integer` (Foreign Key referencing `roles.id`)
*   `status`: `text` (Default: `pending`) — `pending`, `active`, `deactivated`
*   `created_at`: `timestamp` (Default: `now()`)

### 3. `mess_menu`
*   `id`: `serial` (Primary Key)
*   `day_of_week`: `text` (Not Null) — `Monday` to `Sunday`
*   `breakfast`: `text` (Not Null)
*   `lunch`: `text` (Not Null)
*   `dinner`: `text` (Not Null)
*   `updated_at`: `timestamp` (Default: `now()`)

### 4. `meal_attendance`
*   `id`: `serial` (Primary Key)
*   `user_id`: `integer` (Foreign Key referencing `police_users.id`)
*   `date`: `date` (Not Null)
*   `breakfast`: `boolean` (Default: `false`)
*   `lunch`: `boolean` (Default: `false`)
*   `dinner`: `boolean` (Default: `false`)
*   `created_at`: `timestamp` (Default: `now()`)

### 5. `monthly_bills`
*   `id`: `serial` (Primary Key)
*   `user_id`: `integer` (Foreign Key referencing `police_users.id`)
*   `month`: `integer` (Not Null) — `1` to `12`
*   `year`: `integer` (Not Null)
*   `total_meals`: `integer` (Default: `0`)
*   `total_amount`: `numeric(10, 2)` (Default: `0.00`)
*   `status`: `text` (Default: `unpaid`) — `paid`, `unpaid`
*   `created_at`: `timestamp` (Default: `now()`)

### 6. `payments`
*   `id`: `serial` (Primary Key)
*   `bill_id`: `integer` (Foreign Key referencing `monthly_bills.id`)
*   `user_id`: `integer` (Foreign Key referencing `police_users.id`)
*   `amount`: `numeric(10, 2)` (Not Null)
*   `payment_mode`: `text` (Not Null) — `Cash` or `Online`
*   `transaction_id`: `text` (Optional)
*   `payment_date`: `timestamp` (Default: `now()`)

### 7. `notices`
*   `id`: `serial` (Primary Key)
*   `title`: `text` (Not Null)
*   `content`: `text` (Not Null)
*   `posted_by`: `integer` (Foreign Key referencing `police_users.id`)
*   `created_at`: `timestamp` (Default: `now()`)

### 8. `audit_logs`
*   `id`: `serial` (Primary Key)
*   `user_id`: `integer` (Foreign Key referencing `police_users.id`, Optional)
*   `action`: `text` (Not Null)
*   `details`: `text` (Optional)
*   `created_at`: `timestamp` (Default: `now()`)

---

## ⚙️ Environment Variables (`.env`)

Configure the following parameters in `backend/.env`:

*   `PORT`: Port the Express server binds to (default: `5000`).
*   `DATABASE_URL`: Connection string to Supabase PostgreSQL database.
*   `SUPABASE_URL`: Supabase project url.
*   `SUPABASE_ANON_KEY`: Client authorization key.
*   `ALLOWED_EMAILS`: Comma-separated list of whitelisted emails allowed to sign up.
*   `DEV_BYPASS_OTP`: If `true`, bypasses Resend emails and uses mock code `123456`.
*   `RESEND_API_KEY`: API key for the Resend service.
*   `JWT_SECRET`: Random character string used to encrypt JWT login tokens.
*   `SENDER_EMAIL`: Address emails are sent from (e.g. `Mess Manager <otp@send.copash.shop>`).

---

## 🛠️ REST API Documentation

### Authentication (`/api/auth`)
*   `POST /send-otp`: Sends a 6-digit OTP code to the requested email (checks whitelist).
*   `POST /register`: Registers a new user. Expects `name`, `pno`, `rank`, `postingUnit`, `mobile`, `email`, `password`, `otp`.
*   `POST /login`: Validates credentials, checks if account is `active`, rate-limits attempts, and returns a JWT token.

### Weekly Menu (`/api/menu`)
*   `GET /`: Fetches the current weekly menu.
*   `POST /update` *[Admin]*: Updates breakfast, lunch, and dinner options for a given day.

### Attendance (`/api/attendance`)
*   `POST /`: Marks or updates meal choices (Breakfast/Lunch/Dinner) for a specific date.
*   `GET /history`: Fetches recent meal attendance history for the logged-in user.
*   `GET /summary` *[Admin]*: Returns aggregate meal counts for a target date.

### Billing Ledger (`/api/bills`)
*   `GET /`: Fetches monthly bill records (all for admins, own for personnel).
*   `GET /rates`: Fetches current meal cost pricing.
*   `POST /rates` *[Admin]*: Sets updated meal costs.
*   `POST /generate` *[Admin]*: Generates/updates bills for all personnel for a specific month and year.
*   `POST /pay` *[Admin]*: Marks an unpaid bill as paid and logs the transaction.

### Notices feed (`/api/notices`)
*   `GET /`: Fetches all posted notice board articles.
*   `POST /` *[Admin]*: Publishes a new announcement.

### Users & Audit (`/api/users`)
*   `GET /profile`: Fetches personal profile data.
*   `POST /profile`: Updates personal profile details.
*   `GET /list` *[Admin]*: Returns users list filtered by status (`pending`/`active`).
*   `POST /status` *[Admin]*: Approves (`active`) or deactivates a user account.
*   `GET /export-attendance` *[Admin]*: Downloads a CSV table of monthly attendance.

---

## 🚀 Run & Deployment Guide

### Local Execution
1. Install dependencies in the `backend/` folder:
   ```bash
   cd backend
   npm install
   ```
2. Generate and apply database migrations:
   ```bash
   npm run build
   ```
3. Run the development server (runs with nodemon):
   ```bash
   npm run dev
   ```
4. Open the frontend locally (e.g. via Live Server on `http://127.0.0.1:5500/frontend/login.html`).

### Production VPS / Render Deployment
1. **Frontend Hosting**:
   Deploy the `frontend/` directory to **GitHub Pages** or **Vercel** as a static website. Configure the custom domain `copash.shop` in your provider's settings.
2. **Backend Hosting**:
   Deploy the `backend/` directory to **Render**, **Railway**, or a **VPS** (e.g., DigitalOcean).
   - Set the build command to: `npm install && npm run build`
   - Set the start command to: `npm start`
   - Configure all environment variables in your host's dashboard.
   - Update `BACKEND_BASE_URL` in [frontend/app.js](file:///c:/Users/Ashwani%20Gupta/OneDrive/Desktop/MESS/frontend/app.js) to point to your live backend domain.
