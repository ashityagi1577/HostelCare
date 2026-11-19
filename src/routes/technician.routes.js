const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');
const technicianController = require('../controllers/technician.controller');

// All technician routes require authenticated technician role
router.use(authenticateToken);
router.use(requireRoles('technician'));

/**
 * @route   GET /api/technician/overview
 * @desc    KPI summary & technician profile
 */
router.get('/overview', technicianController.getOverview);

/**
 * @route   GET /api/technician/complaints
 * @desc    Get all complaints assigned to logged-in technician
 */
router.get('/complaints', technicianController.getMyComplaints);

/**
 * @route   GET /api/technician/complaints/:id
 * @desc    Get single assigned complaint details and timeline logs
 */
router.get('/complaints/:id', technicianController.getComplaintById);

/**
 * @route   PUT /api/technician/complaints/:id/status
 * @desc    Update complaint status ('Assigned' | 'In_Progress' | 'Resolved') and add work remarks
 */
router.put('/complaints/:id/status', technicianController.updateComplaintStatus);

module.exports = router;
