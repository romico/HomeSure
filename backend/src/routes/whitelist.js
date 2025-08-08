const express = require('express');
const whitelistController = require('../controllers/whitelistController');
const { authenticateToken } = require('../middleware/auth');
const whitelistService = require('../services/whitelistService');

const router = express.Router();

// 모든 화이트리스트 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 화이트리스트에 사용자 추가
router.post('/add', whitelistController.addToWhitelist);

// 화이트리스트에서 사용자 제거
router.delete('/remove/:userId', whitelistController.removeFromWhitelist);

// 사용자의 화이트리스트 상태 확인
router.get('/status/:userId', whitelistController.checkWhitelistStatus);

// 대량 사용자 화이트리스트 처리
router.post('/bulk', whitelistController.bulkWhitelistUsers);

// 화이트리스트 통계 조회
router.get('/stats', whitelistController.getWhitelistStats);

// 만료된 화이트리스트 엔트리 정리
router.post('/cleanup', whitelistController.cleanupExpiredEntries);

// 화이트리스트 목록 조회
router.get('/entries', whitelistController.getWhitelistEntries);

// 화이트리스트 검증 미들웨어 (다른 라우트에서 사용)
router.use('/verify', whitelistService.whitelistMiddleware);

module.exports = router; 