const kycService = require('../services/kycService');
const logger = require('../utils/logger');

class KYCController {
  /**
   * KYC 검증 상태 확인
   */
  async checkKYCStatus(req, res) {
    try {
      const { userAddress } = req.params;
      
      if (!userAddress) {
        return res.status(400).json({
          success: false,
          message: 'User address is required'
        });
      }

      const kycStatus = await kycService.checkKYCStatus(userAddress);
      
      res.json({
        success: true,
        data: kycStatus
      });
    } catch (error) {
      logger.error('Error checking KYC status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check KYC status',
        error: error.message
      });
    }
  }

  /**
   * KYC 검증 프로세스 시작
   */
  async initiateKYCVerification(req, res) {
    try {
      const userData = req.body;
      
      // 필수 필드 검증
      const requiredFields = ['userAddress', 'firstName', 'lastName', 'dateOfBirth', 'nationality', 'documentType'];
      for (const field of requiredFields) {
        if (!userData[field]) {
          return res.status(400).json({
            success: false,
            message: `Missing required field: ${field}`
          });
        }
      }

      const result = await kycService.initiateKYCVerification(userData);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error initiating KYC verification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate KYC verification',
        error: error.message
      });
    }
  }

  /**
   * AML 거래 위험도 검사
   */
  async checkTransactionRisk(req, res) {
    try {
      const { userAddress, amount } = req.body;
      
      if (!userAddress || !amount) {
        return res.status(400).json({
          success: false,
          message: 'User address and amount are required'
        });
      }

      const riskAssessment = await kycService.checkTransactionRisk(userAddress, amount);
      
      res.json({
        success: true,
        data: riskAssessment
      });
    } catch (error) {
      logger.error('Error checking transaction risk:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check transaction risk',
        error: error.message
      });
    }
  }

  /**
   * 화이트리스트에 사용자 추가
   */
  async addToWhitelist(req, res) {
    try {
      const { userAddress } = req.body;
      
      if (!userAddress) {
        return res.status(400).json({
          success: false,
          message: 'User address is required'
        });
      }

      const result = await kycService.addToWhitelist(userAddress);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error adding user to whitelist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add user to whitelist',
        error: error.message
      });
    }
  }

  /**
   * 블랙리스트에 사용자 추가
   */
  async addToBlacklist(req, res) {
    try {
      const { userAddress, reason } = req.body;
      
      if (!userAddress || !reason) {
        return res.status(400).json({
          success: false,
          message: 'User address and reason are required'
        });
      }

      const result = await kycService.addToBlacklist(userAddress, reason);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error adding user to blacklist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add user to blacklist',
        error: error.message
      });
    }
  }

  /**
   * KYC 검증 세션 생성 (기존 호환성 유지)
   */
  async createVerificationSession(req, res) {
    try {
      const userData = req.body;
      
      // 기존 API와의 호환성을 위해 데이터 변환
      const transformedData = {
        userAddress: userData.userAddress,
        firstName: userData.firstName || 'Unknown',
        lastName: userData.lastName || 'Unknown',
        dateOfBirth: userData.dateOfBirth || '1990-01-01',
        nationality: userData.country || 'KR',
        documentType: userData.documentType || 'PASSPORT',
        documentNumber: userData.documentNumber || 'UNKNOWN',
        documentHash: userData.documentHash || 'QmDefaultHash',
        expectedTransactionAmount: userData.expectedTransactionAmount || 0,
        isPEP: userData.isPEP || false,
        isSanctioned: userData.isSanctioned || false
      };

      const result = await kycService.initiateKYCVerification(transformedData);
      
      res.json({
        success: true,
        data: {
          sessionId: result.verificationId,
          kycLevel: result.kycLevel,
          status: 'PENDING',
          estimatedProcessingTime: result.estimatedProcessingTime,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel
        }
      });
    } catch (error) {
      logger.error('Error creating verification session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create verification session',
        error: error.message
      });
    }
  }

  /**
   * KYC 검증 상태 확인 (기존 호환성 유지)
   */
  async checkVerificationStatus(req, res) {
    try {
      const { sessionId } = req.params;
      
      // 세션 ID를 사용자 주소로 변환 (실제로는 데이터베이스에서 조회해야 함)
      // 여기서는 간단한 시뮬레이션
      const userAddress = req.query.userAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      
      const kycStatus = await kycService.checkKYCStatus(userAddress);
      
      res.json({
        success: true,
        data: {
          sessionId,
          status: kycStatus.isVerified ? 'APPROVED' : 'PENDING',
          kycLevel: kycStatus.kycInfo.level,
          verificationDate: kycStatus.kycInfo.verificationDate,
          riskScore: kycStatus.kycInfo.riskScore,
          riskLevel: kycStatus.kycInfo.riskLevel,
          isVerified: kycStatus.isVerified
        }
      });
    } catch (error) {
      logger.error('Error checking verification status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check verification status',
        error: error.message
      });
    }
  }

  /**
   * KYC API 상태 모니터링
   */
  async getApiStatus(req, res) {
    try {
      const status = {
        service: 'KYC/AML Service',
        status: 'OPERATIONAL',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: {
          kycVerification: true,
          amlScreening: true,
          riskAssessment: true,
          whitelistManagement: true,
          blacklistManagement: true
        },
        contractAddress: process.env.KYC_VERIFICATION_ADDRESS || '0x0165878A594ca255338adfa4d48449f69242Eb8F'
      };
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting API status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get API status',
        error: error.message
      });
    }
  }
}

const kycController = new KYCController();
module.exports = kycController; 