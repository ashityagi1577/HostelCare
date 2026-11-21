const { pool } = require('../config/db');

/**
 * Helper to resolve technician ID from user payload or DB
 */
async function resolveTechId(user) {
  if (user.tech_id) return user.tech_id;

  const [rows] = await pool.query(
    'SELECT tech_id FROM users WHERE id = ? AND role = "technician" LIMIT 1;',
    [user.id]
  );
  if (rows.length > 0 && rows[0].tech_id) {
    return rows[0].tech_id;
  }
  return null;
}

/**
 * GET /api/technician/overview
 * KPI statistics: total_assigned, pending, in_progress, completed
 */
async function getOverview(req, res) {
  try {
    const techId = await resolveTechId(req.user);
    if (!techId) {
      return res.status(403).json({
        success: false,
        error: 'No technician record associated with this account.'
      });
    }

    // Fetch technician info
    const [techRows] = await pool.query(
      'SELECT id, name, trade, phone, is_available FROM technicians WHERE id = ? LIMIT 1;',
      [techId]
    );

    if (techRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Technician profile not found.'
      });
    }

    const techInfo = techRows[0];

    // Fetch counts
    const countSql = `
      SELECT 
        COUNT(*) AS total_assigned,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'In_Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS completed
      FROM complaints
      WHERE assigned_tech_id = ?;
    `;
    const [counts] = await pool.query(countSql, [techId]);

    const stats = {
      total_assigned: Number(counts[0].total_assigned) || 0,
      pending: Number(counts[0].pending) || 0,
      in_progress: Number(counts[0].in_progress) || 0,
      completed: Number(counts[0].completed) || 0
    };

    return res.status(200).json({
      success: true,
      data: {
        technician: techInfo,
        stats
      }
    });
  } catch (error) {
    console.error('[Technician Overview Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve technician dashboard overview.'
    });
  }
}

/**
 * GET /api/technician/complaints
 * Fetches complaints strictly assigned to the authenticated technician.
 * Query parameters: status ('all' | 'Assigned' | 'In_Progress' | 'Resolved' | 'Closed' | 'active' | 'history'), search
 */
async function getMyComplaints(req, res) {
  try {
    const techId = await resolveTechId(req.user);
    if (!techId) {
      return res.status(403).json({
        success: false,
        error: 'No technician record associated with this account.'
      });
    }

    const { status, search } = req.query;

    let sql = `
      SELECT 
        c.id,
        c.ticket_no,
        c.category,
        c.title,
        c.description,
        c.priority,
        c.status,
        c.photo_url,
        c.estimated_date,
        c.resolution_notes,
        c.resolved_at,
        c.created_at,
        c.updated_at,
        u.name AS student_name,
        u.hostel_block,
        u.room_no,
        u.phone AS student_phone
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      WHERE c.assigned_tech_id = ?
    `;

    const params = [techId];

    if (status) {
      if (status === 'active') {
        sql += ` AND c.status IN ('Assigned', 'In_Progress')`;
      } else if (status === 'history' || status === 'completed') {
        sql += ` AND c.status IN ('Resolved', 'Closed')`;
      } else if (['Assigned', 'In_Progress', 'Resolved', 'Closed'].includes(status)) {
        sql += ` AND c.status = ?`;
        params.push(status);
      }
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (c.ticket_no LIKE ? OR c.title LIKE ? OR c.description LIKE ? OR u.name LIKE ? OR u.room_no LIKE ?)`;
      params.push(q, q, q, q, q);
    }

    // Order active first, then emergency/high priority, then recency
    sql += `
      ORDER BY 
        CASE 
          WHEN c.status = 'In_Progress' THEN 1
          WHEN c.status = 'Assigned' THEN 2
          ELSE 3
        END ASC,
        CASE 
          WHEN c.priority = 'Emergency' THEN 1
          WHEN c.priority = 'High' THEN 2
          WHEN c.priority = 'Medium' THEN 3
          ELSE 4
        END ASC,
        c.created_at DESC;
    `;

    const [complaints] = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error('[Technician Complaints Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve assigned complaints.'
    });
  }
}

/**
 * GET /api/technician/complaints/:id
 * Retrieve details of a single assigned complaint with timeline logs.
 */
async function getComplaintById(req, res) {
  try {
    const techId = await resolveTechId(req.user);
    const complaintId = parseInt(req.params.id, 10);

    if (!techId) {
      return res.status(403).json({
        success: false,
        error: 'No technician record associated with this account.'
      });
    }

    if (isNaN(complaintId)) {
      return res.status(400).json({ success: false, error: 'Invalid complaint ID.' });
    }

    const sql = `
      SELECT 
        c.id,
        c.ticket_no,
        c.category,
        c.title,
        c.description,
        c.priority,
        c.status,
        c.photo_url,
        c.assigned_tech_id,
        c.estimated_date,
        c.resolution_notes,
        c.resolved_at,
        c.created_at,
        c.updated_at,
        u.name AS student_name,
        u.hostel_block,
        u.room_no,
        u.phone AS student_phone
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      WHERE c.id = ? AND c.assigned_tech_id = ?
      LIMIT 1;
    `;

    const [rows] = await pool.query(sql, [complaintId, techId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found or not assigned to your account.'
      });
    }

    const complaint = rows[0];

    // Fetch timeline logs
    const [logs] = await pool.query(
      `SELECT id, action, previous_status, new_status, remarks, created_at
       FROM complaint_logs
       WHERE complaint_id = ?
       ORDER BY created_at ASC;`,
      [complaintId]
    );

    complaint.logs = logs;

    return res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('[Technician Get Complaint Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve complaint details.'
    });
  }
}

/**
 * PUT /api/technician/complaints/:id/status
 * Technicians can transition status: 'Assigned' | 'In_Progress' | 'Resolved'
 * Body: { status, remarks }
 */
async function updateComplaintStatus(req, res) {
  try {
    const techId = await resolveTechId(req.user);
    const complaintId = parseInt(req.params.id, 10);
    const { status, remarks } = req.body || {};

    if (isNaN(complaintId)) {
      return res.status(400).json({ success: false, error: 'Invalid complaint ID.' });
    }

    const allowedStatuses = ['Assigned', 'In_Progress', 'Resolved'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}.`
      });
    }

    if (!techId) {
      return res.status(403).json({
        success: false,
        error: 'No technician record associated with this account.'
      });
    }

    if (remarks !== undefined && remarks !== null && typeof remarks !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Work remarks must be text.'
      });
    }

    const cleanRemarks = typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null;
    if (cleanRemarks && cleanRemarks.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Work remarks must be 10,000 characters or fewer.'
      });
    }

    const connection = await pool.getConnection();
    let prevStatus;
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.query(
        'SELECT id, status FROM complaints WHERE id = ? AND assigned_tech_id = ? LIMIT 1 FOR UPDATE;',
        [complaintId, techId]
      );

      if (existingRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'Complaint not found or you are not authorized to update it.'
        });
      }

      prevStatus = existingRows[0].status;
      let updateSql = 'UPDATE complaints SET status = ?, updated_at = NOW()';
      const params = [status];

      if (status === 'Resolved') {
        updateSql += ', resolved_at = NOW()';
      }
      if (cleanRemarks) {
        updateSql += ', resolution_notes = ?';
        params.push(cleanRemarks);
      }
      updateSql += ' WHERE id = ? AND assigned_tech_id = ?;';
      params.push(complaintId, techId);
      await connection.execute(updateSql, params);

      const actionLabel = status === 'In_Progress'
        ? 'Work In Progress'
        : status === 'Resolved'
          ? 'Complaint Resolved'
          : 'Status Updated';
      const logRemarks = cleanRemarks || `Technician marked complaint as ${status.replace('_', ' ')}`;

      await connection.execute(
        `INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW());`,
        [complaintId, actionLabel, prevStatus, status, req.user.id, logRemarks]
      );
      await connection.commit();
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[Technician Update Status Rollback Error]:', rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status.replace('_', ' ')}.`,
      data: {
        complaint_id: complaintId,
        previous_status: prevStatus,
        new_status: status,
        remarks: cleanRemarks
      }
    });
  } catch (error) {
    console.error('[Technician Update Status Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update complaint status.'
    });
  }
}

module.exports = {
  getOverview,
  getMyComplaints,
  getComplaintById,
  updateComplaintStatus
};
