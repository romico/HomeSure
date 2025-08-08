const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Redis 연결 초기화
   */
  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false,
        maxLoadingTimeout: 10000,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false,
        maxLoadingTimeout: 10000,
      });

      // 이벤트 리스너 설정
      this.client.on('connect', () => {
        logger.info('🔗 Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis client ready');
      });

      this.client.on('error', error => {
        logger.error('❌ Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('🔌 Redis client connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('🔄 Redis client reconnecting...');
      });

      // 연결 테스트
      await this.client.ping();

      logger.info('✅ Redis connection established successfully');
      return true;
    } catch (error) {
      logger.error('❌ Redis initialization failed:', error);
      throw error;
    }
  }

  /**
   * 연결 상태 확인
   */
  async healthCheck() {
    try {
      if (!this.client || !this.isConnected) {
        return { status: 'disconnected', message: 'Redis client not connected' };
      }

      const startTime = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 연결 해제
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('✅ Redis connection closed');
      }
    } catch (error) {
      logger.error('Failed to disconnect Redis:', error);
    }
  }

  /**
   * 클라이언트 인스턴스 반환
   */
  getClient() {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * 연결 상태 반환
   */
  isReady() {
    return this.isConnected && this.client;
  }
}

// 싱글톤 인스턴스
const redisConfig = new RedisConfig();

module.exports = redisConfig;
