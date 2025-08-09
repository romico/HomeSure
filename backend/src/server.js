const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 환경별 설정 파일 로드
const env = process.env.NODE_ENV || 'development';
require('dotenv').config({
  path: path.resolve(process.cwd(), `.env.${env}`),
});
// 기본 .env 파일도 로드 (우선순위 낮음)
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const database = require('./config/database');
const blockchainConfig = require('./config/blockchain');
const cacheService = require('./services/cacheService');
const WebSocketService = require('./services/websocketService');
const { setupWebhookMiddleware } = require('./middleware/jumioWebhookMiddleware');

// Import routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const transactionRoutes = require('./routes/transactions');
const portfolioRoutes = require('./routes/portfolio');
const kycRoutes = require('./routes/kyc');
const whitelistRoutes = require('./routes/whitelist');
const amlRoutes = require('./routes/aml');
const blockchainRoutes = require('./routes/blockchain');
const cacheRoutes = require('./routes/cache');
const adminRoutes = require('./routes/admin');
const dbtestRoutes = require('./routes/dbtest');
const tradingRoutes = require('./routes/trading');
const gdprRoutes = require('./routes/gdpr');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
const {
  securityHeaders,
  apiRateLimiter,
  apiSlowDown,
  requestSizeLimit,
  sqlInjectionProtection,
  xssProtection,
  requestLogging,
  additionalSecurityHeaders,
  requestValidation,
} = require('./middleware/security');

// CORS must be applied before any validators/rate-limiters so that preflight succeeds
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};
app.use(cors(corsOptions));
// Explicitly handle preflight
app.options('*', cors(corsOptions));

// Apply security & validation after CORS
app.use(securityHeaders);
app.use(additionalSecurityHeaders);
app.use(requestLogging);
app.use(requestValidation);
app.use(requestSizeLimit('10mb'));
app.use(sqlInjectionProtection);
app.use(xssProtection);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
app.use('/api/', apiRateLimiter);
app.use('/api/', apiSlowDown);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: message => logger.info(message.trim()),
      },
    })
  );
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();

    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: dbHealth,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// 웹훅 미들웨어 설정
setupWebhookMiddleware(app);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/aml', amlRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/dbtest', dbtestRoutes);

// WebSocket 통계 엔드포인트
app.get('/api/websocket/stats', (req, res) => {
  if (global.webSocketService) {
    res.json(global.webSocketService.getStats());
  } else {
    res.json({
      status: 'disabled',
      message: 'WebSocket service is not available',
      totalClients: 0,
      priceSubscriptions: 0,
      portfolioSubscriptions: 0,
      transactionSubscriptions: 0,
      priceDataCount: 0,
      portfolioDataCount: 0,
      transactionDataCount: 0,
    });
  }
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'HomeSure API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      transactions: '/api/transactions',
      portfolio: '/api/portfolio',
      kyc: '/api/kyc',
      whitelist: '/api/whitelist',
      aml: '/api/aml',
      blockchain: '/api/blockchain',
      cache: '/api/cache',
      admin: '/api/admin',
    },
    documentation: '/api/docs',
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database (optional in development)
    const disableDb = process.env.DISABLE_DB === '1' || process.env.DISABLE_DB === 'true';
    if (!disableDb) {
      await database.connect();
    } else {
      logger.warn('🟡 Database connection disabled by DISABLE_DB flag');
    }

    // Initialize cache service
    try {
      await cacheService.initialize();
      logger.info('✅ Cache service initialized');
    } catch (error) {
      logger.warn('⚠️ Cache service failed, continuing without caching features');
      logger.warn('Make sure REDIS_URL is set in environment variables');
    }

    // Initialize blockchain connection
    try {
      await blockchainConfig.initialize();
      blockchainConfig.setupEventListeners();
      logger.info('✅ Blockchain connection initialized');
    } catch (error) {
      logger.warn('🟡 Blockchain disabled in development or missing credentials');
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 HomeSure API Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 API docs: http://localhost:${PORT}/api`);
    });

    // Initialize WebSocket service
    try {
      const webSocketService = new WebSocketService(server);
      global.webSocketService = webSocketService; // 전역 변수로 저장
      logger.info('✅ WebSocket service initialized');
    } catch (error) {
      logger.warn('⚠️ WebSocket service failed, continuing without real-time features');
      logger.warn('Make sure ws package is installed');
      global.webSocketService = null;
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.disconnect();
  await cacheService.disconnect();
  await blockchainConfig.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await database.disconnect();
  await cacheService.disconnect();
  await blockchainConfig.disconnect();
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

module.exports = app;
