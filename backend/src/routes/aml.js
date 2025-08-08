const express = require('express');
const amlController = require('../controllers/amlController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 모든 AML 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 거래 위험도 분석
router.post('/analyze', amlController.analyzeTransaction);

// AML 알림 목록 조회
router.get('/alerts', amlController.getAlerts);

// AML 알림 해결
router.put('/alerts/:alertId/resolve', amlController.resolveAlert);

// AML 리포트 생성
router.get('/reports/:userId', amlController.generateReport);

// 규제 당국 신고
router.post('/alerts/:alertId/report', amlController.submitRegulatoryReport);

// AML 통계 조회
router.get('/stats', amlController.getAMLStats);

// 사용자 위험도 점수 조회
router.get('/risk-score/:userId', amlController.getUserRiskScore);

// AML 규칙 설정 업데이트
router.put('/rules', amlController.updateAMLRules);

module.exports = router; 