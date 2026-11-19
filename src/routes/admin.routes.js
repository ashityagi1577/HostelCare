const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');

// All administrative oversight endpoints strictly require authenticated 'admin' role
router.use(authenticateToken);
router.use(requireRoles('admin'));

/**
 * Executive Management & Monitoring Endpoints
 */
router.get('/overview', AdminController.getAdminOverview);
router.get('/students', AdminController.getStudentsDirectory);
router.get('/staff',    AdminController.getStaffDirectory);
router.get('/rooms',    AdminController.getRoomsDirectory);

/**
 * Account Provisioning: Admin registers users (Student, Staff, Technician, Admin)
 */
router.post('/users',   AdminController.registerUser);

module.exports = router;

