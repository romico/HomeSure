const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class SessionService {
  /**
   * 새 세션 생성
   */
  static async createSession(userId, userAgent = null, ipAddress = null) {
    try {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

      const session = await prisma.userSession.create({
        data: {
          userId,
          sessionToken,
          refreshToken,
          userAgent,
          ipAddress,
          expiresAt
        }
      });

      logger.info(`Session created for user: ${userId}`);
      return session;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * 세션 검증
   */
  static async validateSession(sessionToken) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              kycStatus: true,
              isActive: true,
              walletAddress: true
            }
          }
        }
      });

      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      if (!session.isActive) {
        return { valid: false, reason: 'Session inactive' };
      }

      if (session.expiresAt < new Date()) {
        return { valid: false, reason: 'Session expired' };
      }

      // 마지막 활동 시간 업데이트
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastActivity: new Date() }
      });

      return { valid: true, session, user: session.user };
    } catch (error) {
      logger.error('Failed to validate session:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * 리프레시 토큰으로 세션 갱신
   */
  static async refreshSession(refreshToken) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { refreshToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              kycStatus: true,
              isActive: true,
              walletAddress: true
            }
          }
        }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return { valid: false, reason: 'Invalid refresh token' };
      }

      // 새 세션 토큰 생성
      const newSessionToken = crypto.randomBytes(32).toString('hex');
      const newRefreshToken = crypto.randomBytes(32).toString('hex');

      const updatedSession = await prisma.userSession.update({
        where: { id: session.id },
        data: {
          sessionToken: newSessionToken,
          refreshToken: newRefreshToken,
          lastActivity: new Date()
        }
      });

      logger.info(`Session refreshed for user: ${session.userId}`);

      return {
        valid: true,
        session: updatedSession,
        user: session.user
      };
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      return { valid: false, reason: 'Refresh error' };
    }
  }

  /**
   * 세션 종료
   */
  static async endSession(sessionToken) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { sessionToken }
      });

      if (!session) {
        return false;
      }

      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });

      logger.info(`Session ended for user: ${session.userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to end session:', error);
      return false;
    }
  }

  /**
   * 사용자의 모든 세션 종료
   */
  static async endAllUserSessions(userId) {
    try {
      await prisma.userSession.updateMany({
        where: {
          userId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      logger.info(`All sessions ended for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to end all user sessions:', error);
      return false;
    }
  }

  /**
   * 만료된 세션 정리
   */
  static async cleanupExpiredSessions() {
    try {
      const result = await prisma.userSession.updateMany({
        where: {
          expiresAt: {
            lt: new Date()
          },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired sessions`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * 사용자 세션 목록 조회
   */
  static async getUserSessions(userId) {
    try {
      const sessions = await prisma.userSession.findMany({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          lastActivity: 'desc'
        }
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * 세션 통계 조회
   */
  static async getSessionStats() {
    try {
      const [totalSessions, activeSessions, expiredSessions] = await Promise.all([
        prisma.userSession.count(),
        prisma.userSession.count({
          where: {
            isActive: true,
            expiresAt: {
              gt: new Date()
            }
          }
        }),
        prisma.userSession.count({
          where: {
            expiresAt: {
              lt: new Date()
            }
          }
        })
      ]);

      return {
        total: totalSessions,
        active: activeSessions,
        expired: expiredSessions
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return null;
    }
  }

  /**
   * 비정상적인 활동 감지
   */
  static async detectSuspiciousActivity(userId, ipAddress, userAgent) {
    try {
      // 최근 1시간 내 다른 IP에서의 로그인 시도 확인
      const recentSessions = await prisma.userSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // 1시간
          },
          ipAddress: {
            not: ipAddress
          }
        }
      });

      if (recentSessions.length > 0) {
        logger.warn(`Suspicious activity detected for user: ${userId}, IP: ${ipAddress}`);
        return {
          suspicious: true,
          reason: 'Multiple IP addresses in short time',
          sessions: recentSessions
        };
      }

      return { suspicious: false };
    } catch (error) {
      logger.error('Failed to detect suspicious activity:', error);
      return { suspicious: false };
    }
  }
}

module.exports = SessionService; 