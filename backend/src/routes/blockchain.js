const express = require('express');
const router = express.Router();
const blockchainController = require('../controllers/blockchainController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateId } = require('../middleware/validation');
const { blockchainRateLimiter, blockchainSlowDown } = require('../middleware/security');

/**
 * @route   GET /api/blockchain/status
 * @desc    Get blockchain network status
 * @access  Public
 */
router.get('/status', blockchainRateLimiter, blockchainSlowDown, blockchainController.getNetworkStatus);

/**
 * @route   GET /api/blockchain/token-balance/:address
 * @desc    Get token balance for an address
 * @access  Public
 */
router.get('/token-balance/:address', validateId, blockchainController.getTokenBalance);

/**
 * @route   POST /api/blockchain/transfer
 * @desc    Transfer tokens between addresses
 * @access  Private (Authenticated users)
 */
router.post('/transfer', authenticateToken, blockchainController.transferTokens);

/**
 * @route   POST /api/blockchain/issue-tokens
 * @desc    Issue new tokens
 * @access  Private (Admin, Registrar only)
 */
router.post('/issue-tokens', authenticateToken, authorizeRole('ADMIN', 'REGISTRAR'), blockchainController.issueTokens);

/**
 * @route   POST /api/blockchain/burn-tokens
 * @desc    Burn tokens
 * @access  Private (Admin, Registrar only)
 */
router.post('/burn-tokens', authenticateToken, authorizeRole('ADMIN', 'REGISTRAR'), blockchainController.burnTokens);

/**
 * @route   POST /api/blockchain/register-property
 * @desc    Register a new property on blockchain
 * @access  Private (Authenticated users)
 */
router.post('/register-property', authenticateToken, blockchainController.registerProperty);

/**
 * @route   GET /api/blockchain/property/:propertyId
 * @desc    Get property information from blockchain
 * @access  Public
 */
router.get('/property/:propertyId', validateId, blockchainController.getProperty);

/**
 * @route   GET /api/blockchain/property-count
 * @desc    Get total number of properties on blockchain
 * @access  Public
 */
router.get('/property-count', blockchainController.getPropertyCount);

/**
 * @route   POST /api/blockchain/oracle/update
 * @desc    Update oracle data
 * @access  Private (Oracle, Admin only)
 */
router.post('/oracle/update', authenticateToken, authorizeRole('ORACLE', 'ADMIN'), blockchainController.updateOracleData);

/**
 * @route   GET /api/blockchain/oracle/:propertyId/:dataType
 * @desc    Get oracle data for a property
 * @access  Public
 */
router.get('/oracle/:propertyId/:dataType', validateId, blockchainController.getOracleData);

/**
 * @route   POST /api/blockchain/valuation/create
 * @desc    Create a new valuation
 * @access  Private (Valuator, Admin only)
 */
router.post('/valuation/create', authenticateToken, authorizeRole('VALUATOR', 'ADMIN'), blockchainController.createValuation);

/**
 * @route   POST /api/blockchain/valuation/complete
 * @desc    Complete a valuation
 * @access  Private (Valuator, Admin only)
 */
router.post('/valuation/complete', authenticateToken, authorizeRole('VALUATOR', 'ADMIN'), blockchainController.completeValuation);

/**
 * @route   GET /api/blockchain/valuation/:valuationId
 * @desc    Get valuation information
 * @access  Public
 */
router.get('/valuation/:valuationId', validateId, blockchainController.getValuation);

/**
 * @route   POST /api/blockchain/estimate-gas
 * @desc    Estimate gas cost for a transaction
 * @access  Public
 */
router.post('/estimate-gas', blockchainController.estimateGas);

/**
 * @route   GET /api/blockchain/transaction/:txHash
 * @desc    Get transaction status
 * @access  Public
 */
router.get('/transaction/:txHash', validateId, blockchainController.getTransactionStatus);

/**
 * @route   GET /api/blockchain/block/:blockNumber
 * @desc    Get block information
 * @access  Public
 */
router.get('/block/:blockNumber', validateId, blockchainController.getBlockInfo);

module.exports = router; 