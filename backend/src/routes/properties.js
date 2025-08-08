const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { authenticateToken, authorizeRole, authorizePropertyOwner } = require('../middleware/auth');
const { 
  validatePropertyCreation, 
  validatePropertyUpdate, 
  validateId, 
  validatePagination, 
  validateSearch 
} = require('../middleware/validation');

/**
 * @route   GET /api/properties
 * @desc    Get all properties (with pagination, filtering, search)
 * @access  Public
 */
router.get('/', validatePagination, validateSearch, propertyController.getAllProperties);

/**
 * @route   GET /api/properties/:id
 * @desc    Get property by ID
 * @access  Public
 */
router.get('/:id', validateId, propertyController.getPropertyById);

/**
 * @route   POST /api/properties
 * @desc    Create new property
 * @access  Private (Authenticated users)
 */
router.post('/', authenticateToken, validatePropertyCreation, propertyController.createProperty);

/**
 * @route   PUT /api/properties/:id
 * @desc    Update property
 * @access  Private (Property owner or admin)
 */
router.put('/:id', authenticateToken, validateId, validatePropertyUpdate, authorizePropertyOwner, propertyController.updateProperty);

/**
 * @route   DELETE /api/properties/:id
 * @desc    Delete property
 * @access  Private (Property owner or admin)
 */
router.delete('/:id', authenticateToken, validateId, authorizePropertyOwner, propertyController.deleteProperty);

/**
 * @route   POST /api/properties/:id/tokenize
 * @desc    Tokenize property
 * @access  Private (Property owner, registrar, or admin)
 */
router.post('/:id/tokenize', authenticateToken, validateId, authorizeRole('ADMIN', 'REGISTRAR'), propertyController.tokenizeProperty);

/**
 * @route   GET /api/properties/:id/valuation
 * @desc    Get property valuation
 * @access  Public
 */
router.get('/:id/valuation', validateId, propertyController.getPropertyValuation);

module.exports = router; 