const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const tradingController = require('../controllers/tradingController');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for trading operations
const tradingRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many trading requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware
const validateOrder = [
  body('propertyId').isInt({ min: 1 }).withMessage('Property ID must be a positive integer'),
  body('orderType').isIn(['0', '1']).withMessage('Order type must be 0 (BUY) or 1 (SELL)'),
  body('price').isFloat({ min: 0.000001 }).withMessage('Price must be a positive number'),
  body('quantity').isFloat({ min: 0.000001 }).withMessage('Quantity must be a positive number'),
  body('expiryTime').isInt({ min: Math.floor(Date.now() / 1000) + 300 }).withMessage('Expiry time must be at least 5 minutes in the future'),
];

const validateOrderMatch = [
  body('buyOrderId').isInt({ min: 1 }).withMessage('Buy order ID must be a positive integer'),
  body('sellOrderId').isInt({ min: 1 }).withMessage('Sell order ID must be a positive integer'),
  body('quantity').isFloat({ min: 0.000001 }).withMessage('Quantity must be a positive number'),
];

const validateEscrow = [
  body('tradeId').isInt({ min: 1 }).withMessage('Trade ID must be a positive integer'),
  body('amount').isFloat({ min: 0.000001 }).withMessage('Amount must be a positive number'),
  body('conditions').isString().isLength({ min: 1, max: 500 }).withMessage('Conditions must be between 1 and 500 characters'),
];

// Apply rate limiting to all trading routes
router.use(tradingRateLimit);

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/trading/orders
 * @desc    Create a new trading order
 * @access  Private
 */
router.post('/orders', validateOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.createOrder(req, res);
    return result;
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create order',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/orders
 * @desc    Get orders with filtering and pagination
 * @access  Private
 */
router.get('/orders', [
  query('propertyId').optional().isInt({ min: 1 }),
  query('orderType').optional().isIn(['0', '1']),
  query('status').optional().isIn(['0', '1', '2', '3', '4']),
  query('trader').optional().isEthereumAddress(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.getOrders(req, res);
    return result;
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get orders',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/orders/:orderId
 * @desc    Get specific order details
 * @access  Private
 */
router.get('/orders/:orderId', [
  param('orderId').isInt({ min: 1 }).withMessage('Order ID must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.getOrder(req, res);
    return result;
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get order',
      error: error.message 
    });
  }
});

/**
 * @route   DELETE /api/trading/orders/:orderId
 * @desc    Cancel an order
 * @access  Private
 */
router.delete('/orders/:orderId', [
  param('orderId').isInt({ min: 1 }).withMessage('Order ID must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.cancelOrder(req, res);
    return result;
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel order',
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/trading/match
 * @desc    Match orders and execute trade
 * @access  Private (Admin/Matcher only)
 */
router.post('/match', validateOrderMatch, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.matchOrders(req, res);
    return result;
  } catch (error) {
    console.error('Match orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to match orders',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/trades
 * @desc    Get trades with filtering and pagination
 * @access  Private
 */
router.get('/trades', [
  query('propertyId').optional().isInt({ min: 1 }),
  query('buyer').optional().isEthereumAddress(),
  query('seller').optional().isEthereumAddress(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.getTrades(req, res);
    return result;
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get trades',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/trades/:tradeId
 * @desc    Get specific trade details
 * @access  Private
 */
router.get('/trades/:tradeId', [
  param('tradeId').isInt({ min: 1 }).withMessage('Trade ID must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.getTrade(req, res);
    return result;
  } catch (error) {
    console.error('Get trade error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get trade',
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/trading/escrow
 * @desc    Create escrow for a trade
 * @access  Private (Admin/Escrow Manager only)
 */
router.post('/escrow', validateEscrow, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.createEscrow(req, res);
    return result;
  } catch (error) {
    console.error('Create escrow error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create escrow',
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/trading/escrow/:escrowId/release
 * @desc    Release escrow funds
 * @access  Private (Admin/Escrow Manager only)
 */
router.post('/escrow/:escrowId/release', [
  param('escrowId').isInt({ min: 1 }).withMessage('Escrow ID must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.releaseEscrow(req, res);
    return result;
  } catch (error) {
    console.error('Release escrow error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to release escrow',
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/trading/escrow/:escrowId/refund
 * @desc    Refund escrow funds
 * @access  Private (Admin/Escrow Manager only)
 */
router.post('/escrow/:escrowId/refund', [
  param('escrowId').isInt({ min: 1 }).withMessage('Escrow ID must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.refundEscrow(req, res);
    return result;
  } catch (error) {
    console.error('Refund escrow error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to refund escrow',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/history
 * @desc    Get trading history for current user
 * @access  Private
 */
router.get('/history', [
  query('propertyId').optional().isInt({ min: 1 }),
  query('orderType').optional().isIn(['0', '1']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.getTradingHistory(req, res);
    return result;
  } catch (error) {
    console.error('Get trading history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get trading history',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/stats
 * @desc    Get trading statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await tradingController.getTradingStats(req, res);
    return result;
  } catch (error) {
    console.error('Get trading stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get trading statistics',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/trading/orderbook/:propertyId
 * @desc    Get order book for a specific property
 * @access  Private
 */
router.get('/orderbook/:propertyId', [
  param('propertyId').isInt({ min: 1 }).withMessage('Property ID must be a positive integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await tradingController.getOrderBook(req, res);
    return result;
  } catch (error) {
    console.error('Get order book error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get order book',
      error: error.message 
    });
  }
});

module.exports = router; 