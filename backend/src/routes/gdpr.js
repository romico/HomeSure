const express = require('express');
const { body, param, query } = require('express-validator');
const gdprController = require('../controllers/gdprController');
const { authenticateToken } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting
const gdprRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10, // 최대 10회 요청
  message: {
    success: false,
    message: '너무 많은 GDPR 요청이 발생했습니다. 15분 후에 다시 시도해주세요.'
  }
});

// Validation middleware
const validateConsentData = [
  body('userId').notEmpty().withMessage('사용자 ID는 필수입니다.'),
  body('consentType').isIn(['DATA_PROCESSING', 'MARKETING', 'THIRD_PARTY', 'ANALYTICS']).withMessage('유효한 동의 타입을 선택하세요.'),
  body('isGranted').isBoolean().withMessage('동의 여부는 boolean 값이어야 합니다.')
];

const validateDeletionRequest = [
  body('userId').notEmpty().withMessage('사용자 ID는 필수입니다.'),
  body('reason').optional().isString().withMessage('사유는 문자열이어야 합니다.')
];

const validateProcessDeletion = [
  body('adminId').notEmpty().withMessage('관리자 ID는 필수입니다.'),
  param('requestId').notEmpty().withMessage('요청 ID는 필수입니다.')
];

// GDPR 동의 관리
router.post('/consent', 
  authenticateToken, 
  gdprRateLimit,
  validateConsentData,
  gdprController.manageConsent
);

// 개인정보 삭제 요청
router.post('/deletion-request', 
  authenticateToken, 
  gdprRateLimit,
  validateDeletionRequest,
  gdprController.requestDataDeletion
);

// 개인정보 삭제 요청 처리 (관리자용)
router.post('/deletion-request/:requestId/process', 
  authenticateToken, 
  adminMiddleware,
  gdprRateLimit,
  validateProcessDeletion,
  gdprController.processDataDeletion
);

// 개인정보 내보내기
router.get('/export/:userId', 
  authenticateToken, 
  gdprRateLimit,
  param('userId').notEmpty().withMessage('사용자 ID는 필수입니다.'),
  gdprController.exportPersonalData
);

// 만료된 데이터 정리 (관리자용)
router.post('/cleanup/:dataType', 
  authenticateToken, 
  adminMiddleware,
  gdprRateLimit,
  param('dataType').isIn(['KYC_DATA', 'TRANSACTION_DATA', 'USER_PROFILE', 'AML_DATA', 'AUDIT_LOGS', 'TEMP_DATA']).withMessage('유효한 데이터 타입을 선택하세요.'),
  gdprController.cleanupExpiredData
);

// 접근 로그 조회 (관리자용)
router.get('/access-logs', 
  authenticateToken, 
  adminMiddleware,
  gdprRateLimit,
  query('page').optional().isInt({ min: 1 }).withMessage('페이지 번호는 1 이상의 정수여야 합니다.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('페이지 크기는 1-100 사이의 정수여야 합니다.'),
  query('startDate').optional().isISO8601().withMessage('시작 날짜는 유효한 날짜 형식이어야 합니다.'),
  query('endDate').optional().isISO8601().withMessage('종료 날짜는 유효한 날짜 형식이어야 합니다.'),
  gdprController.getAccessLogs
);

// 데이터 암호화 상태 확인 (관리자용)
router.get('/encryption-status', 
  authenticateToken, 
  adminMiddleware,
  gdprRateLimit,
  gdprController.getEncryptionStatus
);

module.exports = router; 