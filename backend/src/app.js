const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const districtRoutes = require('./routes/districtRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const profileRoutes = require('./routes/profileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const menuRoutes = require('./routes/menuRoutes');
const billRoutes = require('./routes/billRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const nilDietRoutes = require('./routes/nilDietRoutes');

const errorHandler = require('./middleware/errorMiddleware');
const { generalRateLimiter } = require('./middleware/rateLimiter');
const { NotFoundError } = require('./utils/errors');

const app = express();

// 1. Security Headers (Helmet)
app.use(helmet());

// 2. CORS Configuration
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://copash.shop',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
    const isCustomDomain = origin.includes('copash.shop') || origin.includes('copash.space') || origin.includes('github.io');
    
    if (isLocalhost || isCustomDomain || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// 3. Request Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Request Logging (Morgan)
app.use(morgan('dev'));

// 5. Global Rate Limiter
app.use(generalRateLimiter);

// 6. API Routes Mapping
app.use('/api/auth', authRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/nildiet', nilDietRoutes);

// Root path check (Render verify / health checks)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Multi-District Mess Management API is operational.',
    timestamp: new Date().toISOString()
  });
});

// 7. 404 Route Catching
app.use((req, res, next) => {
  next(new NotFoundError(`Resource not found: ${req.method} ${req.url}`));
});

// 8. Centralized Error Handler
app.use(errorHandler);

module.exports = app;
