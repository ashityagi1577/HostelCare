const db = require('../config/db');
const { generateTicketNumber } = require('../utils/ticket.util');

/**
 * Helper to safely format Date or ISO string into MySQL DATETIME ('YYYY-MM-DD HH:MM:SS')
 */
function toMySqlDateTime(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Complaint Data Access Model
 * Manages operations on `complaints` and `complaint_logs` tables.
 */
class ComplaintModel {
  /**
   * Create a new complaint lodged by a resident student.
   * Automatically generates ticket number and initial audit log entry.
   * 
   * @param {Object} data - { student_id, category, title, description, photo_url, priority }
   * @returns {Promise<Object>} Created complaint details
   */
  static async createComplaint({ student_id, category, title, description, photo_url = null, priority = 'Medium' }) {
    const ticketNo = await generateTicketNumber();

    const insertSql = `
      INSERT INTO complaints (ticket_no, student_id, category, title, description, photo_url, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending');
    `;
    const params = [
      ticketNo,
      student_id,
      category,
      title.trim(),
      description.trim(),
      photo_url,
      priority
    ];

    const result = await db.execute(insertSql, params);
    const complaintId = result.insertId;

    // Record initial status audit log
    const logSql = `
      INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks)
      VALUES (?, 'Complaint Lodged', NULL, 'Pending', ?, 'Complaint submitted by resident');
    `;
    await db.execute(logSql, [complaintId, student_id]);

    return {
      id: complaintId,
      ticket_no: ticketNo,
      student_id,
      category,
      title: title.trim(),
      description: description.trim(),
      photo_url,
      priority,
      status: 'Pending',
      created_at: new Date()
    };
  }

  /**
   * Find a complaint by its institutional ticket number (e.g. HC-2026-0001).
   * Joins student and technician details.
   * 
   * @param {string} ticketNo 
   * @returns {Promise<Object|null>}
   */
  static async findByTicketNo(ticketNo) {
    const sql = `
      SELECT 
        c.*,
        u.name AS student_name,
        u.email AS student_email,
        u.hostel_block,
        u.room_no,
        u.phone AS student_phone,
        t.name AS technician_name,
        t.trade AS technician_trade,
        t.phone AS technician_phone
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      LEFT JOIN technicians t ON c.assigned_tech_id = t.id
      WHERE c.ticket_no = ?
      LIMIT 1;
    `;
    const rows = await db.query(sql, [ticketNo.trim()]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find a complaint by internal primary ID.
   * 
   * @param {number} id 
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT 
        c.*,
        u.name AS student_name,
        u.email AS student_email,
        u.hostel_block,
        u.room_no,
        u.phone AS student_phone,
        t.name AS technician_name,
        t.trade AS technician_trade,
        t.phone AS technician_phone
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      LEFT JOIN technicians t ON c.assigned_tech_id = t.id
      WHERE c.id = ?
      LIMIT 1;
    `;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find all complaints filed by a specific student.
   * 
   * @param {number} studentId 
   * @param {Object} [filters] - { status, category }
   * @returns {Promise<Array>}
   */
  static async findByStudentId(studentId, filters = {}) {
    let sql = `
      SELECT 
        c.*,
        t.name AS technician_name,
        t.trade AS technician_trade,
        f.rating AS feedback_rating,
        f.comments AS feedback_comments
      FROM complaints c
      LEFT JOIN technicians t ON c.assigned_tech_id = t.id
      LEFT JOIN feedback f ON c.id = f.complaint_id
      WHERE c.student_id = ?
    `;
    const params = [studentId];

    if (filters.status) {
      sql += ` AND c.status = ?`;
      params.push(filters.status);
    }
    if (filters.category) {
      sql += ` AND c.category = ?`;
      params.push(filters.category);
    }

    sql += ` ORDER BY c.created_at DESC;`;
    return await db.query(sql, params);
  }

  /**
   * Find all complaints with multi-criteria filtering for Staff / Warden dashboard.
   * 
   * @param {Object} filters - { status, category, priority, hostel_block, search }
   * @returns {Promise<Array>}
   */
  static async findAll(filters = {}) {
    let sql = `
      SELECT 
        c.*,
        u.name AS student_name,
        u.hostel_block,
        u.room_no,
        u.phone AS student_phone,
        t.name AS technician_name,
        t.trade AS technician_trade,
        f.rating AS feedback_rating
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      LEFT JOIN technicians t ON c.assigned_tech_id = t.id
      LEFT JOIN feedback f ON c.id = f.complaint_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ` AND c.status = ?`;
      params.push(filters.status);
    }
    if (filters.category) {
      sql += ` AND c.category = ?`;
      params.push(filters.category);
    }
    if (filters.priority) {
      sql += ` AND c.priority = ?`;
      params.push(filters.priority);
    }
    if (filters.hostel_block) {
      sql += ` AND u.hostel_block = ?`;
      params.push(filters.hostel_block);
    }
    if (filters.search) {
      sql += ` AND (c.ticket_no LIKE ? OR c.title LIKE ? OR u.name LIKE ? OR u.room_no LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY CASE c.priority 
                WHEN 'Emergency' THEN 1 
                WHEN 'High' THEN 2 
                WHEN 'Medium' THEN 3 
                WHEN 'Low' THEN 4 
              END, c.created_at DESC;`;

    return await db.query(sql, params);
  }

  /**
   * Assign a complaint to an on-campus maintenance technician.
   * Updates status to 'Assigned' and logs the assignment.
   */
  static async assignTechnician(complaintId, { technicianId, estimatedDate = null, updatedByUserId, remarks = null }) {
    const complaint = await this.findById(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const formattedDate = toMySqlDateTime(estimatedDate);

    const updateSql = `
      UPDATE complaints 
      SET assigned_tech_id = ?, 
          estimated_date = ?, 
          status = 'Assigned'
      WHERE id = ?;
    `;
    await db.execute(updateSql, [technicianId, formattedDate, complaintId]);

    // Insert log entry
    const logSql = `
      INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks)
      VALUES (?, 'Technician Assigned', ?, 'Assigned', ?, ?);
    `;
    await db.execute(logSql, [
      complaintId,
      complaint.status,
      updatedByUserId,
      remarks || `Assigned to technician ID: ${technicianId}`
    ]);

    return await this.findById(complaintId);
  }

  /**
   * Update the status of a complaint (e.g. to 'In_Progress' or 'Closed').
   */
  static async updateStatus(complaintId, { newStatus, action, remarks, updatedByUserId }) {
    const complaint = await this.findById(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    let updateSql = `UPDATE complaints SET status = ?`;
    const params = [newStatus];

    if (newStatus === 'Resolved') {
      updateSql += `, resolved_at = NOW()`;
    }
    updateSql += ` WHERE id = ?;`;
    params.push(complaintId);

    await db.execute(updateSql, params);

    // Audit log
    const logSql = `
      INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    await db.execute(logSql, [
      complaintId,
      action || `Status changed to ${newStatus}`,
      complaint.status,
      newStatus,
      updatedByUserId,
      remarks || null
    ]);

    return await this.findById(complaintId);
  }

  /**
   * Mark a complaint as Resolved with technician notes.
   */
  static async resolveComplaint(complaintId, { resolutionNotes, updatedByUserId }) {
    const complaint = await this.findById(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const updateSql = `
      UPDATE complaints 
      SET status = 'Resolved', 
          resolution_notes = ?, 
          resolved_at = NOW()
      WHERE id = ?;
    `;
    await db.execute(updateSql, [resolutionNotes, complaintId]);

    // Audit log
    const logSql = `
      INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks)
      VALUES (?, 'Complaint Resolved', ?, 'Resolved', ?, ?);
    `;
    await db.execute(logSql, [
      complaintId,
      complaint.status,
      updatedByUserId,
      resolutionNotes || 'Maintenance issue resolved'
    ]);

    return await this.findById(complaintId);
  }

  /**
   * Fetch complete timeline audit history for a complaint.
   * 
   * @param {number} complaintId 
   * @returns {Promise<Array>}
   */
  static async getTimeline(complaintId) {
    const sql = `
      SELECT 
        l.*,
        u.name AS updater_name,
        u.role AS updater_role
      FROM complaint_logs l
      LEFT JOIN users u ON l.updated_by_user_id = u.id
      WHERE l.complaint_id = ?
      ORDER BY l.created_at ASC;
    `;
    return await db.query(sql, [complaintId]);
  }

  /**
   * Delete complaint by ID (cascades automatically to logs & feedback).
   */
  static async deleteById(id) {
    const sql = `DELETE FROM complaints WHERE id = ?;`;
    const result = await db.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = ComplaintModel;

