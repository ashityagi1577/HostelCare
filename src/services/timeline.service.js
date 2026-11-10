const db = require('../config/db');

// The 5 canonical lifecycle stages of a HostelCare maintenance request
const LIFECYCLE_STAGES = [
  { key: 'Pending', label: 'Complaint Lodged', step: 1, description: 'Request registered and queued for staff triage' },
  { key: 'Assigned', label: 'Technician Assigned', step: 2, description: 'Allocated to maintenance technician with target date' },
  { key: 'In_Progress', label: 'Work In Progress', step: 3, description: 'Repairs or maintenance inspection underway on-site' },
  { key: 'Resolved', label: 'Work Resolved', step: 4, description: 'Technician completed repairs; awaiting resident sign-off' },
  { key: 'Closed', label: 'Ticket Closed', step: 5, description: 'Resident reviewed, rated, and finalized the ticket' }
];

/**
 * Audit and Timeline Service
 * Calculates stepper nodes and chronological event logs.
 */
class TimelineService {
  /**
   * Insert a new audit log entry for a complaint.
   */
  static async logAction({ complaintId, action, previousStatus = null, newStatus, updatedByUserId = null, remarks = null }) {
    const sql = `
      INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    const result = await db.execute(sql, [
      complaintId,
      action,
      previousStatus,
      newStatus,
      updatedByUserId,
      remarks
    ]);
    return result.insertId;
  }

  /**
   * Retrieves all logs for a complaint and generates a formatted stepper and history trail.
   * 
   * @param {Object} complaint - Complaint row from database
   * @returns {Promise<Object>} Formatted timeline data with stepper nodes
   */
  static async getEnrichedTimeline(complaint) {
    const sql = `
      SELECT 
        l.id,
        l.complaint_id,
        l.action,
        l.previous_status,
        l.new_status,
        l.updated_by_user_id,
        l.remarks,
        l.created_at,
        u.name AS actor_name,
        u.role AS actor_role
      FROM complaint_logs l
      LEFT JOIN users u ON l.updated_by_user_id = u.id
      WHERE l.complaint_id = ?
      ORDER BY l.created_at ASC;
    `;
    const rawLogs = await db.query(sql, [complaint.id]);

    // Determine current stage index in canonical lifecycle
    const currentStatus = complaint.status;
    const currentIndex = LIFECYCLE_STAGES.findIndex(s => s.key === currentStatus);

    // Build the 5 stepper nodes with status badges: 'completed', 'current', or 'upcoming'
    const stepper = LIFECYCLE_STAGES.map((stage, idx) => {
      // Find matching log for this stage if it was reached
      const reachedLog = rawLogs.find(l => l.new_status === stage.key);
      
      let nodeState = 'upcoming';
      if (idx < currentIndex) {
        nodeState = 'completed';
      } else if (idx === currentIndex) {
        nodeState = 'current';
      }

      return {
        step: stage.step,
        key: stage.key,
        label: stage.label,
        description: stage.description,
        state: nodeState, // 'completed' | 'current' | 'upcoming'
        timestamp: reachedLog ? reachedLog.created_at : null,
        actor: reachedLog ? { name: reachedLog.actor_name, role: reachedLog.actor_role } : null,
        remarks: reachedLog ? reachedLog.remarks : null
      };
    });

    // Calculate turnaround times
    let resolutionTimeHours = null;
    if (complaint.resolved_at && complaint.created_at) {
      const start = new Date(complaint.created_at).getTime();
      const end = new Date(complaint.resolved_at).getTime();
      resolutionTimeHours = Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10;
    }

    return {
      complaint_id: complaint.id,
      ticket_no: complaint.ticket_no,
      current_status: currentStatus,
      resolution_time_hours: resolutionTimeHours,
      stepper,
      history: rawLogs.map(log => ({
        id: log.id,
        action: log.action,
        previous_status: log.previous_status,
        new_status: log.new_status,
        remarks: log.remarks,
        timestamp: log.created_at,
        actor: {
          name: log.actor_name || 'System / Resident',
          role: log.actor_role || 'student'
        }
      }))
    };
  }
}

module.exports = {
  TimelineService,
  LIFECYCLE_STAGES
};

