const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { authenticateToken } = require('../middleware/auth');
const { validateKYCData } = require('../middleware/validation');

// KYC 상태 확인
router.get('/status/:userAddress', authenticateToken, kycController.checkKYCStatus);

// KYC 검증 프로세스 시작
router.post('/initiate', authenticateToken, validateKYCData, kycController.initiateKYCVerification);

// AML 거래 위험도 검사
router.post('/transaction-risk', authenticateToken, kycController.checkTransactionRisk);

// 화이트리스트 관리
router.post('/whitelist/add', authenticateToken, kycController.addToWhitelist);
router.post('/blacklist/add', authenticateToken, kycController.addToBlacklist);

// 기존 호환성을 위한 라우트들
router.post('/session', authenticateToken, kycController.createVerificationSession);
router.get('/session/:sessionId', authenticateToken, kycController.checkVerificationStatus);

// API 상태 확인
router.get('/api-status', kycController.getApiStatus);

module.exports = router; 