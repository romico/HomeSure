const axios = require('axios');
const logger = require('../utils/logger');

class JumioTokenManager {
  constructor() {
    this.tokenCache = null;
    this.tokenExpiry = null;
    this.refreshMargin = 10 * 60 * 1000; // 토큰 만료 10분 전에 갱신
    this.jumioBaseUrl = process.env.JUMIO_BASE_URL || 'https://api.jumio.com';
    this.jumioApiKey = process.env.JUMIO_API_KEY;
    this.jumioApiSecret = process.env.JUMIO_API_SECRET;
    
    // 환경 변수 검증
    this.validateEnvironmentVariables();
  }

  /**
   * 필수 환경 변수 검증
   */
  validateEnvironmentVariables() {
    const requiredVars = ['JUMIO_API_KEY', 'JUMIO_API_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`필수 Jumio 환경 변수가 누락되었습니다: ${missingVars.join(', ')}`);
    }
  }

  /**
   * Jumio OAuth 2.0 액세스 토큰 획득
   */
  async getJumioAccessToken() {
    try {
      const tokenResponse = await axios.post(
        `${this.jumioBaseUrl}/oauth2/token`,
        new URLSearchParams({
          'grant_type': 'client_credentials'
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.jumioApiKey}:${this.jumioApiSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000 // 10초 타임아웃
        }
      );
      
      return {
        accessToken: tokenResponse.data.access_token,
        expiresIn: tokenResponse.data.expires_in,
        tokenType: tokenResponse.data.token_type
      };
    } catch (error) {
      logger.error('Jumio 액세스 토큰 획득 실패:', error.message);
      throw new Error(`Jumio 인증 실패: ${error.message}`);
    }
  }

  /**
   * 유효한 토큰 반환 (캐시된 토큰이 있으면 사용, 없으면 새로 발급)
   */
  async getToken() {
    const now = Date.now();
    
    // 토큰이 없거나 만료 예정인 경우 새로 발급
    if (!this.tokenCache || !this.tokenExpiry || now > this.tokenExpiry - this.refreshMargin) {
      const tokenData = await this.getJumioAccessToken();
      this.tokenCache = tokenData.accessToken;
      // 토큰 만료 시간 설정 (현재 시간 + 만료 시간(초) - 안전 마진)
      this.tokenExpiry = now + (tokenData.expiresIn * 1000);
      logger.info('Jumio 액세스 토큰 갱신됨');
    }
    
    return this.tokenCache;
  }

  /**
   * 토큰 캐시 무효화 (강제 갱신)
   */
  invalidateToken() {
    this.tokenCache = null;
    this.tokenExpiry = null;
    logger.info('Jumio 토큰 캐시 무효화됨');
  }

  /**
   * 토큰 상태 확인
   */
  getTokenStatus() {
    const now = Date.now();
    return {
      hasToken: !!this.tokenCache,
      isExpired: this.tokenExpiry ? now > this.tokenExpiry : true,
      expiresAt: this.tokenExpiry ? new Date(this.tokenExpiry) : null,
      timeUntilExpiry: this.tokenExpiry ? this.tokenExpiry - now : 0
    };
  }
}

module.exports = JumioTokenManager; 