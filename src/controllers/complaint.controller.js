const ComplaintModel = require('../models/complaint.model');
const FeedbackModel = require('../models/feedback.model');
const { TimelineService } = require('../services/timeline.service');

const ALLOWED_CATEGORIES = ['Electrical', 'Plumbing', 'Carpentry', 'Cleaning', 'WiFi_Internet', 'Other'];
const ALLOWED_PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];

/**
 * Lodge a new maintenance complaint (Student only).
 * POST /api/complaints
 * Expects multipart/form-data or json (with optional 'photo' upload)
 */
async function lodgeComplaint(req, res) {
  try {
    const { category, title, description, priority = 'Medium' } = req.body;
    const studentId = req.user.id;

    // 1. Validation
    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Title is required and must be at least 5 characters long.'
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Description is required and must be at least 10 characters long.'
      });
    }

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${ALLOWED_PRIORITIES.join(', ')}`
      });
    }

    // Photo file (populated by Multer middleware if an image was uploaded)
    const photoUrl = req.file ? req.file.relativeUrl : null;

    // 2. Create Complaint Record in Database
    const complaint = await ComplaintModel.createComplaint({
      student_id: studentId,
      category,
      title,
      description,
      photo_url: photoUrl,
      priority
    });

    return res.status(201).json({
      success: true,
      message: `Complaint lodged successfully! Your tracking ticket is ${complaint.ticket_no}.`,
      data: complaint
    });
  } catch (error) {
    console.error('[Lodge Complaint Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while submitting your maintenance request.'
    });
  }
}

/**
 * Retrieve all complaints submitted by the authenticated resident.
 * GET /api/complaints/my
 * Optional Query params: ?status=Pending&category=Electrical
 */
async function getMyComplaints(req, res) {
  try {
    const studentId = req.user.id;
    const { status, category } = req.query;

    const complaints = await ComplaintModel.findByStudentId(studentId, { status, category });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error('[Get My Complaints Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve your complaints.'
    });
  }
}

/**
 * Retrieve comprehensive details and timeline for a single complaint by ticket number.
 * GET /api/complaints/:ticketNo
 */
async function getComplaintByTicket(req, res) {
  try {
    const { ticketNo } = req.params;

    if (!ticketNo || !ticketNo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Ticket number parameter is required.'
      });
    }

    const complaint = await ComplaintModel.findByTicketNo(ticketNo.trim());

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with ticket number '${ticketNo}' not found.`
      });
    }

    // Access control:
    //  - Guests (no token): public view — allow (hides sensitive student info if needed)
    //  - Students: can only view their own tickets
    //  - Staff / Admin: can view any ticket
    if (req.user && req.user.role === 'student' && complaint.student_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to view another resident\'s maintenance ticket.'
      });
    }

    // Fetch feedback info if exists (to show "already rated" on track page)
    let feedbackRating = null;
    let feedbackComments = null;
    try {
      const fb = await FeedbackModel.findByComplaintId(complaint.id);
      if (fb) { feedbackRating = fb.rating; feedbackComments = fb.comments; }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      data: {
        ...complaint,
        feedback_rating: feedbackRating,
        feedback_comments: feedbackComments
      }
    });
  } catch (error) {
    console.error('[Get Complaint By Ticket Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve ticket details.'
    });
  }
}

/**
 * Retrieve enriched stepper timeline and milestone events for a complaint.
 * GET /api/complaints/:identifier/timeline
 * Parameter can be either numeric ID (e.g. 1) or Ticket Number (e.g. HC-2026-0001)
 */
async function getComplaintTimeline(req, res) {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Complaint ID or Ticket Number parameter is required.'
      });
    }

    // Check if identifier is ticket number or numeric ID
    let complaint;
    if (identifier.toUpperCase().startsWith('HC-')) {
      complaint = await ComplaintModel.findByTicketNo(identifier.trim());
    } else {
      complaint = await ComplaintModel.findById(parseInt(identifier, 10));
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint '${identifier}' not found.`
      });
    }

    // Access control: Student can only view their own ticket timeline; guests can view any
    if (req.user && req.user.role === 'student' && complaint.student_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have access to this complaint\'s timeline.'
      });
    }

    const timelineData = await TimelineService.getEnrichedTimeline(complaint);

    return res.status(200).json({
      success: true,
      data: timelineData
    });
  } catch (error) {
    console.error('[Get Complaint Timeline Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate complaint timeline.'
    });
  }
}

/**
 * Submit resident rating & review remarks for a resolved complaint.
 * POST /api/complaints/:id/feedback
 * Body: { rating, comments }
 */
async function submitFeedback(req, res) {
  try {
    const complaintId = parseInt(req.params.id, 10);
    const { rating, comments } = req.body;
    const studentId = req.user.id;

    if (isNaN(complaintId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid complaint ID parameter.'
      });
    }

    if (rating === undefined || rating === null) {
      return res.status(400).json({
        success: false,
        error: 'Rating is required (1 to 5 stars).'
      });
    }

    const feedback = await FeedbackModel.createFeedback({
      complaint_id: complaintId,
      student_id: studentId,
      rating,
      comments
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! The maintenance ticket has been closed.',
      data: feedback
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json({ success: false, error: error.message });
    }
    if (error.code === 'INVALID_STATUS') {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === 'ALREADY_EXISTS') {
      return res.status(409).json({ success: false, error: error.message });
    }

    console.error('[Submit Feedback Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit feedback.'
    });
  }
}

module.exports = {
  lodgeComplaint,
  getMyComplaints,
  getComplaintByTicket,
  getComplaintTimeline,
  submitFeedback,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES
};

