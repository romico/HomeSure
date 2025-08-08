const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

/**
 * 캐시 미들웨어 - GET 요청에 대한 캐싱
 */
const cacheMiddleware = (ttl = 3600, keyGenerator = null) => {
  return async (req, res, next) => {
    // GET 요청만 캐싱
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // 캐시 키 생성
      const cacheKey = keyGenerator ? keyGenerator(req) : generateCacheKey(req);
      
      // 캐시에서 데이터 조회
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData !== null) {
        logger.debug(`Cache hit for: ${req.originalUrl}`);
        
        // 캐시된 응답 헤더 설정
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }

      // 캐시 미스 - 원본 응답을 캐시하도록 설정
      logger.debug(`Cache miss for: ${req.originalUrl}`);
      
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
      
      // 원본 응답을 캐시하도록 응답 객체 수정
      const originalJson = res.json;
      res.json = function(data) {
        // 성공적인 응답만 캐시
        if (res.statusCode === 200 && data) {
          cacheService.set(cacheKey, data, ttl).catch(error => {
            logger.error('Failed to cache response:', error);
          });
        }
        
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // 캐시 실패 시에도 요청 계속 진행
    }
  };
};

/**
 * 캐시 무효화 미들웨어
 */
const invalidateCache = (pattern = null) => {
  return async (req, res, next) => {
    try {
      const invalidatePattern = pattern || generateInvalidatePattern(req);
      
      if (invalidatePattern) {
        await cacheService.deletePattern(invalidatePattern);
        logger.debug(`Cache invalidated for pattern: ${invalidatePattern}`);
      }
      
      next();
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      next(); // 캐시 무효화 실패 시에도 요청 계속 진행
    }
  };
};

/**
 * 캐시 키 생성
 */
const generateCacheKey = (req) => {
  const baseKey = `${req.method}:${req.originalUrl}`;
  const queryString = Object.keys(req.query).length > 0 
    ? `:${JSON.stringify(req.query)}` 
    : '';
  const userKey = req.user ? `:user:${req.user.id}` : '';
  
  return `${baseKey}${queryString}${userKey}`;
};

/**
 * 캐시 무효화 패턴 생성
 */
const generateInvalidatePattern = (req) => {
  // URL 기반 패턴 생성
  const urlParts = req.originalUrl.split('/');
  
  // 예: /api/properties/123 -> properties:*
  if (urlParts.length >= 3) {
    const resource = urlParts[2]; // properties, users, etc.
    return `${resource}:*`;
  }
  
  return null;
};

/**
 * 사용자별 캐시 키 생성
 */
const generateUserCacheKey = (req, baseKey) => {
  const userId = req.user ? req.user.id : 'anonymous';
  return `${baseKey}:user:${userId}`;
};

/**
 * 조건부 캐싱 미들웨어
 */
const conditionalCache = (condition, ttl = 3600) => {
  return async (req, res, next) => {
    // 조건 확인
    if (!condition(req)) {
      return next();
    }

    return cacheMiddleware(ttl)(req, res, next);
  };
};

/**
 * 캐시 헤더 설정 미들웨어
 */
const setCacheHeaders = (maxAge = 3600, staleWhileRevalidate = 60) => {
  return (req, res, next) => {
    res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
    res.set('ETag', generateETag(req));
    next();
  };
};

/**
 * ETag 생성
 */
const generateETag = (req) => {
  const content = `${req.originalUrl}:${JSON.stringify(req.query)}:${req.user?.id || 'anonymous'}`;
  const hash = require('crypto').createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
};

/**
 * 캐시 상태 확인 미들웨어
 */
const cacheStatus = async (req, res, next) => {
  try {
    const stats = await cacheService.getStats();
    
    res.json({
      success: true,
      data: {
        connected: stats.connected,
        totalKeys: stats.totalKeys,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Cache status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status',
      message: '캐시 상태 조회 중 오류가 발생했습니다'
    });
  }
};

/**
 * 캐시 플러시 미들웨어
 */
const flushCache = async (req, res, next) => {
  try {
    const deletedCount = await cacheService.flush();
    
    res.json({
      success: true,
      message: '캐시가 성공적으로 초기화되었습니다',
      data: {
        deletedKeys: deletedCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Cache flush error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to flush cache',
      message: '캐시 초기화 중 오류가 발생했습니다'
    });
  }
};

/**
 * 캐시 래퍼 함수 (고급 캐싱)
 */
const cacheWrapper = (key, fetchFunction, ttl = 3600) => {
  return async (req, res, next) => {
    try {
      const cacheKey = typeof key === 'function' ? key(req) : key;
      
      const data = await cacheService.getOrSet(cacheKey, fetchFunction, ttl);
      
      res.json({
        success: true,
        data: data,
        cached: true
      });
    } catch (error) {
      logger.error('Cache wrapper error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch data',
        message: '데이터 조회 중 오류가 발생했습니다'
      });
    }
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  conditionalCache,
  setCacheHeaders,
  cacheStatus,
  flushCache,
  cacheWrapper,
  generateCacheKey,
  generateUserCacheKey
}; 