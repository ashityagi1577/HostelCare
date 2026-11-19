const db = require('../config/db');
const FeedbackModel = require('../models/feedback.model');
const UserModel = require('../models/user.model');
const { hashPassword } = require('../utils/password.util');

/**
 * Admin Controller
 * Centralized executive monitoring and institutional management.
 */
class AdminController {
  /**
   * Executive Overview & Comprehensive Dashboard KPIs
   * GET /api/admin/overview
   */
  static async getAdminOverview(req, res) {
    try {
      // 1. User Counters
      const [studentCount] = await db.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'student';"
      );
      const [staffCount] = await db.query(
        "SELECT COUNT(*) AS total FROM users WHERE role IN ('staff', 'admin');"
      );
      const [technicianCount] = await db.query(
        "SELECT COUNT(*) AS total FROM technicians;"
      );

      // 2. Room Occupancy & Capacity (Campus Blocks: A, B, C, D)
      // Standard hostel block capacities
      const blockCapacities = {
        'Block A (Boys)': 50,
        'Block B (Boys)': 50,
        'Block C (Girls)': 50,
        'Block D (Girls)': 50
      };
      const totalCampusCapacity = Object.values(blockCapacities).reduce((a, b) => a + b, 0);

      const blockOccupancySql = `
        SELECT 
          COALESCE(hostel_block, 'Unassigned') AS block,
          COUNT(DISTINCT room_no) AS occupied_rooms,
          COUNT(id) AS resident_count
        FROM users
        WHERE role = 'student' AND hostel_block IS NOT NULL AND room_no IS NOT NULL
        GROUP BY hostel_block;
      `;
      const blockOccupancyRows = await db.query(blockOccupancySql);

      const blockBreakdown = Object.keys(blockCapacities).map(b => {
        const found = blockOccupancyRows.find(r => r.block === b);
        const occupied = found ? Number(found.occupied_rooms) : 0;
        const residents = found ? Number(found.resident_count) : 0;
        const capacity = blockCapacities[b];
        const vacant = Math.max(0, capacity - occupied);
        const rate = Math.round((occupied / capacity) * 100);
        return {
          block: b,
          capacity,
          occupied_rooms: occupied,
          vacant_rooms: vacant,
          resident_count: residents,
          occupancy_rate: rate
        };
      });

      const totalOccupiedRooms = blockBreakdown.reduce((sum, b) => sum + b.occupied_rooms, 0);
      const totalVacantRooms = Math.max(0, totalCampusCapacity - totalOccupiedRooms);
      const overallOccupancyRate = Math.round((totalOccupiedRooms / totalCampusCapacity) * 100);

      // 3. Complaint Counters
      const complaintCountsSql = `
        SELECT 
          COUNT(id) AS total,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) AS assigned,
          SUM(CASE WHEN status = 'In_Progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed,
          SUM(CASE WHEN priority = 'Emergency' AND status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS emergency_pending,
          ROUND(AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, created_at, resolved_at) / 60.0 END), 1) AS avg_resolution_hours
        FROM complaints;
      `;
      const [compCounts] = await db.query(complaintCountsSql);

      // 4. Feedback & Satisfaction Score
      const ratingMetrics = await FeedbackModel.getAverageRatingMetrics();

      // 5. Categorical & Urgency Chart Data
      const catSql = `
        SELECT category, COUNT(id) AS count
        FROM complaints
        GROUP BY category
        ORDER BY count DESC;
      `;
      const categoryRows = await db.query(catSql);

      const prioritySql = `
        SELECT priority, COUNT(id) AS count
        FROM complaints
        GROUP BY priority
        ORDER BY FIELD(priority, 'Emergency', 'High', 'Medium', 'Low');
      `;
      const priorityRows = await db.query(prioritySql);

      const statusSql = `
        SELECT status, COUNT(id) AS count
        FROM complaints
        GROUP BY status
        ORDER BY FIELD(status, 'Pending', 'Assigned', 'In_Progress', 'Resolved', 'Closed');
      `;
      const statusRows = await db.query(statusSql);

      // 6. Technician Bandwidth & Task Overview
      const techSql = `
        SELECT 
          t.id,
          t.name,
          t.trade,
          t.phone,
          t.is_available,
          COUNT(CASE WHEN c.status IN ('Assigned', 'In_Progress') THEN 1 END) AS active_tasks,
          COUNT(CASE WHEN c.status IN ('Resolved', 'Closed') THEN 1 END) AS completed_tasks
        FROM technicians t
        LEFT JOIN complaints c ON t.id = c.assigned_tech_id
        GROUP BY t.id, t.name, t.trade, t.phone, t.is_available
        ORDER BY active_tasks DESC;
      `;
      const techniciansOverview = await db.query(techSql);

      // 7. Recent Complaints (Last 8)
      const recentComplaintsSql = `
        SELECT 
          c.id,
          c.ticket_no,
          c.title,
          c.category,
          c.priority,
          c.status,
          c.created_at,
          u.name AS student_name,
          u.hostel_block,
          u.room_no,
          t.name AS technician_name
        FROM complaints c
        JOIN users u ON c.student_id = u.id
        LEFT JOIN technicians t ON c.assigned_tech_id = t.id
        ORDER BY c.created_at DESC
        LIMIT 8;
      `;
      const recentComplaints = await db.query(recentComplaintsSql);

      // 8. Recent System Activity Feed (Last 8)
      const recentActivitySql = `
        SELECT 
          l.id,
          l.action,
          l.new_status,
          l.remarks,
          l.created_at,
          c.ticket_no,
          c.title AS complaint_title,
          COALESCE(u.name, 'System') AS actor_name,
          COALESCE(u.role, 'staff') AS actor_role
        FROM complaint_logs l
        JOIN complaints c ON l.complaint_id = c.id
        LEFT JOIN users u ON l.updated_by_user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 8;
      `;
      const recentActivities = await db.query(recentActivitySql);

      return res.status(200).json({
        success: true,
        data: {
          system_stats: {
            total_students: Number(studentCount.total) || 0,
            total_staff: Number(staffCount.total) || 0,
            total_technicians: Number(technicianCount.total) || 0
          },
          room_stats: {
            total_capacity: totalCampusCapacity,
            occupied_rooms: totalOccupiedRooms,
            vacant_rooms: totalVacantRooms,
            occupancy_rate: overallOccupancyRate,
            blocks: blockBreakdown
          },
          complaint_stats: {
            total: Number(compCounts.total) || 0,
            pending: Number(compCounts.pending) || 0,
            assigned: Number(compCounts.assigned) || 0,
            in_progress: Number(compCounts.in_progress) || 0,
            resolved: Number(compCounts.resolved) || 0,
            closed: Number(compCounts.closed) || 0,
            emergency_pending: Number(compCounts.emergency_pending) || 0,
            avg_resolution_hours: compCounts.avg_resolution_hours !== null ? Number(compCounts.avg_resolution_hours) : 0,
            satisfaction_score: ratingMetrics.average_rating ? Number(ratingMetrics.average_rating).toFixed(1) : null,
            total_reviews: ratingMetrics.total_reviews || 0
          },
          charts: {
            by_category: categoryRows.map(r => ({ category: r.category, count: Number(r.count) })),
            by_priority: priorityRows.map(r => ({ priority: r.priority, count: Number(r.count) })),
            by_status: statusRows.map(r => ({ status: r.status, count: Number(r.count) })),
            satisfaction_breakdown: ratingMetrics.breakdown || {}
          },
          technicians_overview: techniciansOverview.map(t => ({
            ...t,
            active_tasks: Number(t.active_tasks),
            completed_tasks: Number(t.completed_tasks)
          })),
          recent_complaints: recentComplaints,
          recent_activities: recentActivities
        }
      });
    } catch (error) {
      console.error('[Admin getAdminOverview Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve administrative overview metrics.'
      });
    }
  }

  /**
   * Retrieve all registered students with complaint history count.
   * GET /api/admin/students
   */
  static async getStudentsDirectory(req, res) {
    try {
      const { block, search } = req.query;
      let sql = `
        SELECT 
          u.id,
          u.user_id,
          u.name,
          u.email,
          u.hostel_block,
          u.room_no,
          u.phone,
          u.created_at,
          COUNT(c.id) AS total_complaints,
          COUNT(CASE WHEN c.status NOT IN ('Resolved', 'Closed') THEN 1 END) AS active_complaints
        FROM users u
        LEFT JOIN complaints c ON u.id = c.student_id
        WHERE u.role = 'student'
      `;
      const params = [];

      if (block) {
        sql += ` AND u.hostel_block = ?`;
        params.push(block);
      }
      if (search) {
        sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.user_id LIKE ? OR u.room_no LIKE ?)`;
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
      }

      sql += ` GROUP BY u.id, u.user_id, u.name, u.email, u.hostel_block, u.room_no, u.phone, u.created_at
               ORDER BY u.hostel_block ASC, u.room_no ASC;`;

      const students = await db.query(sql, params);

      return res.status(200).json({
        success: true,
        count: students.length,
        data: students.map(s => ({
          ...s,
          total_complaints: Number(s.total_complaints),
          active_complaints: Number(s.active_complaints)
        }))
      });
    } catch (error) {
      console.error('[Admin getStudentsDirectory Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve students roster.'
      });
    }
  }

  /**
   * Retrieve staff and wardens roster.
   * GET /api/admin/staff
   */
  static async getStaffDirectory(req, res) {
    try {
      const sql = `
        SELECT 
          u.id,
          u.user_id,
          u.name,
          u.email,
          u.role,
          u.phone,
          u.created_at,
          COUNT(DISTINCT l.complaint_id) AS actions_taken_count
        FROM users u
        LEFT JOIN complaint_logs l ON u.id = l.updated_by_user_id
        WHERE u.role IN ('staff', 'admin')
        GROUP BY u.id, u.user_id, u.name, u.email, u.role, u.phone, u.created_at
        ORDER BY FIELD(u.role, 'admin', 'staff'), u.name ASC;
      `;
      const staffList = await db.query(sql);

      return res.status(200).json({
        success: true,
        count: staffList.length,
        data: staffList.map(s => ({
          ...s,
          actions_taken_count: Number(s.actions_taken_count)
        }))
      });
    } catch (error) {
      console.error('[Admin getStaffDirectory Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve staff directory.'
      });
    }
  }

  /**
   * Retrieve room allocation and status directory.
   * GET /api/admin/rooms
   */
  static async getRoomsDirectory(req, res) {
    try {
      const { block } = req.query;
      let sql = `
        SELECT 
          u.hostel_block,
          u.room_no,
          GROUP_CONCAT(u.name SEPARATOR ', ') AS occupants,
          GROUP_CONCAT(u.user_id SEPARATOR ', ') AS student_ids,
          COUNT(u.id) AS occupant_count,
          COUNT(CASE WHEN c.status NOT IN ('Resolved', 'Closed') THEN 1 END) AS active_faults_count
        FROM users u
        LEFT JOIN complaints c ON u.id = c.student_id
        WHERE u.role = 'student' AND u.hostel_block IS NOT NULL AND u.room_no IS NOT NULL
      `;
      const params = [];

      if (block) {
        sql += ` AND u.hostel_block = ?`;
        params.push(block);
      }

      sql += ` GROUP BY u.hostel_block, u.room_no
               ORDER BY u.hostel_block ASC, u.room_no ASC;`;

      const rooms = await db.query(sql, params);

      return res.status(200).json({
        success: true,
        count: rooms.length,
        data: rooms.map(r => ({
          ...r,
          occupant_count: Number(r.occupant_count),
          active_faults_count: Number(r.active_faults_count)
        }))
      });
    } catch (error) {
      console.error('[Admin getRoomsDirectory Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve rooms directory.'
      });
    }
  }

  /**
   * Institutional User Provisioning: Admin registers any role (Student, Staff, Technician, Admin)
   * POST /api/admin/users
   */
  static async registerUser(req, res) {
    try {
      const { user_id, name, email, password, role, hostel_block, room_no, phone, trade } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({
          success: false,
          error: 'Name, email, password, and role are required fields.'
        });
      }

      const validRoles = ['student', 'staff', 'technician', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role specified. Must be one of: ${validRoles.join(', ')}.`
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long.'
        });
      }

      // Check if email already registered
      const emailTaken = await UserModel.emailExists(email);
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          error: `An account with email '${email}' already exists.`
        });
      }

      // Check or generate user_id
      let finalUserId = (user_id || '').trim().toUpperCase();
      if (finalUserId) {
        const idTaken = await UserModel.userIdExists(finalUserId);
        if (idTaken) {
          return res.status(409).json({
            success: false,
            error: `Institutional ID '${finalUserId}' is already assigned.`
          });
        }
      } else {
        finalUserId = UserModel.generateDefaultUserId(role);
      }

      const passwordHash = await hashPassword(password);
      let techId = null;

      // If technician, create or find technician record
      if (role === 'technician') {
        const validTrades = ['Electrical', 'Plumbing', 'Carpentry', 'Cleaning', 'WiFi_Internet', 'General'];
        const assignedTrade = validTrades.includes(trade) ? trade : 'General';

        const [techRes] = await db.execute(
          'INSERT INTO technicians (name, trade, phone, is_available) VALUES (?, ?, ?, 1);',
          [name.trim(), assignedTrade, phone ? phone.trim() : '']
        );
        techId = techRes.insertId;
      }

      const insertSql = `
        INSERT INTO users (user_id, name, email, password_hash, role, tech_id, hostel_block, room_no, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      const result = await db.execute(insertSql, [
        finalUserId,
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        role,
        techId,
        hostel_block ? hostel_block.trim() : null,
        room_no ? room_no.trim() : null,
        phone ? phone.trim() : null
      ]);

      return res.status(201).json({
        success: true,
        message: `Account created successfully for ${name.trim()} (${role.toUpperCase()}) with ID ${finalUserId}.`,
        data: {
          id: result.insertId,
          user_id: finalUserId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          tech_id: techId,
          hostel_block: hostel_block || null,
          room_no: room_no || null,
          phone: phone || null
        }
      });
    } catch (error) {
      console.error('[Admin registerUser Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create user account.'
      });
    }
  }
}

module.exports = AdminController;

