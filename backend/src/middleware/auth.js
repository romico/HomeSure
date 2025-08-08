const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const TokenService = require('../services/tokenService');
const SessionService = require('../services/sessionService');

const prisma = new PrismaClient();

/**
 * JWT 토큰 검증 미들웨어
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Authorization header with Bearer token is required'
      });
    }

    // 토큰 검증
    const tokenResult = TokenService.verifyToken(token);
    
    if (!tokenResult.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Invalid access token'
      });
    }

    // 토큰이 블랙리스트에 있는지 확인
    const isBlacklisted = await TokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: 'Token blacklisted',
        message: 'Access token has been revoked'
      });
    }

    // 세션 검증
    const sessionResult = await SessionService.validateSession(token);
    if (!sessionResult.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session',
        message: sessionResult.reason
      });
    }

    req.user = sessionResult.user;
    req.sessionToken = token;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * 역할 기반 권한 검증 미들웨어
 */
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * KYC 상태 검증 미들웨어
 */
const requireKYC = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'User authentication required'
    });
  }

  if (req.user.kycStatus !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      error: 'KYC required',
      message: 'KYC verification is required for this operation'
    });
  }

  next();
};

/**
 * 소유권 검증 미들웨어 (부동산 소유자만 접근)
 */
const authorizePropertyOwner = async (req, res, next) => {
  try {
    const propertyId = req.params.id || req.params.propertyId;
    
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Property ID required',
        message: 'Property ID is required'
      });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
        message: 'Property does not exist'
      });
    }

    if (property.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only access your own properties'
      });
    }

    req.property = property;
    next();
  } catch (error) {
    logger.error('Property ownership verification failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Authorization failed',
      message: 'Internal server error during authorization'
    });
  }
};

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
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
      });

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // 토큰이 유효하지 않아도 계속 진행 (선택적 인증)
    next();
  }
};

module.exports = {
  authenticateToken,
  authorizeRole,
  requireKYC,
  authorizePropertyOwner,
  optionalAuth
}; 