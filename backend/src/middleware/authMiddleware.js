const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token in authorization header.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    console.warn('>>> [SECURITY WARNING] Missing authorization token.');
    return res.status(401).json({ error: 'Access token is missing. Please log in.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, user) => {
    if (err) {
      console.warn('>>> [SECURITY WARNING] Invalid or expired token presented.');
      return res.status(403).json({ error: 'Token is invalid or expired. Access denied.' });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware to restrict route access by role.
 * Supports a single role string or an array of permitted roles.
 */
function requireRole(roleNames) {
  const allowedRoles = Array.isArray(roleNames) ? roleNames : [roleNames];
  
  return (req, res, next) => {
    if (!req.user || !req.user.roleName) {
      console.warn(`>>> [SECURITY WARNING] User lacks active session user roles.`);
      return res.status(403).json({ error: 'Unauthorized. Role mapping missing.' });
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      console.warn(`>>> [SECURITY WARNING] Access denied. User role: "${req.user.roleName}" tried to access resource requiring: [${allowedRoles.join(', ')}].`);
      return res.status(403).json({ error: 'Access forbidden. Insufficient privileges.' });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
