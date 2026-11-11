const express = require('express');
const router = express.Router();
const StaffController = require('../controllers/staff.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');

// All staff routes require authenticated staff or admin role
router.use(authenticateToken);
router.use(requireRoles('staff', 'admin'));

/**
 * Staff Triage & Assignment Endpoints
 */
router.get('/complaints', StaffController.getAllComplaints);
router.get('/complaints/:id', StaffController.getComplaintById);
router.patch('/complaints/:id/status', StaffController.updateStatus);
router.patch('/complaints/:id/assign', StaffController.assignTechnicianToComplaint);
router.patch('/complaints/:id/resolve', StaffController.resolveComplaint);

/**
 * Technician Directory Endpoints
 */
router.get('/technicians', StaffController.getTechnicians);
router.post('/technicians', StaffController.createTechnician);

module.exports = router;

