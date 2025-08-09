import api from './api';

export interface KYCFormData {
  userAddress: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  expectedTransactionAmount: number;
  isPEP: boolean;
  isSanctioned: boolean;
  documentHash?: string;
}

export interface KYCStatus {
  isVerified: boolean;
  kycInfo: {
    status: string;
    level: string;
    riskLevel: string;
    verificationDate: string;
    expiryDate: string;
    riskScore: string;
    dailyLimit: string;
    monthlyLimit: string;
  };
}

export interface KYCVerificationResult {
  sessionId: string;
  kycLevel: string;
  status: string;
  estimatedProcessingTime: string;
  riskScore: number;
  riskLevel: string;
}

export interface TransactionRiskAssessment {
  riskScore: string;
  isBlocked: boolean;
  riskLevel: string;
  recommendation: string;
}

class KYCService {
  private baseUrl = '/kyc';

  /**
   * KYC 검증 상태 확인
   */
  async checkKYCStatus(userAddress: string): Promise<KYCStatus> {
    try {
      const response = await api.get(`${this.baseUrl}/status/${userAddress}`);
      return response.data.data;
    } catch (error) {
      console.error('KYC status check failed:', error);
      throw new Error('KYC 상태 확인에 실패했습니다.');
    }
  }

  /**
   * KYC 검증 프로세스 시작
   */
  async initiateKYCVerification(userData: KYCFormData): Promise<KYCVerificationResult> {
    try {
      const response = await api.post(`${this.baseUrl}/initiate`, userData);
      return response.data.data;
    } catch (error) {
      console.error('KYC verification initiation failed:', error);
      throw new Error('KYC 검증 시작에 실패했습니다.');
    }
  }

  /**
   * AML 거래 위험도 검사
   */
  async checkTransactionRisk(
    userAddress: string,
    amount: number
  ): Promise<TransactionRiskAssessment> {
    try {
      const response = await api.post(`${this.baseUrl}/transaction-risk`, {
        userAddress,
        amount,
      });
      return response.data.data;
    } catch (error) {
      console.error('Transaction risk check failed:', error);
      throw new Error('거래 위험도 검사에 실패했습니다.');
    }
  }

  /**
   * KYC 검증 세션 생성 (기존 호환성)
   */
  async createVerificationSession(userData: KYCFormData): Promise<KYCVerificationResult> {
    try {
      const response = await api.post(`${this.baseUrl}/session`, userData);
      return response.data.data;
    } catch (error) {
      console.error('KYC session creation failed:', error);
      throw new Error('KYC 세션 생성에 실패했습니다.');
    }
  }

  /**
   * KYC 검증 상태 확인 (기존 호환성)
   */
  async checkVerificationStatus(
    sessionId: string,
    userAddress?: string
  ): Promise<KYCVerificationResult> {
    try {
      const params = userAddress ? { userAddress } : {};
      const response = await api.get(`${this.baseUrl}/session/${sessionId}`, { params });
      return response.data.data;
    } catch (error) {
      console.error('KYC verification status check failed:', error);
      throw new Error('KYC 검증 상태 확인에 실패했습니다.');
    }
  }

  /**
   * 화이트리스트에 사용자 추가
   */
  async addToWhitelist(userAddress: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`${this.baseUrl}/whitelist/add`, { userAddress });
      return response.data.data;
    } catch (error) {
      console.error('Add to whitelist failed:', error);
      throw new Error('화이트리스트 추가에 실패했습니다.');
    }
  }

  /**
   * 블랙리스트에 사용자 추가
   */
  async addToBlacklist(userAddress: string, reason: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`${this.baseUrl}/blacklist/add`, { userAddress, reason });
      return response.data.data;
    } catch (error) {
      console.error('Add to blacklist failed:', error);
      throw new Error('블랙리스트 추가에 실패했습니다.');
    }
  }

  /**
   * KYC API 상태 확인
   */
  async getApiStatus(): Promise<any> {
    try {
      const response = await api.get(`${this.baseUrl}/api-status`);
      return response.data.data;
    } catch (error) {
      console.error('KYC API status check failed:', error);
      throw new Error('KYC API 상태 확인에 실패했습니다.');
    }
  }

  /**
   * 문서 해시 생성 (실제로는 IPFS에 업로드)
   */
  generateDocumentHash(userAddress: string, documentNumber: string): string {
    const timestamp = Date.now();
    const hash = `Qm${userAddress}${documentNumber}${timestamp}`.replace(/[^a-zA-Z0-9]/g, '');
    return hash.substring(0, 46); // IPFS 해시 길이에 맞춤
  }

  /**
   * 위험도 레벨에 따른 색상 반환
   */
  getRiskLevelColor(riskLevel: string): string {
    switch (riskLevel.toUpperCase()) {
      case 'LOW':
        return 'text-green-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'HIGH':
        return 'text-orange-600';
      case 'CRITICAL':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  /**
   * KYC 레벨에 따른 설명 반환
   */
  getKYCLevelDescription(level: string): string {
    switch (level.toUpperCase()) {
      case 'BASIC':
        return '기본 신원 확인 - 일일 한도 1,000 HSPT';
      case 'ENHANCED':
        return '강화 신원 확인 - 일일 한도 10,000 HSPT';
      case 'PREMIUM':
        return '프리미엄 신원 확인 - 일일 한도 100,000 HSPT';
      default:
        return '알 수 없는 레벨';
    }
  }

  /**
   * 거래 권장사항에 따른 메시지 반환
   */
  getTransactionRecommendationMessage(recommendation: string): string {
    switch (recommendation) {
      case 'APPROVED':
        return '거래가 승인되었습니다.';
      case 'STANDARD_MONITORING':
        return '표준 모니터링이 적용됩니다.';
      case 'ENHANCED_MONITORING':
        return '강화된 모니터링이 적용됩니다.';
      case 'REQUIRE_MANUAL_REVIEW':
        return '수동 검토가 필요합니다.';
      case 'TRANSACTION_BLOCKED':
        return '거래가 차단되었습니다.';
      default:
        return '거래 상태를 확인해주세요.';
    }
  }
}

export const kycService = new KYCService();
