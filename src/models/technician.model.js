const db = require('../config/db');

const ALLOWED_TRADES = ['Electrical', 'Plumbing', 'Carpentry', 'Cleaning', 'WiFi_Internet', 'General'];

/**
 * Technician Data Access Model
 * Manages operations on the `technicians` table.
 */
class TechnicianModel {
  /**
   * Create a new maintenance technician.
   * @param {Object} data - { name, trade, phone, is_available }
   * @returns {Promise<Object>}
   */
  static async create({ name, trade, phone, is_available = true }) {
    if (!name || !trade || !phone) {
      throw new Error('Name, trade, and phone are required for creating a technician');
    }
    if (!ALLOWED_TRADES.includes(trade)) {
      throw new Error(`Invalid trade. Must be one of: ${ALLOWED_TRADES.join(', ')}`);
    }

    const sql = `
      INSERT INTO technicians (name, trade, phone, is_available)
      VALUES (?, ?, ?, ?);
    `;
    const result = await db.execute(sql, [name.trim(), trade, phone.trim(), is_available ? 1 : 0]);
    return {
      id: result.insertId,
      name: name.trim(),
      trade,
      phone: phone.trim(),
      is_available: Boolean(is_available),
      created_at: new Date()
    };
  }

  /**
   * Find a technician by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT id, name, trade, phone, is_available, created_at
      FROM technicians
      WHERE id = ?
      LIMIT 1;
    `;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Retrieve all technicians with optional trade filter and current assigned workload.
   * @param {Object} filters - { trade, is_available }
   * @returns {Promise<Array>}
   */
  static async findAll(filters = {}) {
    let sql = `
      SELECT 
        t.id,
        t.name,
        t.trade,
        t.phone,
        t.is_available,
        t.created_at,
        COUNT(CASE WHEN c.status IN ('Assigned', 'In_Progress') THEN 1 END) AS active_tasks_count
      FROM technicians t
      LEFT JOIN complaints c ON t.id = c.assigned_tech_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.trade) {
      sql += ` AND t.trade = ?`;
      params.push(filters.trade);
    }
    if (filters.is_available !== undefined && filters.is_available !== null) {
      sql += ` AND t.is_available = ?`;
      params.push(filters.is_available ? 1 : 0);
    }

    sql += ` GROUP BY t.id ORDER BY t.trade ASC, t.name ASC;`;
    return await db.query(sql, params);
  }

  /**
   * Update technician availability status.
   * @param {number} id
   * @param {boolean} isAvailable
   */
  static async updateAvailability(id, isAvailable) {
    const sql = `UPDATE technicians SET is_available = ? WHERE id = ?;`;
    const result = await db.execute(sql, [isAvailable ? 1 : 0, id]);
    return result.affectedRows > 0;
  }

  /**
   * Delete a technician record.
   * @param {number} id
   */
  static async deleteById(id) {
    const sql = `DELETE FROM technicians WHERE id = ?;`;
    const result = await db.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = {
  TechnicianModel,
  ALLOWED_TRADES
};

