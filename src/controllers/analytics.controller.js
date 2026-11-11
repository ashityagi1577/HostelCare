const db = require('../config/db');
const FeedbackModel = require('../models/feedback.model');

/**
 * Analytics Controller
 * Computes dashboard KPIs, category distributions, resolution metrics, and activity feeds.
 */
class AnalyticsController {
  /**
   * Retrieve aggregate management KPIs for Staff & Warden dashboards.
   * GET /api/analytics/dashboard
   */
  static async getDashboardMetrics(req, res) {
    try {
      // 1. Overall Complaint & Urgency Counters
      const countSql = `
        SELECT 
          COUNT(id) AS total_complaints,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_complaints,
          SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) AS assigned_complaints,
          SUM(CASE WHEN status = 'In_Progress' THEN 1 ELSE 0 END) AS in_progress_complaints,
          SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_complaints,
          SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed_complaints,
          SUM(CASE WHEN priority = 'Emergency' AND status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS emergency_pending,
          ROUND(AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, created_at, resolved_at) / 60.0 END), 1) AS avg_resolution_hours
        FROM complaints;
      `;
      const [countRow] = await db.query(countSql);

      const kpis = {
        total: Number(countRow.total_complaints) || 0,
        pending: Number(countRow.pending_complaints) || 0,
        assigned: Number(countRow.assigned_complaints) || 0,
        in_progress: Number(countRow.in_progress_complaints) || 0,
        resolved: Number(countRow.resolved_complaints) || 0,
        closed: Number(countRow.closed_complaints) || 0,
        active_total: (Number(countRow.pending_complaints) || 0) + 
                      (Number(countRow.assigned_complaints) || 0) + 
                      (Number(countRow.in_progress_complaints) || 0),
        emergency_pending: Number(countRow.emergency_pending) || 0,
        avg_resolution_hours: countRow.avg_resolution_hours !== null ? Number(countRow.avg_resolution_hours) : 0
      };

      // 2. Breakdown by Maintenance Category
      const catSql = `
        SELECT category, COUNT(id) AS count
        FROM complaints
        GROUP BY category
        ORDER BY count DESC;
      `;
      const categoryRows = await db.query(catSql);

      // 3. Breakdown by Priority
      const prioritySql = `
        SELECT priority, COUNT(id) AS count
        FROM complaints
        GROUP BY priority
        ORDER BY FIELD(priority, 'Emergency', 'High', 'Medium', 'Low');
      `;
      const priorityRows = await db.query(prioritySql);

      // 4. Breakdown by Hostel Block
      const blockSql = `
        SELECT COALESCE(u.hostel_block, 'Unassigned') AS hostel_block, COUNT(c.id) AS count
        FROM complaints c
        JOIN users u ON c.student_id = u.id
        GROUP BY u.hostel_block
        ORDER BY count DESC;
      `;
      const blockRows = await db.query(blockSql);

      // 5. Satisfaction & Ratings
      const ratingMetrics = await FeedbackModel.getAverageRatingMetrics();

      // 6. Recent Activity Feed
      const feedSql = `
        SELECT 
          l.id,
          l.complaint_id,
          c.ticket_no,
          c.title AS complaint_title,
          l.action,
          l.new_status,
          l.remarks,
          l.created_at,
          COALESCE(u.name, 'Resident') AS actor_name,
          COALESCE(u.role, 'student') AS actor_role
        FROM complaint_logs l
        JOIN complaints c ON l.complaint_id = c.id
        LEFT JOIN users u ON l.updated_by_user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 6;
      `;
      const recentActivity = await db.query(feedSql);

      return res.status(200).json({
        success: true,
        data: {
          kpis,
          by_category: categoryRows.map(r => ({ category: r.category, count: Number(r.count) })),
          by_priority: priorityRows.map(r => ({ priority: r.priority, count: Number(r.count) })),
          by_block: blockRows.map(r => ({ block: r.hostel_block, count: Number(r.count) })),
          satisfaction: {
            average_rating: ratingMetrics.average_rating ? Number(ratingMetrics.average_rating) : 0,
            total_reviews: Number(ratingMetrics.total_reviews) || 0,
            breakdown: {
              five_star: Number(ratingMetrics.five_star) || 0,
              four_star: Number(ratingMetrics.four_star) || 0,
              three_star: Number(ratingMetrics.three_star) || 0,
              two_star: Number(ratingMetrics.two_star) || 0,
              one_star: Number(ratingMetrics.one_star) || 0
            }
          },
          recent_activity: recentActivity
        }
      });
    } catch (error) {
      console.error('[Analytics getDashboardMetrics Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to compute dashboard analytics.'
      });
    }
  }
}

module.exports = AnalyticsController;

