require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const menuRoutes = require('./src/routes/menuRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const billRoutes = require('./src/routes/billRoutes');
const noticeRoutes = require('./src/routes/noticeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. CORS Configuration
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000', // standard Vite/React dev ports
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman or server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin is localhost/127.0.0.1
    const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
    
    // Check if origin matches GitHub Pages or custom domains (copash.shop, copash.space)
    const isGitHubPages = origin.includes('.github.io') || origin.includes('copash.shop') || origin.includes('copash.space');
    
    if (isLocalhost || isGitHubPages || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 2. Request Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. HTTP Request Logging (Morgan)
// Using standard 'dev' format for local, or combined for production tracing
app.use(morgan('dev'));

// 4. API Routes Mapping
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/notices', noticeRoutes);

// 5. Default root path check (for health checks / Render deployment verify)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'UP Police Mess Management API is operational.',
    timestamp: new Date().toISOString()
  });
});

// 6. Robust Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('>>> [SERVER ERROR DETECTED] Detailed Stack Trace:');
  console.error(err.stack || err);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'An internal server error occurred.',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`>>> [SERVER START] Application listening on port ${PORT}`);
  console.log(`>>> [SERVER URL] Local URL: http://localhost:${PORT}`);
  console.log(`>>> [ALLOWED ORIGINS] config loaded for: ${allowedOrigins.join(', ')} and GitHub Pages (.github.io)`);
});
// Trigger nodemon reload again

