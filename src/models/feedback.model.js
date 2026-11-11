const db = require('../config/db');

/**
 * Feedback Data Access Model
 * Manages operations on the `feedback` table.
 */
class FeedbackModel {
  /**
   * Submit 1-5 star rating and review comments for a resolved complaint.
   * Automatically advances complaint status to 'Closed' and logs the final milestone.
   * 
   * @param {Object} data - { complaint_id, student_id, rating, comments }
   * @returns {Promise<Object>} Created feedback record
   */
  static async createFeedback({ complaint_id, student_id, rating, comments = null }) {
    const numericRating = parseInt(rating, 10);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new Error('Rating must be an integer between 1 and 5 stars');
    }

    // 1. Verify complaint exists and belongs to this resident
    const checkSql = `SELECT id, student_id, status, ticket_no FROM complaints WHERE id = ? LIMIT 1;`;
    const rows = await db.query(checkSql, [complaint_id]);
    if (rows.length === 0) {
      const error = new Error(`Complaint #${complaint_id} not found`);
      error.code = 'NOT_FOUND';
      throw error;
    }

    const complaint = rows[0];
    if (complaint.student_id !== student_id) {
      const error = new Error('Forbidden: You can only rate your own maintenance requests');
      error.code = 'FORBIDDEN';
      throw error;
    }

    if (complaint.status !== 'Resolved' && complaint.status !== 'Closed') {
      const error = new Error(`Cannot submit feedback. Ticket is currently '${complaint.status}'. It must be 'Resolved' first.`);
      error.code = 'INVALID_STATUS';
      throw error;
    }

    // 2. Check if feedback was already submitted
    const existingFeedback = await this.findByComplaintId(complaint_id);
    if (existingFeedback) {
      const error = new Error('Feedback has already been submitted for this complaint');
      error.code = 'ALREADY_EXISTS';
      throw error;
    }

    // 3. Insert Feedback Record
    const insertSql = `
      INSERT INTO feedback (complaint_id, student_id, rating, comments)
      VALUES (?, ?, ?, ?);
    `;
    const result = await db.execute(insertSql, [
      complaint_id,
      student_id,
      numericRating,
      comments ? comments.trim() : null
    ]);

    // 4. Update Complaint Status to 'Closed'
    await db.execute(`UPDATE complaints SET status = 'Closed' WHERE id = ?;`, [complaint_id]);

    // 5. Append final status audit log
    const logSql = `
      INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks)
      VALUES (?, 'Feedback Submitted & Ticket Closed', ?, 'Closed', ?, ?);
    `;
    const feedbackRemarks = `Resident rated ${numericRating}/5 stars.${comments ? ` Review: "${comments.trim()}"` : ''}`;
    await db.execute(logSql, [complaint_id, complaint.status, student_id, feedbackRemarks]);

    return {
      id: result.insertId,
      complaint_id,
      student_id,
      rating: numericRating,
      comments: comments ? comments.trim() : null,
      created_at: new Date()
    };
  }

  /**
   * Find feedback by complaint ID.
   * @param {number} complaintId
   * @returns {Promise<Object|null>}
   */
  static async findByComplaintId(complaintId) {
    const sql = `
      SELECT f.*, u.name AS student_name, u.room_no, u.hostel_block
      FROM feedback f
      JOIN users u ON f.student_id = u.id
      WHERE f.complaint_id = ?
      LIMIT 1;
    `;
    const rows = await db.query(sql, [complaintId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Calculate overall hostel satisfaction metrics.
   * @returns {Promise<Object>}
   */
  static async getAverageRatingMetrics() {
    const sql = `
      SELECT 
        COUNT(id) AS total_reviews,
        ROUND(AVG(rating), 2) AS average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star
      FROM feedback;
    `;
    const rows = await db.query(sql);
    return rows[0] || { total_reviews: 0, average_rating: 0 };
  }

  /**
   * Delete feedback by complaint ID (used for test cleanup).
   */
  static async deleteByComplaintId(complaintId) {
    const sql = `DELETE FROM feedback WHERE complaint_id = ?;`;
    const result = await db.execute(sql, [complaintId]);
    return result.affectedRows > 0;
  }
}

module.exports = FeedbackModel;

