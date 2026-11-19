const db = require('../config/db');

/**
 * User Data Access Model
 * Manages queries for the `users` table including unique user_id / student ID / staff ID.
 */
class UserModel {
  /**
   * Generate a unique default user code based on role.
   * e.g., STU-1001 for students, STF-1001 for staff
   */
  static generateDefaultUserId(role = 'student') {
    const prefix = role === 'staff' ? 'STF' : role === 'admin' ? 'ADM' : role === 'technician' ? 'TECH' : 'STU';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  }

  /**
   * Create a new user record with hashed password and unique institutional ID.
   * @param {Object} userData
   * @returns {Promise<Object>} Created user record (without password hash)
   */
  static async createUser({
    user_id = null,
    name,
    email,
    passwordHash,
    role = 'student',
    hostel_block = null,
    room_no = null,
    phone = null
  }) {
    let finalUserId = user_id ? user_id.trim().toUpperCase() : null;
    if (!finalUserId) {
      finalUserId = this.generateDefaultUserId(role);
    }

    const sql = `
      INSERT INTO users (user_id, name, email, password_hash, role, hostel_block, room_no, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      finalUserId,
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
      user_id: finalUserId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      hostel_block,
      room_no,
      phone
    };
  }

  /**
   * Find user by identifier (either Email Address OR unique User ID / Student ID / Staff ID).
   * Case-insensitive match on both fields.
   * @param {string} identifier - e.g. "student@hostelcare.com" or "STU-101" or "STF-101"
   * @returns {Promise<Object|null>}
   */
  static async findByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();
    const sql = `
      SELECT id, user_id, name, email, password_hash, role, tech_id, hostel_block, room_no, phone, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER(?) OR UPPER(user_id) = UPPER(?)
      LIMIT 1;
    `;
    const rows = await db.query(sql, [clean, clean]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find a user by their unique email address.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const sql = `
      SELECT id, user_id, name, email, password_hash, role, tech_id, hostel_block, room_no, phone, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1;
    `;
    const rows = await db.query(sql, [email.trim()]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find a user by their unique institutional ID (Student ID or Staff ID).
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  static async findByUserId(userId) {
    if (!userId) return null;
    const sql = `
      SELECT id, user_id, name, email, password_hash, role, tech_id, hostel_block, room_no, phone, created_at, updated_at
      FROM users
      WHERE UPPER(user_id) = UPPER(?)
      LIMIT 1;
    `;
    const rows = await db.query(sql, [userId.trim()]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find a user by primary ID (excluding password hash for safe profile retrieval).
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT id, user_id, name, email, role, tech_id, hostel_block, room_no, phone, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1;
    `;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if an email is already registered.
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
   * Check if a user_id is already assigned.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async userIdExists(userId) {
    if (!userId) return false;
    const sql = `
      SELECT id FROM users
      WHERE UPPER(user_id) = UPPER(?)
      LIMIT 1;
    `;
    const rows = await db.query(sql, [userId.trim()]);
    return rows.length > 0;
  }

  /**
   * Retrieve all staff and admin accounts.
   * @returns {Promise<Array>}
   */
  static async getAllStaff() {
    const sql = `
      SELECT id, user_id, name, email, role, phone, created_at
      FROM users
      WHERE role IN ('staff', 'admin')
      ORDER BY name ASC;
    `;
    return await db.query(sql);
  }

  /**
   * Delete a user by ID.
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
