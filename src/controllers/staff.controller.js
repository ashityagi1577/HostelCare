const ComplaintModel = require('../models/complaint.model');
const { TechnicianModel, ALLOWED_TRADES } = require('../models/technician.model');
const { TimelineService } = require('../services/timeline.service');

const VALID_STATUSES = ['Pending', 'Assigned', 'In_Progress', 'Resolved', 'Closed'];

/**
 * Staff Controller
 * Handles administrative triage, filtering, and status progression.
 */
class StaffController {
  /**
   * Retrieve all hostel complaints with multi-criteria filtering.
   * GET /api/staff/complaints
   * Query params: ?status=Pending&category=Electrical&priority=Emergency&hostel_block=Block A&search=204
   */
  static async getAllComplaints(req, res) {
    try {
      const { status, category, priority, hostel_block, search } = req.query;

      const filters = {
        status: status || null,
        category: category || null,
        priority: priority || null,
        hostel_block: hostel_block || null,
        search: search || null
      };

      const complaints = await ComplaintModel.findAll(filters);

      return res.status(200).json({
        success: true,
        count: complaints.length,
        filters_applied: Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== null)),
        data: complaints
      });
    } catch (error) {
      console.error('[Staff getAllComplaints Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve complaints for staff dashboard.'
      });
    }
  }

  /**
   * Get single complaint with full administrative detail and stepper timeline.
   * GET /api/staff/complaints/:id
   */
  static async getComplaintById(req, res) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      if (isNaN(complaintId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid complaint ID parameter.'
        });
      }

      const complaint = await ComplaintModel.findById(complaintId);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: `Complaint #${complaintId} not found.`
        });
      }

      const timelineData = await TimelineService.getEnrichedTimeline(complaint);

      return res.status(200).json({
        success: true,
        data: {
          ...complaint,
          timeline: timelineData
        }
      });
    } catch (error) {
      console.error('[Staff getComplaintById Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve complaint details.'
      });
    }
  }

  /**
   * Update complaint progress status with staff audit notes.
   * PATCH /api/staff/complaints/:id/status
   * Body: { status, action, remarks }
   */
  static async updateStatus(req, res) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      const { status, action, remarks } = req.body;
      const staffUserId = req.user.id;

      if (isNaN(complaintId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid complaint ID parameter.'
        });
      }

      if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
        });
      }

      const complaint = await ComplaintModel.findById(complaintId);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: `Complaint #${complaintId} not found.`
        });
      }

      const updatedComplaint = await ComplaintModel.updateStatus(complaintId, {
        newStatus: status,
        action: action || `Status updated to ${status}`,
        remarks: remarks || `Status changed by ${req.user.name || 'Hostel Staff'}`,
        updatedByUserId: staffUserId
      });

      return res.status(200).json({
        success: true,
        message: `Complaint #${complaintId} status updated to '${status}'.`,
        data: updatedComplaint
      });
    } catch (error) {
      console.error('[Staff updateStatus Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update complaint status.'
      });
    }
  }

  /**
   * List all maintenance technicians with active task counts and availability.
   * GET /api/staff/technicians
   * Query params: ?trade=Electrical&is_available=1
   */
  static async getTechnicians(req, res) {
    try {
      const { trade, is_available } = req.query;
      const filters = {};

      if (trade) filters.trade = trade;
      if (is_available !== undefined) filters.is_available = is_available === '1' || is_available === 'true';

      const technicians = await TechnicianModel.findAll(filters);

      return res.status(200).json({
        success: true,
        count: technicians.length,
        data: technicians
      });
    } catch (error) {
      console.error('[Staff getTechnicians Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve technicians directory.'
      });
    }
  }

  /**
   * Register a new on-campus maintenance technician.
   * POST /api/staff/technicians
   * Body: { name, trade, phone, is_available }
   */
  static async createTechnician(req, res) {
    try {
      const { name, trade, phone, is_available = true } = req.body;

      if (!name || !trade || !phone) {
        return res.status(400).json({
          success: false,
          error: 'Name, trade, and phone number are required.'
        });
      }

      if (!ALLOWED_TRADES.includes(trade)) {
        return res.status(400).json({
          success: false,
          error: `Invalid trade. Must be one of: ${ALLOWED_TRADES.join(', ')}`
        });
      }

      const technician = await TechnicianModel.create({
        name,
        trade,
        phone,
        is_available
      });

      return res.status(201).json({
        success: true,
        message: `Technician '${technician.name}' registered successfully under ${trade}.`,
        data: technician
      });
    } catch (error) {
      console.error('[Staff createTechnician Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to register maintenance technician.'
      });
    }
  }

  /**
   * Assign a technician to a complaint and progress status to 'Assigned'.
   * PATCH /api/staff/complaints/:id/assign
   * Body: { technician_id, estimated_date, remarks }
   */
  static async assignTechnicianToComplaint(req, res) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      const { technician_id, estimated_date, remarks } = req.body;
      const staffUserId = req.user.id;

      if (isNaN(complaintId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid complaint ID parameter.'
        });
      }

      if (!technician_id) {
        return res.status(400).json({
          success: false,
          error: 'Technician ID (technician_id) is required for task allocation.'
        });
      }

      // Verify technician exists
      const technician = await TechnicianModel.findById(technician_id);
      if (!technician) {
        return res.status(404).json({
          success: false,
          error: `Technician #${technician_id} not found.`
        });
      }

      // Verify complaint exists
      const complaint = await ComplaintModel.findById(complaintId);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: `Complaint #${complaintId} not found.`
        });
      }

      const assignedRemark = remarks || `Allocated to ${technician.name} (${technician.trade}). Target date: ${estimated_date || 'Standard turnaround'}.`;

      const updated = await ComplaintModel.assignTechnician(complaintId, {
        technicianId: technician_id,
        estimatedDate: estimated_date || null,
        updatedByUserId: staffUserId,
        remarks: assignedRemark
      });

      return res.status(200).json({
        success: true,
        message: `Complaint #${complaintId} successfully assigned to ${technician.name} (${technician.trade}).`,
        data: updated
      });
    } catch (error) {
      console.error('[Staff assignTechnicianToComplaint Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to assign technician to complaint.'
      });
    }
  }

  /**
   * Mark a complaint as Resolved with technician resolution notes.
   * PATCH /api/staff/complaints/:id/resolve
   * Body: { resolution_notes }
   */
  static async resolveComplaint(req, res) {
    try {
      const complaintId = parseInt(req.params.id, 10);
      const { resolution_notes } = req.body;
      const staffUserId = req.user.id;

      if (isNaN(complaintId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid complaint ID parameter.'
        });
      }

      if (!resolution_notes || resolution_notes.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Resolution notes are required and must be at least 5 characters long.'
        });
      }

      const complaint = await ComplaintModel.findById(complaintId);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: `Complaint #${complaintId} not found.`
        });
      }

      const resolved = await ComplaintModel.resolveComplaint(complaintId, {
        resolutionNotes: resolution_notes.trim(),
        updatedByUserId: staffUserId
      });

      return res.status(200).json({
        success: true,
        message: `Complaint #${complaintId} has been marked as Resolved.`,
        data: resolved
      });
    } catch (error) {
      console.error('[Staff resolveComplaint Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve complaint.'
      });
    }
  }
}

module.exports = StaffController;

