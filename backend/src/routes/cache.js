const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { cacheStatus, flushCache } = require('../middleware/cache');

/**
 * @route   GET /api/cache/status
 * @desc    Get cache status and statistics
 * @access  Private (Admin only)
 */
router.get('/status', authenticateToken, authorizeRole('ADMIN'), cacheStatus);

/**
 * @route   POST /api/cache/flush
 * @desc    Flush all cache data
 * @access  Private (Admin only)
 */
router.post('/flush', authenticateToken, authorizeRole('ADMIN'), flushCache);

module.exports = router; 