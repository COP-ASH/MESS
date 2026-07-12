const { verifyToken } = require('../utils/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access token is missing or invalid.'));
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return next(new UnauthorizedError('Token is invalid or has expired.'));
  }

  req.user = decoded;
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }

  if (req.user.role !== 'super_admin') {
    return next(new ForbiddenError('Access restricted to Super Admins only.'));
  }

  next();
};

const requireDistrictAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }

  if (req.user.role !== 'district_admin') {
    return next(new ForbiddenError('Access restricted to District Admins only.'));
  }

  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }

  if (req.user.role !== 'super_admin' && req.user.role !== 'district_admin') {
    return next(new ForbiddenError('Access restricted to administrative users.'));
  }

  next();
};

module.exports = {
  authenticate,
  requireSuperAdmin,
  requireDistrictAdmin,
  requireAdmin,
};
