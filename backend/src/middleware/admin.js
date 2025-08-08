const logger = require('../utils/logger');

/**
 * 관리자 권한 확인 미들웨어
 */
const adminMiddleware = (req, res, next) => {
  try {
    // req.user는 authMiddleware에서 설정됨
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.'
      });
    }

    // 관리자 권한 확인
    if (req.user.role !== 'ADMIN') {
      logger.warn(`관리자 권한 없음: ${req.user.id} (${req.user.role})`);
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.'
      });
    }

    logger.info(`관리자 접근: ${req.user.id} - ${req.method} ${req.path}`);
    next();

  } catch (error) {
    logger.error('관리자 권한 확인 실패:', error.message);
    res.status(500).json({
      success: false,
      message: '권한 확인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

module.exports = adminMiddleware; 