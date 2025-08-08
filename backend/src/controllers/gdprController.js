const EncryptionService = require('../services/encryptionService');
const logger = require('../utils/logger');

class GDPRController {
  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * GDPR 동의 관리
   */
  async manageConsent(req, res) {
    try {
      const { userId, consentType, isGranted } = req.body;
      const { ipAddress, userAgent } = req;

      if (!userId || !consentType) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID와 동의 타입은 필수입니다.'
        });
      }

      // 기존 동의 확인
      const existingConsent = await prisma.gDPRConsent.findFirst({
        where: {
          userId,
          consentType
        }
      });

      if (existingConsent) {
        // 기존 동의 업데이트
        await prisma.gDPRConsent.update({
          where: { id: existingConsent.id },
          data: {
            isGranted,
            grantedAt: isGranted ? new Date() : null,
            revokedAt: !isGranted ? new Date() : null,
            ipAddress,
            userAgent
          }
        });
      } else {
        // 새로운 동의 생성
        await prisma.gDPRConsent.create({
          data: {
            userId,
            consentType,
            isGranted,
            grantedAt: isGranted ? new Date() : null,
            ipAddress,
            userAgent
          }
        });
      }

      // 접근 로그 기록
      await this.encryptionService.logAccess(userId, 'CONSENT_UPDATE', 'GDPR', {
        consentType,
        isGranted,
        ipAddress,
        userAgent
      });

      res.status(200).json({
        success: true,
        message: 'GDPR 동의가 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('GDPR 동의 관리 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'GDPR 동의 관리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 개인정보 삭제 요청
   */
  async requestDataDeletion(req, res) {
    try {
      const { userId, reason } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID는 필수입니다.'
        });
      }

      // 기존 삭제 요청 확인
      const existingRequest = await prisma.dataDeletionRequest.findFirst({
        where: {
          userId,
          status: {
            in: ['PENDING', 'PROCESSING']
          }
        }
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: '이미 처리 중인 삭제 요청이 있습니다.'
        });
      }

      // 삭제 요청 생성
      const deletionRequest = await prisma.dataDeletionRequest.create({
        data: {
          userId,
          requestType: 'FULL_DELETION',
          status: 'PENDING',
          reason: reason || '사용자 요청',
          requestedAt: new Date()
        }
      });

      // 접근 로그 기록
      await this.encryptionService.logAccess(userId, 'DELETION_REQUEST', 'GDPR', {
        requestId: deletionRequest.id,
        reason
      });

      res.status(200).json({
        success: true,
        data: {
          requestId: deletionRequest.id,
          status: deletionRequest.status
        },
        message: '개인정보 삭제 요청이 접수되었습니다.'
      });

    } catch (error) {
      logger.error('개인정보 삭제 요청 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '개인정보 삭제 요청 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 개인정보 삭제 요청 처리 (관리자용)
   */
  async processDataDeletion(req, res) {
    try {
      const { requestId } = req.params;
      const { adminId } = req.body;

      if (!requestId || !adminId) {
        return res.status(400).json({
          success: false,
          message: '요청 ID와 관리자 ID는 필수입니다.'
        });
      }

      // 삭제 요청 조회
      const deletionRequest = await prisma.dataDeletionRequest.findUnique({
        where: { id: requestId },
        include: { user: true }
      });

      if (!deletionRequest) {
        return res.status(404).json({
          success: false,
          message: '삭제 요청을 찾을 수 없습니다.'
        });
      }

      if (deletionRequest.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          message: '이미 처리된 요청입니다.'
        });
      }

      // 상태를 처리 중으로 업데이트
      await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: 'PROCESSING',
          processedBy: adminId,
          processedAt: new Date()
        }
      });

      // 실제 삭제 처리
      const result = await this.encryptionService.processGDPRDeletionRequest(deletionRequest.userId);

      // 접근 로그 기록
      await this.encryptionService.logAccess(adminId, 'PROCESS_DELETION', 'GDPR', {
        requestId,
        userId: deletionRequest.userId,
        result: result.success
      });

      res.status(200).json({
        success: true,
        data: result,
        message: '개인정보 삭제가 완료되었습니다.'
      });

    } catch (error) {
      logger.error('개인정보 삭제 처리 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '개인정보 삭제 처리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 개인정보 내보내기
   */
  async exportPersonalData(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID는 필수입니다.'
        });
      }

      // 사용자 데이터 조회
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          kycRecords: true,
          transactions: true,
          amlTransactions: true,
          gdprConsents: true,
          dataDeletionRequests: true
        }
      });

      if (!userData) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      // 민감한 정보 제거
      const exportData = {
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          address: userData.address,
          city: userData.city,
          country: userData.country,
          postalCode: userData.postalCode,
          dateOfBirth: userData.dateOfBirth,
          kycStatus: userData.kycStatus,
          role: userData.role,
          walletAddress: userData.walletAddress,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        },
        kycRecords: userData.kycRecords.map(record => ({
          id: record.id,
          documentType: record.documentType,
          verificationStatus: record.verificationStatus,
          verifiedAt: record.verifiedAt,
          createdAt: record.createdAt
        })),
        transactions: userData.transactions.map(tx => ({
          id: tx.id,
          transactionHash: tx.transactionHash,
          amount: tx.amount,
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          status: tx.status,
          createdAt: tx.createdAt
        })),
        gdprConsents: userData.gdprConsents.map(consent => ({
          id: consent.id,
          consentType: consent.consentType,
          isGranted: consent.isGranted,
          grantedAt: consent.grantedAt,
          revokedAt: consent.revokedAt,
          createdAt: consent.createdAt
        }))
      };

      // 접근 로그 기록
      await this.encryptionService.logAccess(userId, 'DATA_EXPORT', 'GDPR', {
        exportSize: JSON.stringify(exportData).length
      });

      res.status(200).json({
        success: true,
        data: exportData,
        message: '개인정보 내보내기가 완료되었습니다.'
      });

    } catch (error) {
      logger.error('개인정보 내보내기 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '개인정보 내보내기 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 만료된 데이터 정리
   */
  async cleanupExpiredData(req, res) {
    try {
      const { dataType } = req.params;

      if (!dataType) {
        return res.status(400).json({
          success: false,
          message: '데이터 타입은 필수입니다.'
        });
      }

      // 만료된 데이터 조회
      const expiredData = await this.encryptionService.findExpiredData(dataType);

      if (expiredData.length === 0) {
        return res.status(200).json({
          success: true,
          message: '만료된 데이터가 없습니다.',
          data: { count: 0 }
        });
      }

      // 만료된 데이터 처리
      const deletedCount = await this.encryptionService.deleteExpiredData(dataType);

      res.status(200).json({
        success: true,
        data: {
          dataType,
          totalExpired: expiredData.length,
          processedCount: deletedCount
        },
        message: `${dataType} 만료 데이터 ${deletedCount}개가 처리되었습니다.`
      });

    } catch (error) {
      logger.error('만료된 데이터 정리 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '만료된 데이터 정리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 접근 로그 조회
   */
  async getAccessLogs(req, res) {
    try {
      const { userId, startDate, endDate, action, resource } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const where = {};

      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (resource) where.resource = resource;
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      const logs = await prisma.accessLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });

      const total = await prisma.accessLog.count({ where });

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        },
        message: '접근 로그를 조회했습니다.'
      });

    } catch (error) {
      logger.error('접근 로그 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '접근 로그 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  /**
   * 데이터 암호화 상태 확인
   */
  async getEncryptionStatus(req, res) {
    try {
      const tokenStatus = this.encryptionService.getTokenStatus();

      res.status(200).json({
        success: true,
        data: {
          encryptionKey: process.env.ENCRYPTION_KEY ? 'SET' : 'NOT_SET',
          algorithm: this.encryptionService.algorithm,
          retentionPeriods: this.encryptionService.retentionPeriods,
          environment: process.env.NODE_ENV
        },
        message: '암호화 상태를 조회했습니다.'
      });

    } catch (error) {
      logger.error('암호화 상태 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '암호화 상태 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
}

module.exports = new GDPRController(); 