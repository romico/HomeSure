// Throttle function - 일정 시간 간격으로 함수 실행을 제한
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      // 마지막 호출을 지연시킴
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - (now - lastCall));
    }
  };
}

// Debounce function - 연속된 호출을 그룹화하여 마지막 호출만 실행
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// RequestAnimationFrame을 사용한 최적화된 스크롤 핸들러
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let ticking = false;

  return (...args: Parameters<T>) => {
    if (!ticking) {
      requestAnimationFrame(() => {
        func(...args);
        ticking = false;
      });
      ticking = true;
    }
  };
}

// 메모이제이션 함수
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// 캐시 크기 제한이 있는 메모이제이션
export function memoizeWithLimit<T extends (...args: any[]) => any>(
  func: T,
  limit: number = 100,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  const keys: string[] = [];

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    if (cache.has(key)) {
      // LRU 캐시: 사용된 키를 맨 뒤로 이동
      const keyIndex = keys.indexOf(key);
      if (keyIndex > -1) {
        keys.splice(keyIndex, 1);
        keys.push(key);
      }
      return cache.get(key)!;
    }

    // 캐시 크기 제한 확인
    if (cache.size >= limit) {
      const oldestKey = keys.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    const result = func(...args);
    cache.set(key, result);
    keys.push(key);
    return result;
  }) as T;
}

// 비동기 함수용 메모이제이션
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, Promise<Awaited<ReturnType<T>>>>();

  return ((...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const promise = func(...args);
    cache.set(key, promise);
    return promise;
  }) as T;
}

// 성능 측정 유틸리티
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark: string): number {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);

    if (start === undefined || end === undefined) {
      throw new Error(`Mark not found: ${startMark} or ${endMark}`);
    }

    const duration = end - start;
    
    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }
    this.measures.get(name)!.push(duration);

    return duration;
  }

  getAverageMeasure(name: string): number | null {
    const measures = this.measures.get(name);
    if (!measures || measures.length === 0) {
      return null;
    }

    return measures.reduce((sum, measure) => sum + measure, 0) / measures.length;
  }

  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
}

// 데이터 배치 처리
export function batchProcess<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await processor(batch);
        
        // 다음 배치 전에 짧은 지연 (UI 블로킹 방지)
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// 가상 스크롤링을 위한 데이터 청크 생성
export function createDataChunks<T>(
  data: T[],
  chunkSize: number
): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// 이미지 지연 로딩을 위한 Intersection Observer 래퍼
export function createLazyLoadObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  };

  return new IntersectionObserver(callback, defaultOptions);
}

// DOM 요소의 가시성 모니터링
export function observeVisibility(
  element: Element,
  callback: (isVisible: boolean) => void,
  options: IntersectionObserverInit = {}
): () => void {
  const observer = createLazyLoadObserver((entries) => {
    entries.forEach(entry => {
      callback(entry.isIntersecting);
    });
  }, options);

  observer.observe(element);

  return () => observer.disconnect();
}

// 성능 최적화된 이벤트 리스너
export function addOptimizedEventListener(
  element: EventTarget,
  event: string,
  handler: EventListener,
  options: AddEventListenerOptions & { throttle?: number; debounce?: number } = {}
): () => void {
  const { throttle: throttleDelay, debounce: debounceDelay, ...eventOptions } = options;
  
  let optimizedHandler = handler;
  
  if (throttleDelay) {
    optimizedHandler = throttle(handler, throttleDelay);
  } else if (debounceDelay) {
    optimizedHandler = debounce(handler, debounceDelay);
  }

  element.addEventListener(event, optimizedHandler, eventOptions);

  return () => {
    element.removeEventListener(event, optimizedHandler, eventOptions);
  };
} 