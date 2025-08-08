const { ethers } = require('ethers');
const logger = require('../utils/logger');
const blockchainConfig = require('../config/blockchain');

class KYCService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
    this.kycContract = null;
    this.initializeContract();
  }

  async initializeContract() {
    try {
      const kycAddress = process.env.KYC_VERIFICATION_ADDRESS || '0x0165878A594ca255338adfa4d48449f69242Eb8F';
      const kycABI = [
        'function isKYCVerified(address userAddress) external view returns (bool)',
        'function getKYCInfo(address userAddress) external view returns (tuple(address userAddress, uint8 status, uint8 level, uint8 riskLevel, uint256 verificationDate, uint256 expiryDate, uint256 riskScore, string documentHash, string verificationId, bool isActive, uint256 lastUpdated, address verifiedBy, string rejectionReason, uint256 dailyLimit, uint256 monthlyLimit, uint256 totalLimit))',
        'function verifyKYC(address userAddress, uint8 level, uint8 riskLevel, string memory documentHash, string memory verificationId) external',
        'function rejectKYC(address userAddress, string memory reason) external',
        'function updateRiskScore(address userAddress, uint256 riskScore) external',
        'function addToWhitelist(address userAddress) external',
        'function removeFromWhitelist(address userAddress) external',
        'function addToBlacklist(address userAddress, string memory reason) external',
        'function removeFromBlacklist(address userAddress) external',
        'function checkTransactionRisk(address userAddress, uint256 amount) external view returns (uint256 riskScore, bool isBlocked)',
        'event KYCVerified(address indexed userAddress, uint8 level, uint256 verificationDate, uint256 expiryDate)',
        'event KYCRejected(address indexed userAddress, string reason)',
        'event RiskScoreUpdated(address indexed userAddress, uint256 riskScore)',
        'event UserBlacklisted(address indexed userAddress, string reason)',
        'event UserRemovedFromBlacklist(address indexed userAddress)'
      ];

      this.kycContract = new ethers.Contract(kycAddress, kycABI, this.provider);
      logger.info('✅ KYC Contract initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize KYC contract:', error);
    }
  }

  /**
   * KYC 검증 상태 확인
   */
  async checkKYCStatus(userAddress) {
    try {
      if (!this.kycContract) {
        throw new Error('KYC contract not initialized');
      }

      const isVerified = await this.kycContract.isKYCVerified(userAddress);
      const kycInfo = await this.kycContract.getKYCInfo(userAddress);

      return {
        isVerified,
        kycInfo: {
          userAddress: kycInfo.userAddress,
          status: this.getKYCStatusString(kycInfo.status),
          level: this.getKYCLevelString(kycInfo.level),
          riskLevel: this.getRiskLevelString(kycInfo.riskLevel),
          verificationDate: new Date(kycInfo.verificationDate * 1000).toISOString(),
          expiryDate: new Date(kycInfo.expiryDate * 1000).toISOString(),
          riskScore: kycInfo.riskScore.toString(),
          documentHash: kycInfo.documentHash,
          verificationId: kycInfo.verificationId,
          isActive: kycInfo.isActive,
          lastUpdated: new Date(kycInfo.lastUpdated * 1000).toISOString(),
          verifiedBy: kycInfo.verifiedBy,
          rejectionReason: kycInfo.rejectionReason,
          dailyLimit: ethers.formatEther(kycInfo.dailyLimit),
          monthlyLimit: ethers.formatEther(kycInfo.monthlyLimit),
          totalLimit: ethers.formatEther(kycInfo.totalLimit)
        }
      };
    } catch (error) {
      logger.error('Error checking KYC status:', error);
      throw error;
    }
  }

  /**
   * KYC 검증 프로세스 시작
   */
  async initiateKYCVerification(userData) {
    try {
      const {
        userAddress,
        firstName,
        lastName,
        dateOfBirth,
        nationality,
        documentType,
        documentNumber,
        documentHash
      } = userData;

      // 기본 검증
      if (!userAddress || !firstName || !lastName || !dateOfBirth) {
        throw new Error('Missing required user information');
      }

      // 나이 검증
      const age = this.calculateAge(dateOfBirth);
      if (age < 18) {
        throw new Error('User must be at least 18 years old');
      }

      // 위험도 평가
      const riskScore = await this.calculateRiskScore(userData);
      const riskLevel = this.determineRiskLevel(riskScore);

      // KYC 레벨 결정
      const kycLevel = this.determineKYCLevel(userData, riskScore);

      // 검증 ID 생성
      const verificationId = this.generateVerificationId(userAddress, documentNumber);

      // 블록체인에 KYC 정보 저장
      const signer = await this.getSigner();
      const kycContractWithSigner = this.kycContract.connect(signer);

      const tx = await kycContractWithSigner.verifyKYC(
        userAddress,
        kycLevel,
        riskLevel,
        documentHash,
        verificationId
      );

      await tx.wait();

      logger.info(`✅ KYC verification initiated for ${userAddress}`);

      return {
        success: true,
        verificationId,
        riskScore,
        riskLevel: this.getRiskLevelString(riskLevel),
        kycLevel: this.getKYCLevelString(kycLevel),
        estimatedProcessingTime: '24-48 hours'
      };

    } catch (error) {
      logger.error('Error initiating KYC verification:', error);
      throw error;
    }
  }

  /**
   * AML 거래 위험도 검사
   */
  async checkTransactionRisk(userAddress, amount) {
    try {
      if (!this.kycContract) {
        throw new Error('KYC contract not initialized');
      }

      const [riskScore, isBlocked] = await this.kycContract.checkTransactionRisk(userAddress, amount);

      return {
        riskScore: riskScore.toString(),
        isBlocked,
        riskLevel: this.determineRiskLevel(riskScore),
        recommendation: this.getTransactionRecommendation(riskScore, isBlocked)
      };
    } catch (error) {
      logger.error('Error checking transaction risk:', error);
      throw error;
    }
  }

  /**
   * 위험도 점수 계산
   */
  async calculateRiskScore(userData) {
    let riskScore = 0;

    // 국가 위험도
    const countryRisk = this.getCountryRiskScore(userData.nationality);
    riskScore += countryRisk;

    // 나이 위험도
    const age = this.calculateAge(userData.dateOfBirth);
    if (age < 25 || age > 65) riskScore += 10;

    // 문서 유형 위험도
    const documentRisk = this.getDocumentRiskScore(userData.documentType);
    riskScore += documentRisk;

    // 기타 위험 요소들
    if (userData.isPEP) riskScore += 30; // 정치적 인물
    if (userData.isSanctioned) riskScore += 50; // 제재 대상

    return Math.min(riskScore, 100);
  }

  /**
   * 위험도 레벨 결정
   */
  determineRiskLevel(riskScore) {
    if (riskScore >= 90) return 3; // CRITICAL
    if (riskScore >= 70) return 2; // HIGH
    if (riskScore >= 30) return 1; // MEDIUM
    return 0; // LOW
  }

  /**
   * KYC 레벨 결정
   */
  determineKYCLevel(userData, riskScore) {
    if (riskScore >= 70 || userData.isPEP) return 2; // PREMIUM
    if (riskScore >= 30 || userData.expectedTransactionAmount > 100000) return 1; // ENHANCED
    return 0; // BASIC
  }

  /**
   * 국가 위험도 점수
   */
  getCountryRiskScore(nationality) {
    const highRiskCountries = ['IR', 'KP', 'CU', 'SY', 'VE'];
    const mediumRiskCountries = ['RU', 'CN', 'PK', 'BD', 'NG'];
    
    if (highRiskCountries.includes(nationality)) return 40;
    if (mediumRiskCountries.includes(nationality)) return 20;
    return 0;
  }

  /**
   * 문서 유형 위험도 점수
   */
  getDocumentRiskScore(documentType) {
    const riskScores = {
      'PASSPORT': 0,
      'NATIONAL_ID': 5,
      'DRIVERS_LICENSE': 10,
      'RESIDENCE_PERMIT': 15
    };
    return riskScores[documentType] || 20;
  }

  /**
   * 나이 계산
   */
  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * 검증 ID 생성
   */
  generateVerificationId(userAddress, documentNumber) {
    const timestamp = Date.now();
    const hash = ethers.keccak256(ethers.toUtf8Bytes(`${userAddress}${documentNumber}${timestamp}`));
    return hash.substring(0, 16);
  }

  /**
   * 거래 권장사항
   */
  getTransactionRecommendation(riskScore, isBlocked) {
    if (isBlocked) return 'TRANSACTION_BLOCKED';
    if (riskScore >= 90) return 'REQUIRE_MANUAL_REVIEW';
    if (riskScore >= 70) return 'ENHANCED_MONITORING';
    if (riskScore >= 30) return 'STANDARD_MONITORING';
    return 'APPROVED';
  }

  /**
   * KYC 상태 문자열 변환
   */
  getKYCStatusString(status) {
    const statuses = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'SUSPENDED'];
    return statuses[status] || 'UNKNOWN';
  }

  /**
   * KYC 레벨 문자열 변환
   */
  getKYCLevelString(level) {
    const levels = ['BASIC', 'ENHANCED', 'PREMIUM'];
    return levels[level] || 'UNKNOWN';
  }

  /**
   * 위험도 레벨 문자열 변환
   */
  getRiskLevelString(riskLevel) {
    const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return levels[riskLevel] || 'UNKNOWN';
  }

  /**
   * 서명자 가져오기
   */
  async getSigner() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Private key not configured');
    }
    return new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * 화이트리스트 관리
   */
  async addToWhitelist(userAddress) {
    try {
      const signer = await this.getSigner();
      const kycContractWithSigner = this.kycContract.connect(signer);
      
      const tx = await kycContractWithSigner.addToWhitelist(userAddress);
      await tx.wait();
      
      logger.info(`✅ User ${userAddress} added to whitelist`);
      return { success: true };
    } catch (error) {
      logger.error('Error adding user to whitelist:', error);
      throw error;
    }
  }

  /**
   * 블랙리스트 관리
   */
  async addToBlacklist(userAddress, reason) {
    try {
      const signer = await this.getSigner();
      const kycContractWithSigner = this.kycContract.connect(signer);
      
      const tx = await kycContractWithSigner.addToBlacklist(userAddress, reason);
      await tx.wait();
      
      logger.info(`✅ User ${userAddress} added to blacklist: ${reason}`);
      return { success: true };
    } catch (error) {
      logger.error('Error adding user to blacklist:', error);
      throw error;
    }
  }
}

module.exports = new KYCService(); 