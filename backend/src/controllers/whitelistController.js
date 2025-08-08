const whitelistService = require('../services/whitelistService');
const logger = require('../utils/logger');

class WhitelistController {
  /**
   * 사용자를 화이트리스트에 추가
   */
  async addToWhitelist(req, res) {
    try {
      const { userId, verificationId, reason, expiresAt } = req.body;
      const approvedBy = req.user.id; // 현재 로그인한 관리자

      // 필수 필드 검증
      if (!userId || !verificationId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID와 검증 ID는 필수입니다.'
        });
      }

      const whitelistEntry = await whitelistService.addToWhitelist(
        userId,
        verificationId,
        approvedBy,
        reason,
        expiresAt ? new Date(expiresAt) : null
      );

      logger.info(`화이트리스트 추가 성공: ${userId} by ${approvedBy}`);

      res.status(201).json({
        success: true,
        data: whitelistEntry,
        message: '사용자가 화이트리스트에 추가되었습니다.'
      });

    } catch (error) {
      logger.error('화이트리스트 추가 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 추가 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 사용자를 화이트리스트에서 제거
   */
  async removeFromWhitelist(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.'
        });
      }

      const result = await whitelistService.removeFromWhitelist(userId, reason);

      logger.info(`화이트리스트 제거 성공: ${userId}`);

      res.status(200).json({
        success: true,
        message: '사용자가 화이트리스트에서 제거되었습니다.'
      });

    } catch (error) {
      logger.error('화이트리스트 제거 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 제거 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 사용자의 화이트리스트 상태 확인
   */
  async checkWhitelistStatus(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.'
        });
      }

      const status = await whitelistService.checkWhitelistStatus(userId);
      const isWhitelisted = await whitelistService.isWhitelisted(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          isWhitelisted,
          status: status ? status.status : null,
          expiresAt: status ? status.expiresAt : null
        },
        message: '화이트리스트 상태를 확인했습니다.'
      });

    } catch (error) {
      logger.error('화이트리스트 상태 확인 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 상태 확인 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 대량 사용자 화이트리스트 처리
   */
  async bulkWhitelistUsers(req, res) {
    try {
      const { users } = req.body;
      const approvedBy = req.user.id;

      if (!users || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          message: '사용자 목록이 필요합니다.'
        });
      }

      const results = await whitelistService.bulkWhitelistUsers(users, approvedBy);

      logger.info(`대량 화이트리스트 처리 완료: ${results.success.length}명 성공, ${results.failed.length}명 실패`);

      res.status(200).json({
        success: true,
        data: results,
        message: '대량 화이트리스트 처리가 완료되었습니다.'
      });

    } catch (error) {
      logger.error('대량 화이트리스트 처리 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '대량 화이트리스트 처리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 화이트리스트 통계 조회
   */
  async getWhitelistStats(req, res) {
    try {
      const stats = await whitelistService.getWhitelistStats();

      res.status(200).json({
        success: true,
        data: stats,
        message: '화이트리스트 통계를 조회했습니다.'
      });

    } catch (error) {
      logger.error('화이트리스트 통계 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 통계 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 만료된 화이트리스트 엔트리 정리
   */
  async cleanupExpiredEntries(req, res) {
    try {
      const cleanedCount = await whitelistService.cleanupExpiredEntries();

      res.status(200).json({
        success: true,
        data: { cleanedCount },
        message: `만료된 화이트리스트 엔트리 ${cleanedCount}개를 정리했습니다.`
      });

    } catch (error) {
      logger.error('화이트리스트 정리 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 정리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 화이트리스트 목록 조회
   */
  async getWhitelistEntries(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;

      // TODO: 데이터베이스에서 조회
      const mockEntries = [
        {
          id: '1',
          userId: 'user1',
          verificationId: 'ver1',
          status: 'ACTIVE',
          approvedBy: 'admin1',
          approvedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          createdAt: new Date()
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          entries: mockEntries,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: mockEntries.length
          }
        },
        message: '화이트리스트 목록을 조회했습니다.'
      });

    } catch (error) {
      logger.error('화이트리스트 목록 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 목록 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
}

module.exports = new WhitelistController(); 