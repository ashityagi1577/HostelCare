const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const { authenticateToken, requireRoles, optionalAuth } = require('../middleware/auth.middleware');
const { handlePhotoUpload } = require('../middleware/upload.middleware');

/**
 * AUTHENTICATED Student-Only Complaint Endpoints
 * Must be declared before parameter routes (like :ticketNo)
 */
router.post('/', authenticateToken, requireRoles('student'), handlePhotoUpload, complaintController.lodgeComplaint);
router.get('/my', authenticateToken, requireRoles('student'), complaintController.getMyComplaints);
router.post('/:id/feedback', authenticateToken, requireRoles('student'), complaintController.submitFeedback);

/**
 * PUBLIC Complaint Tracking Routes (no login required)
 * optionalAuth enriches req.user if token present, but never blocks guests.
 */
router.get('/:identifier/timeline', optionalAuth, complaintController.getComplaintTimeline);
router.get('/:ticketNo',            optionalAuth, complaintController.getComplaintByTicket);

module.exports = router;
