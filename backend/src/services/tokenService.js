const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class TokenService {
  /**
   * JWT 토큰 생성
   */
  static generateToken(payload, expiresIn = null) {
    const options = {
      expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'homesure-api',
      audience: 'homesure-users'
    };

    return jwt.sign(payload, process.env.JWT_SECRET, options);
  }

  /**
   * JWT 토큰 검증
   */
  static verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'homesure-api',
        audience: 'homesure-users'
      });
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 액세스 토큰 생성
   */
  static generateAccessToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'access'
    };

    return this.generateToken(payload, '15m'); // 15분 만료
  }

  /**
   * 리프레시 토큰 생성
   */
  static generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return this.generateToken(payload, '7d'); // 7일 만료
  }

  /**
   * 토큰 쌍 생성 (액세스 + 리프레시)
   */
  static generateTokenPair(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15분 (초 단위)
    };
  }

  /**
   * 토큰 블랙리스트에 추가
   */
  static async blacklistToken(token, reason = 'logout') {
    try {
      const decoded = jwt.decode(token);
      
      await prisma.blacklistedToken.create({
        data: {
          token: token,
          userId: decoded.userId,
          expiresAt: new Date(decoded.exp * 1000),
          reason: reason,
          blacklistedAt: new Date()
        }
      });

      logger.info(`Token blacklisted for user: ${decoded.userId}, reason: ${reason}`);
      return true;
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      return false;
    }
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인
   */
  static async isTokenBlacklisted(token) {
    try {
      const blacklistedToken = await prisma.blacklistedToken.findFirst({
        where: {
          token: token,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      return !!blacklistedToken;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  /**
   * 만료된 블랙리스트 토큰 정리
   */
  static async cleanupExpiredTokens() {
    try {
      const result = await prisma.blacklistedToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired blacklisted tokens`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * 사용자의 모든 토큰 무효화
   */
  static async invalidateUserTokens(userId, reason = 'security') {
    try {
      // 현재 유효한 토큰들을 블랙리스트에 추가
      const activeTokens = await prisma.blacklistedToken.findMany({
        where: {
          userId: userId,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      // 세션 테이블에서 사용자 세션 삭제
      await prisma.userSession.deleteMany({
        where: {
          userId: userId,
          isActive: true
        }
      });

      logger.info(`Invalidated all tokens for user: ${userId}, reason: ${reason}`);
      return true;
    } catch (error) {
      logger.error('Failed to invalidate user tokens:', error);
      return false;
    }
  }

  /**
   * 토큰 사용 통계 조회
   */
  static async getTokenStats() {
    try {
      const [totalBlacklisted, activeBlacklisted, totalSessions, activeSessions] = await Promise.all([
        prisma.blacklistedToken.count(),
        prisma.blacklistedToken.count({
          where: {
            expiresAt: {
              gt: new Date()
            }
          }
        }),
        prisma.userSession.count(),
        prisma.userSession.count({
          where: {
            isActive: true
          }
        })
      ]);

      return {
        blacklistedTokens: {
          total: totalBlacklisted,
          active: activeBlacklisted
        },
        sessions: {
          total: totalSessions,
          active: activeSessions
        }
      };
    } catch (error) {
      logger.error('Failed to get token stats:', error);
      return null;
    }
  }
}

module.exports = TokenService; 