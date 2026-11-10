const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'hostelcare_fallback_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generates a signed JWT token for an authenticated user.
 * Only non-sensitive public user claims are embedded.
 * 
 * @param {Object} user - User object from database
 * @param {Object} [customOptions] - Optional overrides (e.g. custom expiresIn)
 * @returns {string} Signed JWT token
 */
function generateToken(user, customOptions = {}) {
  if (!user || !user.id || !user.role) {
    throw new Error('User payload must include at least an id and a role');
  }

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hostel_block: user.hostel_block || null,
    room_no: user.room_no || null
  };

  const options = {
    expiresIn: customOptions.expiresIn || JWT_EXPIRES_IN,
    issuer: 'HostelCare-Portal',
    audience: 'HostelCare-Users'
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verifies and decodes a JWT token.
 * 
 * @param {string} token - The raw JWT token string
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is expired or signature is invalid
 */
function verifyToken(token) {
  if (!token) {
    throw new Error('Token string must be provided');
  }

  return jwt.verify(token, JWT_SECRET, {
    issuer: 'HostelCare-Portal',
    audience: 'HostelCare-Users'
  });
}

/**
 * Helper to safely extract Bearer token from HTTP Authorization header.
 * 
 * @param {string} authHeader - e.g. "Bearer eyJhbGciOi..."
 * @returns {string|null} The token string or null if not formatted as Bearer
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }

  return null;
}

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  JWT_SECRET
};

