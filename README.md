# Mess Management Software

A simple, interactive Mess Management Software split into `frontend/` (hosted on GitHub Pages) and `backend/` (hosted on Render), using Supabase (PostgreSQL) with Drizzle ORM and Authorized Email OTP authentication.

## Project Structure
```
MESS/
├── frontend/             # Frontend application (Vanilla HTML/CSS/JS)
│   ├── index.html        # Registration form with voice input and OTP verification
│   ├── view.html         # Data view table with voice search and exports
│   ├── style.css         # Modern, responsive glassmorphic CSS styling
│   └── app.js            # Frontend JavaScript controller (API integration, Exports, Voice)
└── backend/              # Node.js Express server
    ├── src/
    │   ├── db/
    │   │   ├── index.js  # Database pool & Drizzle ORM initialization
    │   │   └── schema.js # Drizzle schema for users
    │   ├── controllers/  # Route controllers (with entry/exit logs)
    │   └── routes/       # Express Router mappings
    ├── drizzle.config.js # Drizzle CLI setup
    ├── migrate.js        # Startup DB migrations
    ├── server.js         # Entry point (CORS, Morgan, Error handlers)
    ├── package.json      # Dependencies and scripts
    └── .env.example      # Backend environment variables reference
```

## Features
1. **Interactive Form Input**: Inputs for Name, Personal Number (PNO), Mobile Number, and Email.
2. **Authorized Email OTP**: Double verification. Requires the email to be authorized first (configured in `.env`), sends a 6-digit OTP code to the email via Supabase Auth, and validates it prior to record insertion.
3. **Data View & Export**: Fetches saved records in a beautiful table format, with native "Export to PDF" and "Export to Excel" options using client-side JS libraries.
4. **Voice dictation & search**: Web Speech API support to record form values verbally and search the table records hands-free.
5. **Mobile First**: Fully responsive layouts with customized UI for mobile, tablet, and desktop views.
