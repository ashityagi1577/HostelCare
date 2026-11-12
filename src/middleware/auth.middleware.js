const { verifyToken, extractTokenFromHeader } = require('../utils/jwt.util');

/**
 * Middleware: Verifies JWT token from Authorization header.
 * Attaches decoded user payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access Denied: No authentication token provided. Please log in.'
    });
  }

  try {
    const decodedUser = verifyToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid or forged authentication token.'
    });
  }
}

/**
 * Middleware: Role Guard ensuring current user has one of the required roles.
 * Usage: requireRoles('student') or requireRoles('staff', 'admin')
 * 
 * @param  {...string} allowedRoles 
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: This resource requires one of [${allowedRoles.join(', ')}] role. Current role: '${req.user.role}'.`
      });
    }

    next();
  };
}

/**
 * Middleware: Optional JWT auth — attaches req.user if token present, never blocks.
 * Used for public endpoints that benefit from knowing who the caller is (e.g., ticket tracking).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (_) {
      req.user = null; // bad token = treat as guest
    }
  } else {
    req.user = null;
  }
  next();
}

module.exports = {
  authenticateToken,
  requireRoles,
  optionalAuth
};

