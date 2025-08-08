const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * 기본 보안 헤더 설정
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * 요청 속도 제한 (Rate Limiting)
 */
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Rate limit exceeded',
      message: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    keyGenerator: (req) => {
      // 사용자 ID가 있으면 사용자별 제한, 없으면 IP별 제한
      return req.user ? req.user.id : req.ip;
    }
  });
};

/**
 * 로그인 시도 제한
 */
const loginRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15분
  5, // 최대 5회
  'Too many login attempts. Please try again later.'
);

/**
 * API 요청 제한
 */
const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15분
  100, // 최대 100회
  'Too many API requests. Please try again later.'
);

/**
 * 블록체인 요청 제한
 */
const blockchainRateLimiter = createRateLimiter(
  60 * 1000, // 1분
  10, // 최대 10회
  'Too many blockchain requests. Please try again later.'
);

/**
 * 요청 속도 감소 (Slow Down)
 */
const createSlowDown = (windowMs = 15 * 60 * 1000, delayAfter = 50, delayMs = 500) => {
  return slowDown({
    windowMs,
    delayAfter,
    delayMs: () => delayMs,
    keyGenerator: (req) => {
      // IPv6 주소 처리를 위해 ipKeyGenerator 사용
      const { ipKeyGenerator } = require('express-rate-limit');
      return req.user ? req.user.id : ipKeyGenerator(req);
    },
    validate: { delayMs: false }
  });
};

/**
 * API 요청 속도 감소
 */
const apiSlowDown = createSlowDown(
  15 * 60 * 1000, // 15분
  50, // 50회 후
  500 // 500ms 지연
);

/**
 * 블록체인 요청 속도 감소
 */
const blockchainSlowDown = createSlowDown(
  60 * 1000, // 1분
  5, // 5회 후
  1000 // 1초 지연
);

/**
 * IP 화이트리스트/블랙리스트 체크
 */
const ipFilter = (whitelist = [], blacklist = []) => {
  return (req, res, next) => {
    const clientIP = req.ip;
    
    // 블랙리스트 체크
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      logger.warn(`Blocked request from blacklisted IP: ${clientIP}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Your IP address is not allowed to access this service'
      });
    }
    
    // 화이트리스트 체크
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      logger.warn(`Blocked request from non-whitelisted IP: ${clientIP}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Your IP address is not allowed to access this service'
      });
    }
    
    next();
  };
};

/**
 * 요청 크기 제한
 */
const requestSizeLimit = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const limitBytes = parseSizeLimit(limit);
    
    if (contentLength > limitBytes) {
      logger.warn(`Request too large: ${contentLength} bytes from IP: ${req.ip}`);
      return res.status(413).json({
        success: false,
        error: 'Request too large',
        message: `Request size exceeds the limit of ${limit}`
      });
    }
    
    next();
  };
};

/**
 * 크기 제한 파싱
 */
const parseSizeLimit = (limit) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = limit.toLowerCase().match(/^(\d+)([kmg]?b)$/);
  if (!match) {
    return 10 * 1024 * 1024; // 기본값 10MB
  }
  
  const size = parseInt(match[1]);
  const unit = match[2] || 'b';
  
  return size * units[unit];
};

/**
 * SQL 인젝션 방지
 */
const sqlInjectionProtection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
    /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i,
    /(\b(and|or)\b\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
    /(--|\/\*|\*\/|;)/,
    /(\b(xp_|sp_)\w+)/i
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  const checkObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (checkValue(obj[key])) {
          return true;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkObject(obj[key])) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  // 요청 본문, 쿼리, 파라미터 체크
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    logger.warn(`Potential SQL injection attempt from IP: ${req.ip}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid input',
      message: 'Request contains potentially malicious content'
    });
  }
  
  next();
};

/**
 * XSS 방지
 */
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  const checkObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (checkValue(obj[key])) {
          return true;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkObject(obj[key])) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  // 요청 본문, 쿼리, 파라미터 체크
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    logger.warn(`Potential XSS attempt from IP: ${req.ip}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid input',
      message: 'Request contains potentially malicious content'
    });
  }
  
  next();
};

/**
 * 요청 로깅
 */
const requestLogging = (req, res, next) => {
  const startTime = Date.now();
  
  // 응답 완료 후 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous'
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error:', logData);
    } else {
      logger.info('Request completed:', logData);
    }
  });
  
  next();
};

/**
 * 보안 헤더 추가
 */
const additionalSecurityHeaders = (req, res, next) => {
  // 추가 보안 헤더
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // 서버 정보 숨김
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * 요청 검증
 */
const requestValidation = (req, res, next) => {
  // Content-Type 검증
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
        message: 'Content-Type must be application/json'
      });
    }
  }
  
  // Accept 헤더 검증
  const accept = req.get('Accept');
  if (accept && !accept.includes('application/json')) {
    return res.status(406).json({
      success: false,
      error: 'Not acceptable',
      message: 'Only JSON responses are supported'
    });
  }
  
  next();
};

module.exports = {
  securityHeaders,
  loginRateLimiter,
  apiRateLimiter,
  blockchainRateLimiter,
  apiSlowDown,
  blockchainSlowDown,
  ipFilter,
  requestSizeLimit,
  sqlInjectionProtection,
  xssProtection,
  requestLogging,
  additionalSecurityHeaders,
  requestValidation
}; 