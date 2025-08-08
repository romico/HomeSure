const axios = require('axios');
const CircuitBreaker = require('opossum');
const JumioTokenManager = require('./jumioTokenManager');
const logger = require('../utils/logger');

class JumioApiError extends Error {
  constructor(message, statusCode, errorCode, requestId) {
    super(message);
    this.name = 'JumioApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.requestId = requestId;
  }
}

class JumioApiClient {
  constructor() {
    this.tokenManager = new JumioTokenManager();
    this.jumioBaseUrl = process.env.JUMIO_BASE_URL || 'https://api.jumio.com';
    
    // 서킷 브레이커 설정
    const breakerOptions = {
      timeout: 15000, // 15초 타임아웃
      errorThresholdPercentage: 50, // 50% 오류 발생 시 서킷 오픈
      resetTimeout: 30000, // 30초 후 하프 오픈 상태로 전환
      rollingCountTimeout: 60000, // 1분 동안의 통계 유지
      rollingCountBuckets: 10 // 6초 단위로 통계 수집
    };
    
    // API 엔드포인트별 서킷 브레이커 생성
    this.breakers = {
      initiate: new CircuitBreaker(
        (data) => this.callApi('/api/netverify/v2/initiate', 'POST', data),
        breakerOptions
      ),
      retrieveScan: new CircuitBreaker(
        (scanId) => this.callApi(`/api/netverify/v2/scans/${scanId}`, 'GET'),
        breakerOptions
      ),
      retrieveDocument: new CircuitBreaker(
        (scanId) => this.callApi(`/api/netverify/v2/scans/${scanId}/data`, 'GET'),
        breakerOptions
      )
    };
    
    // 서킷 브레이커 이벤트 리스너
    this.setupCircuitBreakerListeners();
  }

  /**
   * 서킷 브레이커 이벤트 리스너 설정
   */
  setupCircuitBreakerListeners() {
    Object.entries(this.breakers).forEach(([name, breaker]) => {
      breaker.on('open', () => {
        logger.warn(`Jumio API 서킷 브레이커가 열렸습니다: ${name} - API 호출 중단`);
        this.notifyCriticalError(new Error(`Jumio API 서킷 브레이커 열림: ${name}`), { 
          service: 'kyc-service',
          endpoint: name 
        });
      });
      
      breaker.on('halfOpen', () => {
        logger.info(`Jumio API 서킷 브레이커가 반열림 상태입니다: ${name} - 테스트 호출 시도`);
      });
      
      breaker.on('close', () => {
        logger.info(`Jumio API 서킷 브레이커가 닫혔습니다: ${name} - 정상 작동 중`);
      });
    });
  }

  /**
   * Jumio API 호출 (기본 함수)
   */
  async callApi(endpoint, method, data = null) {
    try {
      const accessToken = await this.tokenManager.getToken();
      const url = `${this.jumioBaseUrl}${endpoint}`;
      
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'HomeSure-KYC/1.0'
        },
        timeout: 15000,
        ...(data && { data })
      };
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.handleApiError(error, endpoint);
    }
  }

  /**
   * API 오류 처리
   */
  handleApiError(error, endpoint) {
    if (error.response) {
      // API 응답 오류
      const { status, data } = error.response;
      const errorCode = data.errorCode || 'UNKNOWN';
      const requestId = error.response.headers['x-request-id'] || 'UNKNOWN';
      const message = data.message || '알 수 없는 Jumio API 오류';
      
      logger.error(`Jumio API 오류: ${status} ${errorCode} - ${message}`, {
        endpoint,
        requestId,
        statusCode: status,
        errorCode,
        errorDetails: data
      });
      
      throw new JumioApiError(message, status, errorCode, requestId);
    } else if (error.request) {
      // 요청은 전송되었으나 응답이 없음
      logger.error('Jumio API 응답 없음', { endpoint });
      throw new Error('Jumio API 서버에서 응답이 없습니다');
    } else {
      // 요청 설정 중 오류
      logger.error('Jumio API 요청 설정 오류', { endpoint, error: error.message });
      throw new Error(`Jumio API 요청 오류: ${error.message}`);
    }
  }

  /**
   * 지수 백오프 재시도 메커니즘
   */
  async callApiWithRetry(endpoint, method, data = null, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      factor = 2,
      retryableStatusCodes = [408, 429, 500, 502, 503, 504]
    } = options;
    
    let retries = 0;
    let delay = initialDelay;
    
    while (true) {
      try {
        return await this.callApi(endpoint, method, data);
      } catch (error) {
        // 재시도 가능한 오류인지 확인
        const isRetryable = 
          error.response && retryableStatusCodes.includes(error.response.status) ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT' ||
          error.message.includes('network');
        
        // 최대 재시도 횟수 초과 또는 재시도 불가능한 오류
        if (retries >= maxRetries || !isRetryable) {
          throw error;
        }
        
        // 재시도 로깅
        retries++;
        logger.warn(`Jumio API 호출 실패, ${retries}번째 재시도 중...`, {
          endpoint,
          error: error.message,
          statusCode: error.response?.status
        });
        
        // 지수 백오프 지연
        await this.sleep(delay);
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  /**
   * 지연 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * KYC 검증 세션 생성
   */
  async initiateVerification(userData) {
    try {
      return await this.breakers.initiate.fire(userData);
    } catch (error) {
      if (error.type === 'open') {
        // 서킷이 열린 상태
        throw new Error('Jumio API 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  /**
   * 스캔 결과 조회
   */
  async retrieveScanResult(scanId) {
    try {
      return await this.breakers.retrieveScan.fire(scanId);
    } catch (error) {
      if (error.type === 'open') {
        // 서킷이 열린 상태
        throw new Error('Jumio API 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  /**
   * 문서 데이터 조회
   */
  async retrieveDocumentData(scanId) {
    try {
      return await this.breakers.retrieveDocument.fire(scanId);
    } catch (error) {
      if (error.type === 'open') {
        // 서킷이 열린 상태
        throw new Error('Jumio API 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  /**
   * 중요 오류 알림 (실제 구현에서는 Slack, Email 등으로 확장)
   */
  async notifyCriticalError(error, context) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('중요 오류 발생:', {
        error: error.message,
        context,
        timestamp: new Date().toISOString()
      });
      
      // TODO: Slack, Email 등으로 알림 전송 구현
      // await this.sendSlackNotification(error, context);
    }
  }

  /**
   * 서킷 브레이커 상태 조회
   */
  getCircuitBreakerStatus() {
    const status = {};
    Object.entries(this.breakers).forEach(([name, breaker]) => {
      status[name] = {
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
        stats: breaker.stats
      };
    });
    return status;
  }

  /**
   * 토큰 상태 조회
   */
  getTokenStatus() {
    return this.tokenManager.getTokenStatus();
  }
}

module.exports = { JumioApiClient, JumioApiError }; 