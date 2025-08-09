const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = express.Router();
const database = require('../config/database');

// 모든 관리자 라우트에 인증 및 관리자 권한 미들웨어 적용
router.use(authenticateToken);
router.use(adminMiddleware);

// KYC 관리자 엔드포인트
router.get('/kyc/users', adminController.getKYCUsers);
router.get('/kyc/stats', adminController.getKYCStats);
router.post('/kyc/approve/:userId', adminController.approveKYC);
router.post('/kyc/reject/:userId', adminController.rejectKYC);
router.post('/kyc/suspend/:userId', adminController.suspendKYC);
router.get('/kyc/user/:userId', adminController.getKYCUserDetails);
router.get('/kyc/audit-logs', adminController.getKYCAuditLogs);

// AML 관리자 엔드포인트
router.get('/aml/alerts', adminController.getAMLAlerts);
router.get('/aml/stats', adminController.getAMLStats);
router.put('/aml/alerts/:alertId/resolve', adminController.resolveAMLAlert);
router.post('/aml/alerts/:alertId/report', adminController.submitAMLReport);
router.get('/aml/transactions', adminController.getAMLTransactions);
router.get('/aml/user/:userId/transactions', adminController.getUserAMLTransactions);

// 화이트리스트 관리 엔드포인트
router.get('/whitelist', adminController.getWhitelist);
router.post('/whitelist/add/:userId', adminController.addToWhitelist);
router.delete('/whitelist/remove/:userId', adminController.removeFromWhitelist);
router.get('/whitelist/stats', adminController.getWhitelistStats);

// 대시보드 통합 엔드포인트
router.get('/dashboard/overview', adminController.getDashboardOverview);
router.get('/dashboard/realtime', adminController.getRealtimeData);
router.get('/dashboard/notifications', adminController.getNotifications);

// DB 연결 상태 및 샘플 조회 테스트
router.get('/dbtest', async (req, res) => {
  try {
    const client = database.getClient ? database.getClient() : null;
    if (!client) {
      return res.status(200).json({ ok: true, connected: false });
    }
    const users = await client.user.findMany({ take: 3, select: { id: true, email: true } });
    return res.json({ ok: true, connected: true, sampleUsers: users });
  } catch (e) {
    return res.status(200).json({ ok: true, connected: false, error: e.message });
  }
});

// 관리자 설정 엔드포인트
router.get('/settings', adminController.getAdminSettings);
router.put('/settings', adminController.updateAdminSettings);
router.get('/settings/audit-logs', adminController.getAdminAuditLogs);

module.exports = router;
