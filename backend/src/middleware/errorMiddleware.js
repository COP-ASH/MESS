const { CustomError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  console.error(`>>> [SERVER ERROR] ${req.method} ${req.url}:`);
  console.error(err.stack || err);

  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.constructor.name,
    });
  }

  // Handle unique constraint violation in Postgres (code '23505')
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists with this unique identifier.',
      code: 'ALREADY_EXISTS',
    });
  }

  // Handle JWT Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token. Please authenticate again.',
      code: 'UNAUTHORIZED',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Session expired. Please log in again.',
      code: 'TOKEN_EXPIRED',
    });
  }

  const statusCode = err.status || 500;
  const message = err.message || 'An internal server error occurred.';
  return res.status(statusCode).json({
    success: false,
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
  });
};

module.exports = errorHandler;
