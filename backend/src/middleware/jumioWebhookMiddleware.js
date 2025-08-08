const crypto = require('crypto');
const redis = require('redis');
const { promisify } = require('util');
const logger = require('../utils/logger');

// Redis 클라이언트 설정
const redisClient = redis.createClient(process.env.REDIS_URL || 'redis://localhost:6379');

// Redis 클라이언트가 준비될 때까지 대기
redisClient.on('error', (err) => {
  logger.error('Redis 연결 오류:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis 클라이언트 연결됨');
});

// promisify 함수들이 정의되기 전에 Redis 클라이언트가 준비되었는지 확인
let setexAsync, getAsync;

// Redis 클라이언트 메서드가 존재하는지 확인
if (redisClient.setex && typeof redisClient.setex === 'function') {
  setexAsync = promisify(redisClient.setex).bind(redisClient);
} else {
  setexAsync = async () => { throw new Error('Redis setex not available'); };
}

if (redisClient.get && typeof redisClient.get === 'function') {
  getAsync = promisify(redisClient.get).bind(redisClient);
} else {
  getAsync = async () => { throw new Error('Redis get not available'); };
}

/**
 * Jumio 웹훅 서명 검증 미들웨어
 */
function verifyJumioWebhookSignature(req, res, next) {
  const signature = req.headers['x-jumio-signature'];
  const timestamp = req.headers['x-jumio-timestamp'];
  const webhookId = req.headers['x-jumio-webhook-id'];
  
  if (!signature || !timestamp || !webhookId) {
    logger.warn('Jumio 웹훅 헤더 누락', {
      signature: !!signature,
      timestamp: !!timestamp,
      webhookId: !!webhookId
    });
    return res.status(401).json({ 
      success: false,
      error: {
        code: 'MISSING_HEADERS',
        message: '필수 웹훅 헤더가 누락되었습니다.'
      }
    });
  }
  
  // 타임스탬프 검증 (5분 이내)
  const currentTime = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp, 10);
  
  if (isNaN(webhookTime) || Math.abs(currentTime - webhookTime) > 300) {
    logger.warn('Jumio 웹훅 타임스탬프 만료 또는 유효하지 않음', {
      webhookTime,
      currentTime,
      difference: Math.abs(currentTime - webhookTime)
    });
    return res.status(401).json({ 
      success: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: '웹훅 타임스탬프가 유효하지 않습니다.'
      }
    });
  }
  
  // 서명 검증
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.JUMIO_WEBHOOK_SECRET)
    .update(`${webhookId}.${timestamp}.${payload}`)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    logger.warn('Jumio 웹훅 서명 불일치', {
      receivedSignature: signature,
      expectedSignature,
      webhookId
    });
    return res.status(401).json({ 
      success: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: '웹훅 서명이 유효하지 않습니다.'
      }
    });
  }
  
  logger.info('Jumio 웹훅 서명 검증 성공', { webhookId });
  next();
}

/**
 * 웹훅 멱등성 보장 미들웨어
 */
async function ensureIdempotency(req, res, next) {
  const webhookId = req.headers['x-jumio-webhook-id'];
  
  if (!webhookId) {
    return next();
  }
  
  try {
    const idempotencyKey = `jumio_webhook:${webhookId}`;
    const processed = await getAsync(idempotencyKey);
    
    if (processed) {
      logger.info(`중복 Jumio 웹훅 감지: ${webhookId}`);
      return res.status(200).json({ 
        success: true,
        message: '웹훅이 이미 처리되었습니다.',
        webhookId
      });
    }
    
    // 웹훅 ID 기록 (24시간 유지)
    await setexAsync(idempotencyKey, 86400, 'processed');
    logger.info(`Jumio 웹훅 멱등성 키 설정: ${webhookId}`);
    
    next();
  } catch (error) {
    logger.error('웹훅 멱등성 검사 중 오류 발생:', error.message);
    // Redis 오류가 발생해도 웹훅 처리는 계속 진행
    next();
  }
}

/**
 * 웹훅 요청 로깅 미들웨어
 */
function logWebhookRequest(req, res, next) {
  const webhookId = req.headers['x-jumio-webhook-id'];
  const timestamp = req.headers['x-jumio-timestamp'];
  
  logger.info('Jumio 웹훅 요청 수신', {
    webhookId,
    timestamp,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });
  
  next();
}

/**
 * 웹훅 응답 로깅 미들웨어
 */
function logWebhookResponse(req, res, next) {
  const originalSend = res.send;
  const webhookId = req.headers['x-jumio-webhook-id'];
  
  res.send = function(data) {
    logger.info('Jumio 웹훅 응답 전송', {
      webhookId,
      statusCode: res.statusCode,
      responseSize: data ? data.length : 0
    });
    
    originalSend.call(this, data);
  };
  
  next();
}

/**
 * 웹훅 오류 처리 미들웨어
 */
function handleWebhookError(err, req, res, next) {
  const webhookId = req.headers['x-jumio-webhook-id'];
  
  logger.error('Jumio 웹훅 처리 중 오류 발생:', {
    webhookId,
    error: err.message,
    stack: err.stack
  });
  
  // 웹훅 처리 실패 시에도 200 응답 (Jumio가 재시도하지 않도록)
  res.status(200).json({
    success: false,
    error: {
      code: 'WEBHOOK_PROCESSING_ERROR',
      message: '웹훅 처리 중 오류가 발생했습니다.'
    },
    webhookId
  });
}

/**
 * 웹훅 미들웨어 체인 설정
 */
function setupWebhookMiddleware(app) {
  // 웹훅 라우트에 미들웨어 적용
  app.use('/api/kyc/callback', logWebhookRequest);
  app.use('/api/kyc/callback', verifyJumioWebhookSignature);
  app.use('/api/kyc/callback', ensureIdempotency);
  app.use('/api/kyc/callback', logWebhookResponse);
  app.use('/api/kyc/callback', handleWebhookError);
}

module.exports = {
  verifyJumioWebhookSignature,
  ensureIdempotency,
  logWebhookRequest,
  logWebhookResponse,
  handleWebhookError,
  setupWebhookMiddleware
}; 