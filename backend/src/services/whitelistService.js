const logger = require('../utils/logger');

class WhitelistService {
  constructor() {
    // 메모리 캐시 (실제 환경에서는 Redis 사용 권장)
    this.whitelistCache = new Map();
    this.cacheExpiry = new Map();
  }

  /**
   * 사용자를 화이트리스트에 추가
   * @param {string} userId - 사용자 ID
   * @param {string} verificationId - 검증 ID
   * @param {string} approvedBy - 승인자 ID
   * @param {string} reason - 승인 이유
   * @param {Date} expiresAt - 만료일
   * @returns {Object} 화이트리스트 엔트리
   */
  async addToWhitelist(userId, verificationId, approvedBy, reason = '', expiresAt = null) {
    try {
      logger.info(`화이트리스트 추가: ${userId} by ${approvedBy}`);

      // 만료일이 없으면 1년 후로 설정
      const expiryDate = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const whitelistEntry = {
        userId,
        verificationId,
        status: 'ACTIVE',
        approvedBy,
        approvedAt: new Date(),
        reason,
        expiresAt: expiryDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 캐시에 저장
      this.whitelistCache.set(userId, whitelistEntry);
      this.cacheExpiry.set(userId, expiryDate);

      // TODO: 데이터베이스에 저장
      // const savedEntry = await prisma.whitelistEntry.create({
      //   data: whitelistEntry
      // });

      logger.info(`화이트리스트 추가 완료: ${userId}`);
      return whitelistEntry;

    } catch (error) {
      logger.error('화이트리스트 추가 실패:', error.message);
      throw new Error(`화이트리스트 추가 실패: ${error.message}`);
    }
  }

  /**
   * 사용자를 화이트리스트에서 제거
   * @param {string} userId - 사용자 ID
   * @param {string} reason - 제거 이유
   * @returns {boolean} 성공 여부
   */
  async removeFromWhitelist(userId, reason = '') {
    try {
      logger.info(`화이트리스트 제거: ${userId}, 이유: ${reason}`);

      // 캐시에서 제거
      this.whitelistCache.delete(userId);
      this.cacheExpiry.delete(userId);

      // TODO: 데이터베이스에서 상태 업데이트
      // await prisma.whitelistEntry.update({
      //   where: { userId },
      //   data: {
      //     status: 'REVOKED',
      //     reason,
      //     updatedAt: new Date()
      //   }
      // });

      logger.info(`화이트리스트 제거 완료: ${userId}`);
      return true;

    } catch (error) {
      logger.error('화이트리스트 제거 실패:', error.message);
      throw new Error(`화이트리스트 제거 실패: ${error.message}`);
    }
  }

  /**
   * 사용자의 화이트리스트 상태 확인
   * @param {string} userId - 사용자 ID
   * @returns {Object|null} 화이트리스트 엔트리 또는 null
   */
  async checkWhitelistStatus(userId) {
    try {
      // 캐시에서 확인
      const cachedEntry = this.whitelistCache.get(userId);
      
      if (cachedEntry) {
        // 만료 확인
        if (cachedEntry.expiresAt && new Date() > cachedEntry.expiresAt) {
          logger.info(`화이트리스트 만료: ${userId}`);
          this.whitelistCache.delete(userId);
          this.cacheExpiry.delete(userId);
          return null;
        }
        
        return cachedEntry;
      }

      // TODO: 데이터베이스에서 확인
      // const dbEntry = await prisma.whitelistEntry.findUnique({
      //   where: { userId },
      //   include: { verification: true }
      // });

      // if (dbEntry && dbEntry.status === 'ACTIVE') {
      //   // 캐시에 저장
      //   this.whitelistCache.set(userId, dbEntry);
      //   this.cacheExpiry.set(userId, dbEntry.expiresAt);
      //   return dbEntry;
      // }

      return null;

    } catch (error) {
      logger.error('화이트리스트 상태 확인 실패:', error.message);
      return null;
    }
  }

  /**
   * 화이트리스트에 있는지 확인
   * @param {string} userId - 사용자 ID
   * @returns {boolean} 화이트리스트 포함 여부
   */
  async isWhitelisted(userId) {
    const entry = await this.checkWhitelistStatus(userId);
    return entry !== null && entry.status === 'ACTIVE';
  }

  /**
   * 대량 사용자 화이트리스트 처리
   * @param {Array} userData - 사용자 데이터 배열
   * @param {string} approvedBy - 승인자 ID
   * @returns {Object} 처리 결과
   */
  async bulkWhitelistUsers(userData, approvedBy) {
    try {
      logger.info(`대량 화이트리스트 처리 시작: ${userData.length}명`);

      const results = {
        success: [],
        failed: [],
        total: userData.length
      };

      for (const user of userData) {
        try {
          const entry = await this.addToWhitelist(
            user.userId,
            user.verificationId,
            approvedBy,
            user.reason,
            user.expiresAt
          );
          results.success.push(entry);
        } catch (error) {
          results.failed.push({
            userId: user.userId,
            error: error.message
          });
        }
      }

      logger.info(`대량 화이트리스트 처리 완료: 성공 ${results.success.length}명, 실패 ${results.failed.length}명`);
      return results;

    } catch (error) {
      logger.error('대량 화이트리스트 처리 실패:', error.message);
      throw new Error(`대량 화이트리스트 처리 실패: ${error.message}`);
    }
  }

  /**
   * 화이트리스트 통계 조회
   * @returns {Object} 통계 정보
   */
  async getWhitelistStats() {
    try {
      const now = new Date();
      let activeCount = 0;
      let expiredCount = 0;
      let suspendedCount = 0;

      // 캐시된 데이터 분석
      for (const [userId, entry] of this.whitelistCache) {
        if (entry.status === 'ACTIVE') {
          if (entry.expiresAt && now > entry.expiresAt) {
            expiredCount++;
          } else {
            activeCount++;
          }
        } else if (entry.status === 'SUSPENDED') {
          suspendedCount++;
        }
      }

      // TODO: 데이터베이스 통계도 포함
      // const dbStats = await prisma.whitelistEntry.groupBy({
      //   by: ['status'],
      //   _count: { status: true }
      // });

      return {
        total: this.whitelistCache.size,
        active: activeCount,
        expired: expiredCount,
        suspended: suspendedCount,
        lastUpdated: now
      };

    } catch (error) {
      logger.error('화이트리스트 통계 조회 실패:', error.message);
      return {
        total: 0,
        active: 0,
        expired: 0,
        suspended: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * 만료된 화이트리스트 엔트리 정리
   * @returns {number} 정리된 엔트리 수
   */
  async cleanupExpiredEntries() {
    try {
      const now = new Date();
      let cleanedCount = 0;

      for (const [userId, entry] of this.whitelistCache) {
        if (entry.expiresAt && now > entry.expiresAt) {
          this.whitelistCache.delete(userId);
          this.cacheExpiry.delete(userId);
          cleanedCount++;
        }
      }

      logger.info(`만료된 화이트리스트 엔트리 정리: ${cleanedCount}개`);
      return cleanedCount;

    } catch (error) {
      logger.error('화이트리스트 정리 실패:', error.message);
      return 0;
    }
  }

  /**
   * 화이트리스트 검증 미들웨어
   * @param {Object} req - Express request 객체
   * @param {Object} res - Express response 객체
   * @param {Function} next - Express next 함수
   */
  async whitelistMiddleware(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.'
        });
      }

      const isWhitelisted = await this.isWhitelisted(userId);
      
      if (!isWhitelisted) {
        return res.status(403).json({
          success: false,
          message: 'KYC 인증이 완료되지 않았습니다. 화이트리스트에 등록된 사용자만 거래할 수 있습니다.'
        });
      }

      next();

    } catch (error) {
      logger.error('화이트리스트 미들웨어 오류:', error.message);
      return res.status(500).json({
        success: false,
        message: '화이트리스트 검증 중 오류가 발생했습니다.'
      });
    }
  }
}

module.exports = new WhitelistService(); 