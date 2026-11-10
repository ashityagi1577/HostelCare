const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');
const { handlePhotoUpload } = require('../middleware/upload.middleware');

// All complaint routes require valid authentication
router.use(authenticateToken);

/**
 * Student-Only Complaint Endpoints
 */
router.post('/', requireRoles('student'), handlePhotoUpload, complaintController.lodgeComplaint);
router.get('/my', requireRoles('student'), complaintController.getMyComplaints);

/**
 * Universal Complaint Tracking & Timeline Endpoints
 */
router.get('/:identifier/timeline', complaintController.getComplaintTimeline);
router.get('/:ticketNo', complaintController.getComplaintByTicket);

module.exports = router;

