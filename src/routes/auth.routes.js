const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');

/**
 * Authentication and administrator-controlled account provisioning endpoints.
 */
router.post('/register', authenticateToken, requireRoles('admin'), authController.register);
router.post('/login', authController.login);

/**
 * Protected Authentication Endpoints
 */
router.get('/me', authenticateToken, authController.getProfile);

module.exports = router;

