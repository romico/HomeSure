import { create } from 'ipfs-http-client';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0
  };
  private maxSize = 1000; // 최대 캐시 항목 수
  private defaultTTL = 5 * 60 * 1000; // 5분

  /**
   * 캐시에 데이터 저장
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    // 캐시 크기 제한 확인
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(key, item);
    this.stats.size = this.cache.size;
    this.updateHitRate();
  }

  /**
   * 캐시에서 데이터 조회
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // TTL 확인
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return item.data;
  }

  /**
   * 캐시에서 데이터 삭제
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
      this.updateHitRate();
    }
    return deleted;
  }

  /**
   * 캐시 전체 삭제
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.updateHitRate();
  }

  /**
   * 캐시에 키가 존재하는지 확인
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // TTL 확인
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 캐시 크기 반환
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 통계 반환
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 가장 오래된 항목 제거
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((item, key) => {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 만료된 항목들 정리
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    this.stats.size = this.cache.size;
    this.updateHitRate();
  }

  /**
   * 히트율 업데이트
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 캐시 키 생성 (API 요청용)
   */
  generateKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramString}`;
  }

  /**
   * 캐시된 API 요청 실행
   */
  async cachedRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // 캐시에서 먼저 확인
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 캐시에 없으면 요청 실행
    try {
      const data = await requestFn();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error('Cached request failed:', error);
      throw error;
    }
  }

  /**
   * 캐시 무효화 (패턴 매칭)
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    this.stats.size = this.cache.size;
    this.updateHitRate();
  }

  /**
   * 캐시 항목 갱신
   */
  refresh(key: string, ttl: number = this.defaultTTL): void {
    const item = this.cache.get(key);
    if (item) {
      item.timestamp = Date.now();
      item.ttl = ttl;
    }
  }

  /**
   * 캐시 항목 정보 조회
   */
  getInfo(key: string): { exists: boolean; age: number; ttl: number } | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const age = Date.now() - item.timestamp;
    return {
      exists: true,
      age,
      ttl: item.ttl
    };
  }
}

// 전역 캐시 인스턴스
export const cacheService = new CacheService();

// 주기적으로 만료된 항목 정리
setInterval(() => {
  cacheService.cleanup();
}, 60000); // 1분마다

// 개발 환경에서 캐시 통계 로깅
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = cacheService.getStats();
    if (stats.size > 0) {
      console.log('Cache Stats:', stats);
    }
  }, 300000); // 5분마다
}

export default cacheService; 