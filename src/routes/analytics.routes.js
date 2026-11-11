const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analytics.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');

// All analytics routes require staff or admin privileges
router.use(authenticateToken);
router.use(requireRoles('staff', 'admin'));

/**
 * Analytics Dashboard Route
 */
router.get('/dashboard', AnalyticsController.getDashboardMetrics);

module.exports = router;

