const ComplaintModel = require('../models/complaint.model');
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
}

module.exports = StaffController;

