const redisConfig = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.defaultTTL = 3600; // 1시간 (초 단위)
    this.prefix = 'homesure:';
  }

  /**
   * Redis 클라이언트 초기화
   */
  async initialize() {
    try {
      await redisConfig.initialize();
      this.client = redisConfig.getClient();
      logger.info('✅ Cache service initialized');
    } catch (error) {
      logger.error('Failed to initialize cache service:', error);
      throw error;
    }
  }

  /**
   * 키 생성 (prefix 포함)
   */
  _generateKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * 데이터 설정
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }

      logger.debug(`Cache set: ${fullKey} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error('Failed to set cache:', error);
      return false;
    }
  }

  /**
   * 데이터 조회
   */
  async get(key) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        logger.debug(`Cache miss: ${fullKey}`);
        return null;
      }

      logger.debug(`Cache hit: ${fullKey}`);
      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to get cache:', error);
      return null;
    }
  }

  /**
   * 데이터 삭제
   */
  async delete(key) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const result = await this.client.del(fullKey);
      
      logger.debug(`Cache delete: ${fullKey} (result: ${result})`);
      return result > 0;
    } catch (error) {
      logger.error('Failed to delete cache:', error);
      return false;
    }
  }

  /**
   * 패턴으로 데이터 삭제
   */
  async deletePattern(pattern) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullPattern = this._generateKey(pattern);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length > 0) {
        const result = await this.client.del(...keys);
        logger.debug(`Cache delete pattern: ${fullPattern} (deleted: ${result} keys)`);
        return result;
      }
      
      return 0;
    } catch (error) {
      logger.error('Failed to delete cache pattern:', error);
      return 0;
    }
  }

  /**
   * TTL 조회
   */
  async getTTL(key) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const ttl = await this.client.ttl(fullKey);
      
      return ttl;
    } catch (error) {
      logger.error('Failed to get TTL:', error);
      return -1;
    }
  }

  /**
   * TTL 설정
   */
  async setTTL(key, ttl) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const result = await this.client.expire(fullKey, ttl);
      
      logger.debug(`Cache TTL set: ${fullKey} (TTL: ${ttl}s, result: ${result})`);
      return result;
    } catch (error) {
      logger.error('Failed to set TTL:', error);
      return false;
    }
  }

  /**
   * 데이터 존재 여부 확인
   */
  async exists(key) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const result = await this.client.exists(fullKey);
      
      return result > 0;
    } catch (error) {
      logger.error('Failed to check cache exists:', error);
      return false;
    }
  }

  /**
   * 해시 설정
   */
  async hset(key, field, value, ttl = this.defaultTTL) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const serializedValue = JSON.stringify(value);
      
      await this.client.hset(fullKey, field, serializedValue);
      
      if (ttl > 0) {
        await this.client.expire(fullKey, ttl);
      }

      logger.debug(`Cache hset: ${fullKey}.${field} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error('Failed to hset cache:', error);
      return false;
    }
  }

  /**
   * 해시 조회
   */
  async hget(key, field) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const value = await this.client.hget(fullKey, field);
      
      if (value === null) {
        logger.debug(`Cache hget miss: ${fullKey}.${field}`);
        return null;
      }

      logger.debug(`Cache hget hit: ${fullKey}.${field}`);
      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to hget cache:', error);
      return null;
    }
  }

  /**
   * 해시 전체 조회
   */
  async hgetall(key) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const hash = await this.client.hgetall(fullKey);
      
      if (!hash || Object.keys(hash).length === 0) {
        logger.debug(`Cache hgetall miss: ${fullKey}`);
        return null;
      }

      // 모든 값을 JSON 파싱
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }

      logger.debug(`Cache hgetall hit: ${fullKey}`);
      return result;
    } catch (error) {
      logger.error('Failed to hgetall cache:', error);
      return null;
    }
  }

  /**
   * 해시 필드 삭제
   */
  async hdel(key, field) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const result = await this.client.hdel(fullKey, field);
      
      logger.debug(`Cache hdel: ${fullKey}.${field} (result: ${result})`);
      return result > 0;
    } catch (error) {
      logger.error('Failed to hdel cache:', error);
      return false;
    }
  }

  /**
   * 리스트에 데이터 추가
   */
  async lpush(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const serializedValue = JSON.stringify(value);
      
      await this.client.lpush(fullKey, serializedValue);
      
      if (ttl > 0) {
        await this.client.expire(fullKey, ttl);
      }

      logger.debug(`Cache lpush: ${fullKey} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error('Failed to lpush cache:', error);
      return false;
    }
  }

  /**
   * 리스트에서 데이터 조회
   */
  async lrange(key, start = 0, stop = -1) {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const fullKey = this._generateKey(key);
      const values = await this.client.lrange(fullKey, start, stop);
      
      if (!values || values.length === 0) {
        logger.debug(`Cache lrange miss: ${fullKey}`);
        return [];
      }

      const result = values.map(value => {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });

      logger.debug(`Cache lrange hit: ${fullKey} (count: ${result.length})`);
      return result;
    } catch (error) {
      logger.error('Failed to lrange cache:', error);
      return [];
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getStats() {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const info = await this.client.info();
      const keys = await this.client.keys(`${this.prefix}*`);
      
      return {
        connected: redisConfig.isReady(),
        totalKeys: keys.length,
        info: info
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        connected: false,
        totalKeys: 0,
        error: error.message
      };
    }
  }

  /**
   * 캐시 초기화 (모든 키 삭제)
   */
  async flush() {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const keys = await this.client.keys(`${this.prefix}*`);
      
      if (keys.length > 0) {
        const result = await this.client.del(...keys);
        logger.info(`Cache flushed: ${result} keys deleted`);
        return result;
      }
      
      return 0;
    } catch (error) {
      logger.error('Failed to flush cache:', error);
      return 0;
    }
  }

  /**
   * 연결 해제
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('✅ Cache service disconnected');
      }
    } catch (error) {
      logger.error('Failed to disconnect cache service:', error);
    }
  }

  /**
   * 캐시 래퍼 함수 (get-or-set 패턴)
   */
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    try {
      // 캐시에서 조회 시도
      let data = await this.get(key);
      
      if (data !== null) {
        return data;
      }

      // 캐시에 없으면 함수 실행
      data = await fetchFunction();
      
      // 결과를 캐시에 저장
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }

      return data;
    } catch (error) {
      logger.error('Failed to getOrSet cache:', error);
      // 캐시 실패 시에도 함수 실행
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.error('Fetch function also failed:', fetchError);
        throw fetchError;
      }
    }
  }
}

// 싱글톤 인스턴스
const cacheService = new CacheService();

module.exports = cacheService; 