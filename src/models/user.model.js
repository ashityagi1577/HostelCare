const db = require('../config/db');

/**
 * User Data Access Model
 * Manages queries for the `users` table.
 */
class UserModel {
  /**
   * Create a new user record with hashed password.
   * @param {Object} userData
   * @returns {Promise<Object>} Created user record (without password hash)
   */
  static async createUser({ name, email, passwordHash, role = 'student', hostel_block = null, room_no = null, phone = null }) {
    const sql = `
      INSERT INTO users (name, email, password_hash, role, hostel_block, room_no, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      name.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      role,
      hostel_block ? hostel_block.trim() : null,
      room_no ? room_no.trim() : null,
      phone ? phone.trim() : null
    ];

    const result = await db.execute(sql, params);
    return {
      id: result.insertId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      hostel_block,
      room_no,
      phone
    };
  }

  /**
   * Find a user by their unique email address.
   * Includes password_hash for authentication verification.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const sql = `
      SELECT id, name, email, password_hash, role, hostel_block, room_no, phone, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1;
    `;
    const rows = await db.query(sql, [email.trim()]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find a user by primary ID (excluding password hash for safe profile retrieval).
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT id, name, email, role, hostel_block, room_no, phone, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1;
    `;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if an email is already registered in the system.
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  static async emailExists(email) {
    const sql = `
      SELECT id FROM users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1;
    `;
    const rows = await db.query(sql, [email.trim()]);
    return rows.length > 0;
  }

  /**
   * Retrieve all staff and admin accounts.
   * @returns {Promise<Array>}
   */
  static async getAllStaff() {
    const sql = `
      SELECT id, name, email, role, phone, created_at
      FROM users
      WHERE role IN ('staff', 'admin')
      ORDER BY name ASC;
    `;
    return await db.query(sql);
  }

  /**
   * Delete a user by ID (used primarily for test cleanup and admin management).
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  static async deleteById(id) {
    const sql = `DELETE FROM users WHERE id = ?;`;
    const result = await db.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = UserModel;

