const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class EncryptionService {
  constructor() {
    // 환경 변수에서 암호화 키 가져오기
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 16;
    this.tagLength = 16;
    
    // 데이터 보존 기간 설정 (일)
    this.retentionPeriods = {
      KYC_DATA: 365 * 5, // 5년
      TRANSACTION_DATA: 365 * 7, // 7년
      USER_PROFILE: 365 * 10, // 10년
      AML_DATA: 365 * 7, // 7년
      AUDIT_LOGS: 365 * 3, // 3년
      TEMP_DATA: 30 // 30일
    };
  }

  /**
   * 암호화 키 생성 (개발용)
   */
  generateEncryptionKey() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production environment');
    }
    
    const key = crypto.randomBytes(32);
    logger.warn('개발 환경에서 암호화 키가 자동 생성되었습니다. 프로덕션에서는 ENCRYPTION_KEY를 설정하세요.');
    return key.toString('hex');
  }

  /**
   * 데이터 암호화
   * @param {string} data - 암호화할 데이터
   * @returns {Object} 암호화된 데이터와 메타데이터
   */
  encrypt(data) {
    try {
      if (!data) {
        throw new Error('암호화할 데이터가 없습니다.');
      }

      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, Buffer.from(this.encryptionKey, 'hex'));
      
      cipher.setAAD(Buffer.from('homesure-kyc', 'utf8'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('데이터 암호화 실패:', error.message);
      throw new Error(`암호화 실패: ${error.message}`);
    }
  }

  /**
   * 데이터 복호화
   * @param {Object} encryptedData - 암호화된 데이터 객체
   * @returns {string} 복호화된 데이터
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || !encryptedData.encryptedData) {
        throw new Error('복호화할 데이터가 없습니다.');
      }

      const decipher = crypto.createDecipher(
        this.algorithm, 
        Buffer.from(this.encryptionKey, 'hex')
      );
      
      decipher.setAAD(Buffer.from('homesure-kyc', 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('데이터 복호화 실패:', error.message);
      throw new Error(`복호화 실패: ${error.message}`);
    }
  }

  /**
   * 개인정보 익명화
   * @param {Object} personalData - 개인정보 객체
   * @returns {Object} 익명화된 데이터
   */
  anonymizePersonalData(personalData) {
    try {
      const anonymized = { ...personalData };
      
      // 이메일 익명화
      if (anonymized.email) {
        const [localPart, domain] = anonymized.email.split('@');
        anonymized.email = `${localPart.substring(0, 2)}***@${domain}`;
      }
      
      // 전화번호 익명화
      if (anonymized.phone) {
        anonymized.phone = anonymized.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      }
      
      // 주소 익명화
      if (anonymized.address) {
        const parts = anonymized.address.split(' ');
        if (parts.length > 1) {
          anonymized.address = `${parts[0]} *** ${parts[parts.length - 1]}`;
        }
      }
      
      // 이름 익명화
      if (anonymized.firstName) {
        anonymized.firstName = anonymized.firstName.substring(0, 1) + '*';
      }
      
      if (anonymized.lastName) {
        anonymized.lastName = anonymized.lastName.substring(0, 1) + '*';
      }
      
      // 생년월일 익명화
      if (anonymized.dateOfBirth) {
        const date = new Date(anonymized.dateOfBirth);
        anonymized.dateOfBirth = `${date.getFullYear()}-**-**`;
      }
      
      // 지갑 주소 익명화
      if (anonymized.walletAddress) {
        anonymized.walletAddress = `${anonymized.walletAddress.substring(0, 6)}...${anonymized.walletAddress.substring(-4)}`;
      }
      
      return anonymized;
    } catch (error) {
      logger.error('개인정보 익명화 실패:', error.message);
      throw new Error(`익명화 실패: ${error.message}`);
    }
  }

  /**
   * 데이터 보존 기간 확인 및 만료된 데이터 식별
   * @param {string} dataType - 데이터 타입
   * @returns {Array} 만료된 데이터 목록
   */
  async findExpiredData(dataType) {
    try {
      const retentionPeriod = this.retentionPeriods[dataType];
      if (!retentionPeriod) {
        throw new Error(`알 수 없는 데이터 타입: ${dataType}`);
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - retentionPeriod);

      let expiredData = [];

      switch (dataType) {
        case 'KYC_DATA':
          expiredData = await prisma.kYCRecord.findMany({
            where: {
              createdAt: {
                lt: expiryDate
              }
            }
          });
          break;
          
        case 'TRANSACTION_DATA':
          expiredData = await prisma.transaction.findMany({
            where: {
              createdAt: {
                lt: expiryDate
              }
            }
          });
          break;
          
        case 'AML_DATA':
          expiredData = await prisma.aMLTransaction.findMany({
            where: {
              createdAt: {
                lt: expiryDate
              }
            }
          });
          break;
          
        case 'AUDIT_LOGS':
          // 감사 로그는 별도 테이블이 필요할 수 있음
          break;
          
        default:
          throw new Error(`지원하지 않는 데이터 타입: ${dataType}`);
      }

      return expiredData;
    } catch (error) {
      logger.error('만료된 데이터 조회 실패:', error.message);
      throw new Error(`만료된 데이터 조회 실패: ${error.message}`);
    }
  }

  /**
   * 만료된 데이터 삭제
   * @param {string} dataType - 데이터 타입
   * @returns {number} 삭제된 레코드 수
   */
  async deleteExpiredData(dataType) {
    try {
      const expiredData = await this.findExpiredData(dataType);
      let deletedCount = 0;

      for (const record of expiredData) {
        try {
          // 실제 삭제 대신 익명화 처리 (GDPR 요구사항)
          await this.anonymizeAndArchive(record, dataType);
          deletedCount++;
        } catch (error) {
          logger.error(`데이터 삭제 실패 (ID: ${record.id}):`, error.message);
        }
      }

      logger.info(`${dataType} 만료 데이터 ${deletedCount}개 처리 완료`);
      return deletedCount;
    } catch (error) {
      logger.error('만료된 데이터 삭제 실패:', error.message);
      throw new Error(`만료된 데이터 삭제 실패: ${error.message}`);
    }
  }

  /**
   * 데이터 익명화 및 아카이브
   * @param {Object} record - 처리할 레코드
   * @param {string} dataType - 데이터 타입
   */
  async anonymizeAndArchive(record, dataType) {
    try {
      // 원본 데이터 백업 (암호화하여 저장)
      const originalData = JSON.stringify(record);
      const encryptedData = this.encrypt(originalData);
      
      // 아카이브 테이블에 저장
      await prisma.dataArchive.create({
        data: {
          originalId: record.id,
          dataType,
          encryptedData: encryptedData.encryptedData,
          iv: encryptedData.iv,
          tag: encryptedData.tag,
          algorithm: encryptedData.algorithm,
          archivedAt: new Date(),
          retentionUntil: this.calculateRetentionDate(dataType)
        }
      });

      // 원본 데이터 익명화
      const anonymizedData = this.anonymizePersonalData(record);
      
      // 원본 테이블 업데이트
      switch (dataType) {
        case 'KYC_DATA':
          await prisma.kYCRecord.update({
            where: { id: record.id },
            data: {
              ...anonymizedData,
              isAnonymized: true,
              anonymizedAt: new Date()
            }
          });
          break;
          
        case 'TRANSACTION_DATA':
          await prisma.transaction.update({
            where: { id: record.id },
            data: {
              ...anonymizedData,
              isAnonymized: true,
              anonymizedAt: new Date()
            }
          });
          break;
          
        case 'AML_DATA':
          await prisma.aMLTransaction.update({
            where: { id: record.id },
            data: {
              ...anonymizedData,
              isAnonymized: true,
              anonymizedAt: new Date()
            }
          });
          break;
      }

      logger.info(`데이터 익명화 및 아카이브 완료: ${record.id}`);
    } catch (error) {
      logger.error('데이터 익명화 및 아카이브 실패:', error.message);
      throw new Error(`데이터 익명화 및 아카이브 실패: ${error.message}`);
    }
  }

  /**
   * 보존 기간 계산
   * @param {string} dataType - 데이터 타입
   * @returns {Date} 보존 만료일
   */
  calculateRetentionDate(dataType) {
    const retentionPeriod = this.retentionPeriods[dataType];
    if (!retentionPeriod) {
      throw new Error(`알 수 없는 데이터 타입: ${dataType}`);
    }

    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + retentionPeriod);
    return retentionDate;
  }

  /**
   * GDPR 삭제 요청 처리
   * @param {string} userId - 사용자 ID
   * @returns {Object} 삭제 처리 결과
   */
  async processGDPRDeletionRequest(userId) {
    try {
      // 사용자 데이터 조회
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          kycRecords: true,
          transactions: true,
          amlTransactions: true,
          gdprConsents: true
        }
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 삭제 요청 기록
      const deletionRequest = await prisma.dataDeletionRequest.create({
        data: {
          userId,
          requestType: 'FULL_DELETION',
          status: 'PROCESSING',
          requestedAt: new Date(),
          reason: 'GDPR Right to be Forgotten'
        }
      });

      // 개인정보 익명화
      const anonymizedUser = this.anonymizePersonalData(user);
      
      // 사용자 데이터 업데이트
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...anonymizedUser,
          isActive: false,
          deletedAt: new Date(),
          deletionRequestId: deletionRequest.id
        }
      });

      // 관련 데이터 익명화
      await this.anonymizeRelatedData(userId);

      // 삭제 요청 상태 업데이트
      await prisma.dataDeletionRequest.update({
        where: { id: deletionRequest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      logger.info(`GDPR 삭제 요청 처리 완료: ${userId}`);
      
      return {
        success: true,
        deletionRequestId: deletionRequest.id,
        message: '개인정보 삭제가 완료되었습니다.'
      };
    } catch (error) {
      logger.error('GDPR 삭제 요청 처리 실패:', error.message);
      throw new Error(`GDPR 삭제 요청 처리 실패: ${error.message}`);
    }
  }

  /**
   * 관련 데이터 익명화
   * @param {string} userId - 사용자 ID
   */
  async anonymizeRelatedData(userId) {
    try {
      // KYC 기록 익명화
      await prisma.kYCRecord.updateMany({
        where: { userId },
        data: {
          isAnonymized: true,
          anonymizedAt: new Date()
        }
      });

      // 거래 기록 익명화
      await prisma.transaction.updateMany({
        where: { userId },
        data: {
          isAnonymized: true,
          anonymizedAt: new Date()
        }
      });

      // AML 거래 기록 익명화
      await prisma.aMLTransaction.updateMany({
        where: { userId },
        data: {
          isAnonymized: true,
          anonymizedAt: new Date()
        }
      });

      logger.info(`관련 데이터 익명화 완료: ${userId}`);
    } catch (error) {
      logger.error('관련 데이터 익명화 실패:', error.message);
      throw new Error(`관련 데이터 익명화 실패: ${error.message}`);
    }
  }

  /**
   * 접근 로그 기록
   * @param {string} userId - 사용자 ID
   * @param {string} action - 수행된 액션
   * @param {string} resource - 접근한 리소스
   * @param {Object} metadata - 추가 메타데이터
   */
  async logAccess(userId, action, resource, metadata = {}) {
    try {
      await prisma.accessLog.create({
        data: {
          userId,
          action,
          resource,
          metadata,
          timestamp: new Date(),
          ipAddress: metadata.ipAddress || 'unknown',
          userAgent: metadata.userAgent || 'unknown'
        }
      });
    } catch (error) {
      logger.error('접근 로그 기록 실패:', error.message);
      // 로그 기록 실패는 전체 프로세스를 중단하지 않음
    }
  }

  /**
   * 데이터 최소화 원칙 적용
   * @param {Object} data - 원본 데이터
   * @param {Array} requiredFields - 필요한 필드 목록
   * @returns {Object} 최소화된 데이터
   */
  minimizeData(data, requiredFields) {
    try {
      const minimized = {};
      
      for (const field of requiredFields) {
        if (data.hasOwnProperty(field)) {
          minimized[field] = data[field];
        }
      }
      
      return minimized;
    } catch (error) {
      logger.error('데이터 최소화 실패:', error.message);
      throw new Error(`데이터 최소화 실패: ${error.message}`);
    }
  }
}

module.exports = EncryptionService; 