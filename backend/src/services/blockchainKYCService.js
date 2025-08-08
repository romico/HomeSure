const { ethers } = require('ethers');
const logger = require('../utils/logger');

class BlockchainKYCService {
  constructor() {
    this.provider = null;
    this.kycContract = null;
    this.propertyTokenContract = null;
    this.wallet = null;
  }

  /**
   * 블록체인 연결 초기화
   * @param {string} rpcUrl RPC URL
   * @param {string} privateKey 개인키
   * @param {string} kycContractAddress KYC 컨트랙트 주소
   * @param {string} propertyTokenAddress PropertyToken 컨트랙트 주소
   */
  async initialize(rpcUrl, privateKey, kycContractAddress, propertyTokenAddress) {
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // KYC 컨트랙트 ABI (간소화된 버전)
      const kycABI = [
        'function verifyKYC(address userAddress, uint8 level, string documentHash, string verificationId, uint256 riskScore) external',
        'function rejectKYC(address userAddress, string reason) external',
        'function isKYCVerified(address userAddress) external view returns (bool)',
        'function isWhitelisted(address userAddress) external view returns (bool)',
        'function isBlacklisted(address userAddress) external view returns (bool)',
        'function getKYCInfo(address userAddress) external view returns (tuple(address userAddress, uint8 status, uint8 level, uint8 riskLevel, uint256 verificationDate, uint256 expiryDate, uint256 riskScore, string documentHash, string verificationId, bool isActive, uint256 lastUpdated, address verifiedBy, string rejectionReason, uint256 dailyLimit, uint256 monthlyLimit, uint256 totalLimit))',
        'function validateTransactionLimits(address userAddress, uint256 amount) external view returns (bool)',
        'function recordAMLTransaction(address userAddress, uint256 amount, uint256 riskScore, string reason) external returns (uint256)',
        'function updateRiskScore(address userAddress, uint256 newRiskScore) external',
        'function setWhitelistStatus(address userAddress, bool status) external',
        'function setBlacklistStatus(address userAddress, bool status) external'
      ];

      // PropertyToken 컨트랙트 ABI (간소화된 버전)
      const propertyTokenABI = [
        'function setKYCStatus(address account, bool status) external',
        'function setFrozenStatus(address account, bool status) external',
        'function isKYCVerified(address account) external view returns (bool)',
        'function isFrozen(address account) external view returns (bool)',
        'function updateKYCVerificationContract(address newKYCVerification) external'
      ];

      this.kycContract = new ethers.Contract(kycContractAddress, kycABI, this.wallet);
      this.propertyTokenContract = new ethers.Contract(propertyTokenAddress, propertyTokenABI, this.wallet);

      logger.info('블록체인 KYC 서비스 초기화 완료');
    } catch (error) {
      logger.error('블록체인 KYC 서비스 초기화 실패:', error.message);
      throw new Error(`블록체인 KYC 서비스 초기화 실패: ${error.message}`);
    }
  }

  /**
   * KYC 인증을 블록체인에 기록
   * @param {string} userAddress 사용자 주소
   * @param {Object} kycData KYC 데이터
   * @returns {Object} 트랜잭션 결과
   */
  async verifyKYCOnBlockchain(userAddress, kycData) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const { level, documentHash, verificationId, riskScore } = kycData;

      // KYC 레벨 매핑
      const kycLevel = this.mapKYCLevel(level);
      
      // 트랜잭션 실행
      const tx = await this.kycContract.verifyKYC(
        userAddress,
        kycLevel,
        documentHash,
        verificationId,
        riskScore
      );

      const receipt = await tx.wait();

      logger.info(`KYC 인증 블록체인 기록 완료: ${userAddress}, TX: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      logger.error('KYC 인증 블록체인 기록 실패:', error.message);
      throw new Error(`KYC 인증 블록체인 기록 실패: ${error.message}`);
    }
  }

  /**
   * KYC 거부를 블록체인에 기록
   * @param {string} userAddress 사용자 주소
   * @param {string} reason 거부 사유
   * @returns {Object} 트랜잭션 결과
   */
  async rejectKYCOnBlockchain(userAddress, reason) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const tx = await this.kycContract.rejectKYC(userAddress, reason);
      const receipt = await tx.wait();

      logger.info(`KYC 거부 블록체인 기록 완료: ${userAddress}, TX: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      logger.error('KYC 거부 블록체인 기록 실패:', error.message);
      throw new Error(`KYC 거부 블록체인 기록 실패: ${error.message}`);
    }
  }

  /**
   * 블록체인에서 KYC 상태 확인
   * @param {string} userAddress 사용자 주소
   * @returns {Object} KYC 상태 정보
   */
  async getKYCStatusFromBlockchain(userAddress) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const [isVerified, isWhitelisted, isBlacklisted, kycInfo] = await Promise.all([
        this.kycContract.isKYCVerified(userAddress),
        this.kycContract.isWhitelisted(userAddress),
        this.kycContract.isBlacklisted(userAddress),
        this.kycContract.getKYCInfo(userAddress)
      ]);

      return {
        isVerified,
        isWhitelisted,
        isBlacklisted,
        kycInfo: this.parseKYCInfo(kycInfo)
      };

    } catch (error) {
      logger.error('블록체인 KYC 상태 조회 실패:', error.message);
      throw new Error(`블록체인 KYC 상태 조회 실패: ${error.message}`);
    }
  }

  /**
   * 거래 한도 검증
   * @param {string} userAddress 사용자 주소
   * @param {number} amount 거래 금액
   * @returns {boolean} 검증 통과 여부
   */
  async validateTransactionLimits(userAddress, amount) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const isValid = await this.kycContract.validateTransactionLimits(userAddress, amount);
      return isValid;

    } catch (error) {
      logger.error('거래 한도 검증 실패:', error.message);
      return false;
    }
  }

  /**
   * AML 거래를 블록체인에 기록
   * @param {string} userAddress 사용자 주소
   * @param {number} amount 거래 금액
   * @param {number} riskScore 위험도 점수
   * @param {string} reason 위험 사유
   * @returns {Object} 트랜잭션 결과
   */
  async recordAMLTransaction(userAddress, amount, riskScore, reason) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const tx = await this.kycContract.recordAMLTransaction(
        userAddress,
        amount,
        riskScore,
        reason
      );

      const receipt = await tx.wait();

      logger.info(`AML 거래 블록체인 기록 완료: ${userAddress}, TX: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      logger.error('AML 거래 블록체인 기록 실패:', error.message);
      throw new Error(`AML 거래 블록체인 기록 실패: ${error.message}`);
    }
  }

  /**
   * 위험도 점수 업데이트
   * @param {string} userAddress 사용자 주소
   * @param {number} newRiskScore 새로운 위험도 점수
   * @returns {Object} 트랜잭션 결과
   */
  async updateRiskScore(userAddress, newRiskScore) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const tx = await this.kycContract.updateRiskScore(userAddress, newRiskScore);
      const receipt = await tx.wait();

      logger.info(`위험도 점수 업데이트 완료: ${userAddress}, TX: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      logger.error('위험도 점수 업데이트 실패:', error.message);
      throw new Error(`위험도 점수 업데이트 실패: ${error.message}`);
    }
  }

  /**
   * 화이트리스트 상태 업데이트
   * @param {string} userAddress 사용자 주소
   * @param {boolean} status 화이트리스트 상태
   * @returns {Object} 트랜잭션 결과
   */
  async updateWhitelistStatus(userAddress, status) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const tx = await this.kycContract.setWhitelistStatus(userAddress, status);
      const receipt = await tx.wait();

      logger.info(`화이트리스트 상태 업데이트 완료: ${userAddress}, 상태: ${status}, TX: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      logger.error('화이트리스트 상태 업데이트 실패:', error.message);
      throw new Error(`화이트리스트 상태 업데이트 실패: ${error.message}`);
    }
  }

  /**
   * 블랙리스트 상태 업데이트
   * @param {string} userAddress 사용자 주소
   * @param {boolean} status 블랙리스트 상태
   * @returns {Object} 트랜잭션 결과
   */
  async updateBlacklistStatus(userAddress, status) {
    try {
      if (!this.kycContract) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const tx = await this.kycContract.setBlacklistStatus(userAddress, status);
      const receipt = await tx.wait();

      logger.info(`블랙리스트 상태 업데이트 완료: ${userAddress}, 상태: ${status}, TX: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      logger.error('블랙리스트 상태 업데이트 실패:', error.message);
      throw new Error(`블랙리스트 상태 업데이트 실패: ${error.message}`);
    }
  }

  /**
   * KYC 레벨 매핑
   * @param {string} level KYC 레벨 문자열
   * @returns {number} KYC 레벨 숫자
   */
  mapKYCLevel(level) {
    const levelMap = {
      'BASIC': 0,
      'ENHANCED': 1,
      'PREMIUM': 2
    };
    return levelMap[level] || 0;
  }

  /**
   * KYC 정보 파싱
   * @param {Array} kycInfo KYC 정보 배열
   * @returns {Object} 파싱된 KYC 정보
   */
  parseKYCInfo(kycInfo) {
    const statusMap = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'SUSPENDED'];
    const levelMap = ['BASIC', 'ENHANCED', 'PREMIUM'];
    const riskMap = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    return {
      userAddress: kycInfo[0],
      status: statusMap[kycInfo[1]] || 'UNKNOWN',
      level: levelMap[kycInfo[2]] || 'UNKNOWN',
      riskLevel: riskMap[kycInfo[3]] || 'UNKNOWN',
      verificationDate: kycInfo[4].toString(),
      expiryDate: kycInfo[5].toString(),
      riskScore: kycInfo[6].toString(),
      documentHash: kycInfo[7],
      verificationId: kycInfo[8],
      isActive: kycInfo[9],
      lastUpdated: kycInfo[10].toString(),
      verifiedBy: kycInfo[11],
      rejectionReason: kycInfo[12],
      dailyLimit: kycInfo[13].toString(),
      monthlyLimit: kycInfo[14].toString(),
      totalLimit: kycInfo[15].toString()
    };
  }

  /**
   * 네트워크 상태 확인
   * @returns {Object} 네트워크 정보
   */
  async getNetworkInfo() {
    try {
      if (!this.provider) {
        throw new Error('블록체인 서비스가 초기화되지 않았습니다.');
      }

      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getFeeData();

      return {
        chainId: network.chainId.toString(),
        name: network.name,
        blockNumber: blockNumber.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0'
      };

    } catch (error) {
      logger.error('네트워크 정보 조회 실패:', error.message);
      throw new Error(`네트워크 정보 조회 실패: ${error.message}`);
    }
  }
}

module.exports = new BlockchainKYCService(); 