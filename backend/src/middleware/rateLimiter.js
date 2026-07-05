const loginAttempts = new Map(); // ip -> { count, lockUntil }

/**
 * Basic in-memory rate limiter middleware for sensitive endpoints (login, OTP request).
 */
function loginRateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && record.lockUntil > now) {
    const waitSeconds = Math.ceil((record.lockUntil - now) / 1000);
    return res.status(429).json({ 
      error: `Too many login attempts. Please try again after ${waitSeconds} seconds.` 
    });
  }

  next();
}

/**
 * Register a failed login/OTP attempt. Lock after 5 consecutive failures.
 */
function registerFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  record.count += 1;
  
  if (record.count >= 5) {
    record.lockUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
    record.count = 0; // Reset counter for next phase
    console.warn(`>>> [SECURITY WARNING] IP ${ip} has been rate-limited for 15 minutes due to multiple failures.`);
  }
  
  loginAttempts.set(ip, record);
}

/**
 * Reset failed attempts tracker on successful login.
 */
function resetFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

module.exports = {
  loginRateLimiter,
  registerFailedAttempt,
  resetFailedAttempts
};
