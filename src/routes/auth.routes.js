const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

/**
 * Public Authentication Endpoints
 */
router.post('/register', authController.register);
router.post('/login', authController.login);

/**
 * Protected Authentication Endpoints
 */
router.get('/me', authenticateToken, authController.getProfile);

module.exports = router;

