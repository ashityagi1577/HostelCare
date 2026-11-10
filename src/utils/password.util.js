const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with a salt of 10 rounds.
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - The securely hashed password
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a stored bcrypt hash.
 * Timing-safe to prevent timing attacks.
 * @param {string} password - Plain text password entered by user
 * @param {string} hashedPassword - Hash retrieved from database
 * @returns {Promise<boolean>} - True if matching, false otherwise
 */
async function comparePassword(password, hashedPassword) {
  if (!password || !hashedPassword) {
    return false;
  }
  return await bcrypt.compare(password, hashedPassword);
}

module.exports = {
  hashPassword,
  comparePassword
};

