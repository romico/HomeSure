const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const { sendMail } = require('../services/emailService');

class AdminController {
  /**
   * KYC 사용자 목록 조회
   */
  async getKYCUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // 필터 조건 구성
      const where = {};
      if (status && status !== 'ALL') {
        where.verificationStatus = status;
      }
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { documentNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      // 사용자 인증 정보 조회
      const [users, total] = await Promise.all([
        prisma.userVerification.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                walletAddress: true,
                createdAt: true,
              },
            },
            whitelistEntry: {
              select: {
                status: true,
                approvedBy: true,
                approvedAt: true,
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: parseInt(limit),
        }),
        prisma.userVerification.count({ where }),
      ]);

      // 응답 데이터 구성
      const formattedUsers = users.map(user => ({
        id: user.id,
        userId: user.userId,
        userAddress: user.user.walletAddress,
        firstName: user.firstName || user.user.firstName,
        lastName: user.lastName || user.user.lastName,
        email: user.user.email,
        status: user.verificationStatus,
        documentType: user.documentType,
        country: user.country,
        verificationDate: user.verificationDate,
        isWhitelisted: !!user.whitelistEntry,
        whitelistStatus: user.whitelistEntry?.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      res.status(200).json({
        success: true,
        data: {
          users: formattedUsers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
        message: 'KYC 사용자 목록을 조회했습니다.',
      });
    } catch (error) {
      logger.error('KYC 사용자 목록 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'KYC 사용자 목록 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * KYC 통계 조회
   */
  async getKYCStats(req, res) {
    try {
      const [
        totalUsers,
        pendingUsers,
        approvedUsers,
        rejectedUsers,
        whitelistedUsers,
        todayVerifications,
        weeklyVerifications,
      ] = await Promise.all([
        prisma.userVerification.count(),
        prisma.userVerification.count({ where: { verificationStatus: 'PENDING' } }),
        prisma.userVerification.count({ where: { verificationStatus: 'APPROVED' } }),
        prisma.userVerification.count({ where: { verificationStatus: 'REJECTED' } }),
        prisma.whitelistEntry.count({ where: { status: 'ACTIVE' } }),
        prisma.userVerification.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.userVerification.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      const stats = {
        total: totalUsers,
        pending: pendingUsers,
        approved: approvedUsers,
        rejected: rejectedUsers,
        whitelisted: whitelistedUsers,
        todayVerifications,
        weeklyVerifications,
        approvalRate: totalUsers > 0 ? ((approvedUsers / totalUsers) * 100).toFixed(2) : 0,
      };

      res.status(200).json({
        success: true,
        data: stats,
        message: 'KYC 통계를 조회했습니다.',
      });
    } catch (error) {
      logger.error('KYC 통계 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'KYC 통계 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * KYC 승인
   */
  async approveKYC(req, res) {
    try {
      const { userId } = req.params;
      const { reason, level = 'BASIC', notifyEmail } = req.body;
      const adminId = req.user.id;

      // 사용자 인증 정보 조회
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: '사용자 인증 정보를 찾을 수 없습니다.',
        });
      }

      if (verification.verificationStatus === 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: '이미 승인된 사용자입니다.',
        });
      }

      // 트랜잭션으로 승인 처리
      const result = await prisma.$transaction(async tx => {
        // 인증 상태 업데이트
        const updatedVerification = await tx.userVerification.update({
          where: { userId },
          data: {
            verificationStatus: 'APPROVED',
            verificationDate: new Date(),
          },
        });

        // 화이트리스트에 추가
        const whitelistEntry = await tx.whitelistEntry.create({
          data: {
            userId,
            verificationId: verification.id,
            status: 'ACTIVE',
            approvedBy: adminId,
            approvedAt: new Date(),
            reason: reason || '관리자 승인',
          },
        });

        // 사용자 KYC 상태 업데이트
        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: 'APPROVED' },
        });

        return { updatedVerification, whitelistEntry };
      });

      logger.info(`KYC 승인 완료: ${userId} by ${adminId}`);

      // 이메일 알림
      try {
        if (notifyEmail && verification.user?.email) {
          await sendMail({
            to: verification.user.email,
            subject: '[HomeSure] KYC 승인 안내',
            text: `안녕하세요, KYC가 승인되었습니다. 레벨: ${level}`,
            html: `<p>안녕하세요,</p><p>KYC가 승인되었습니다. 레벨: <b>${level}</b></p>`,
          });
        }
      } catch (e) {
        logger.warn('KYC 승인 이메일 발송 실패:', e.message);
      }

      res.status(200).json({
        success: true,
        data: result,
        message: 'KYC가 승인되었습니다.',
      });
    } catch (error) {
      logger.error('KYC 승인 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'KYC 승인 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * KYC 거부
   */
  async rejectKYC(req, res) {
    try {
      const { userId } = req.params;
      const { reason, notifyEmail } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: '거부 사유는 필수입니다.',
        });
      }

      // 사용자 인증 정보 조회
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
      });

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: '사용자 인증 정보를 찾을 수 없습니다.',
        });
      }

      // 트랜잭션으로 거부 처리
      await prisma.$transaction(async tx => {
        // 인증 상태 업데이트
        await tx.userVerification.update({
          where: { userId },
          data: {
            verificationStatus: 'REJECTED',
            rejectionReason: reason,
          },
        });

        // 사용자 KYC 상태 업데이트
        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: 'REJECTED' },
        });

        // 화이트리스트에서 제거 (있는 경우)
        await tx.whitelistEntry.deleteMany({
          where: { userId },
        });
      });

      logger.info(`KYC 거부 완료: ${userId} by ${adminId} - ${reason}`);

      // 이메일 알림
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (notifyEmail && user?.email) {
          await sendMail({
            to: user.email,
            subject: '[HomeSure] KYC 거절 안내',
            text: `안녕하세요, 제출하신 KYC가 거절되었습니다. 사유: ${reason}`,
            html: `<p>안녕하세요,</p><p>제출하신 KYC가 거절되었습니다.</p><p>사유: <b>${reason}</b></p>`,
          });
        }
      } catch (e) {
        logger.warn('KYC 거절 이메일 발송 실패:', e.message);
      }

      res.status(200).json({
        success: true,
        message: 'KYC가 거부되었습니다.',
      });
    } catch (error) {
      logger.error('KYC 거부 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'KYC 거부 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * KYC 일시정지
   */
  async suspendKYC(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: '일시정지 사유는 필수입니다.',
        });
      }

      // 트랜잭션으로 일시정지 처리
      await prisma.$transaction(async tx => {
        // 인증 상태 업데이트
        await tx.userVerification.update({
          where: { userId },
          data: {
            verificationStatus: 'SUSPENDED',
            rejectionReason: reason,
          },
        });

        // 사용자 KYC 상태 업데이트
        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: 'SUSPENDED' },
        });

        // 화이트리스트 상태 업데이트
        await tx.whitelistEntry.updateMany({
          where: { userId },
          data: { status: 'SUSPENDED' },
        });
      });

      logger.info(`KYC 일시정지 완료: ${userId} by ${adminId} - ${reason}`);

      res.status(200).json({
        success: true,
        message: 'KYC가 일시정지되었습니다.',
      });
    } catch (error) {
      logger.error('KYC 일시정지 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'KYC 일시정지 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 알림 목록 조회
   */
  async getAMLAlerts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        severity,
        isResolved,
        alertType,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // 필터 조건 구성
      const where = {};
      if (severity && severity !== 'ALL') {
        where.severity = severity;
      }
      if (isResolved !== undefined) {
        where.isResolved = isResolved === 'true';
      }
      if (alertType && alertType !== 'ALL') {
        where.alertType = alertType;
      }

      // AML 알림 조회
      const [alerts, total] = await Promise.all([
        prisma.aMLAlert.findMany({
          where,
          include: {
            transaction: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    walletAddress: true,
                  },
                },
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: parseInt(limit),
        }),
        prisma.aMLAlert.count({ where }),
      ]);

      // 응답 데이터 구성
      const formattedAlerts = alerts.map(alert => ({
        id: alert.id,
        transactionId: alert.transactionId,
        userId: alert.transaction.userId,
        userAddress: alert.transaction.user.walletAddress,
        userName:
          `${alert.transaction.user.firstName || ''} ${alert.transaction.user.lastName || ''}`.trim(),
        alertType: alert.alertType,
        severity: alert.severity,
        description: alert.description,
        riskScore: alert.riskScore,
        amount: alert.transaction.amount,
        isResolved: alert.isResolved,
        resolvedBy: alert.resolvedBy,
        resolvedAt: alert.resolvedAt,
        resolution: alert.resolution,
        createdAt: alert.createdAt,
      }));

      res.status(200).json({
        success: true,
        data: {
          alerts: formattedAlerts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
        message: 'AML 알림 목록을 조회했습니다.',
      });
    } catch (error) {
      logger.error('AML 알림 목록 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'AML 알림 목록 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 통계 조회
   */
  async getAMLStats(req, res) {
    try {
      const [
        totalAlerts,
        pendingAlerts,
        resolvedAlerts,
        criticalAlerts,
        highRiskAlerts,
        totalTransactions,
        flaggedTransactions,
        blockedTransactions,
      ] = await Promise.all([
        prisma.aMLAlert.count(),
        prisma.aMLAlert.count({ where: { isResolved: false } }),
        prisma.aMLAlert.count({ where: { isResolved: true } }),
        prisma.aMLAlert.count({ where: { severity: 'CRITICAL' } }),
        prisma.aMLAlert.count({ where: { severity: 'HIGH' } }),
        prisma.aMLTransaction.count(),
        prisma.aMLTransaction.count({ where: { isFlagged: true } }),
        prisma.aMLTransaction.count({ where: { isBlocked: true } }),
      ]);

      // 평균 위험도 점수 계산
      const avgRiskScore = await prisma.aMLTransaction.aggregate({
        _avg: { riskScore: true },
      });

      const stats = {
        totalAlerts,
        pendingAlerts,
        resolvedAlerts,
        criticalAlerts,
        highRiskAlerts,
        totalTransactions,
        flaggedTransactions,
        blockedTransactions,
        averageRiskScore: avgRiskScore._avg.riskScore || 0,
        resolutionRate: totalAlerts > 0 ? ((resolvedAlerts / totalAlerts) * 100).toFixed(2) : 0,
      };

      res.status(200).json({
        success: true,
        data: stats,
        message: 'AML 통계를 조회했습니다.',
      });
    } catch (error) {
      logger.error('AML 통계 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'AML 통계 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 알림 해결
   */
  async resolveAMLAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { resolution } = req.body;
      const adminId = req.user.id;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          message: '해결 내용은 필수입니다.',
        });
      }

      const alert = await prisma.aMLAlert.update({
        where: { id: alertId },
        data: {
          isResolved: true,
          resolvedBy: adminId,
          resolvedAt: new Date(),
          resolution,
        },
      });

      logger.info(`AML 알림 해결 완료: ${alertId} by ${adminId}`);

      res.status(200).json({
        success: true,
        data: alert,
        message: 'AML 알림이 해결되었습니다.',
      });
    } catch (error) {
      logger.error('AML 알림 해결 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'AML 알림 해결 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * 화이트리스트 관리
   */
  async getWhitelist(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {};
      if (status && status !== 'ALL') {
        where.status = status;
      }

      const [entries, total] = await Promise.all([
        prisma.whitelistEntry.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                walletAddress: true,
              },
            },
            verification: {
              select: {
                verificationStatus: true,
                verificationDate: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.whitelistEntry.count({ where }),
      ]);

      const formattedEntries = entries.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        userAddress: entry.user.walletAddress,
        userName: `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim(),
        status: entry.status,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt,
        reason: entry.reason,
        expiresAt: entry.expiresAt,
        verificationStatus: entry.verification.verificationStatus,
        createdAt: entry.createdAt,
      }));

      res.status(200).json({
        success: true,
        data: {
          entries: formattedEntries,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
        message: '화이트리스트를 조회했습니다.',
      });
    } catch (error) {
      logger.error('화이트리스트 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '화이트리스트 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * 대시보드 개요 조회
   */
  async getDashboardOverview(req, res) {
    try {
      const [kycStats, amlStats, whitelistStats, recentAlerts, recentVerifications] =
        await Promise.all([
          this.getKYCStatsInternal(),
          this.getAMLStatsInternal(),
          this.getWhitelistStatsInternal(),
          prisma.aMLAlert.findMany({
            where: { isResolved: false },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              transaction: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.userVerification.findMany({
            where: { verificationStatus: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          }),
        ]);

      const overview = {
        kyc: kycStats,
        aml: amlStats,
        whitelist: whitelistStats,
        recentAlerts: recentAlerts.map(alert => ({
          id: alert.id,
          type: alert.alertType,
          severity: alert.severity,
          description: alert.description,
          userName:
            `${alert.transaction.user.firstName || ''} ${alert.transaction.user.lastName || ''}`.trim(),
          createdAt: alert.createdAt,
        })),
        recentVerifications: recentVerifications.map(verification => ({
          id: verification.id,
          userName:
            `${verification.user.firstName || ''} ${verification.user.lastName || ''}`.trim(),
          email: verification.user.email,
          createdAt: verification.createdAt,
        })),
      };

      res.status(200).json({
        success: true,
        data: overview,
        message: '대시보드 개요를 조회했습니다.',
      });
    } catch (error) {
      logger.error('대시보드 개요 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '대시보드 개요 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  // 내부 메서드들
  async getKYCStatsInternal() {
    const [total, pending, approved, rejected, whitelisted] = await Promise.all([
      prisma.userVerification.count(),
      prisma.userVerification.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.userVerification.count({ where: { verificationStatus: 'APPROVED' } }),
      prisma.userVerification.count({ where: { verificationStatus: 'REJECTED' } }),
      prisma.whitelistEntry.count({ where: { status: 'ACTIVE' } }),
    ]);

    return { total, pending, approved, rejected, whitelisted };
  }

  async getAMLStatsInternal() {
    const [totalAlerts, pendingAlerts, criticalAlerts, totalTransactions, flaggedTransactions] =
      await Promise.all([
        prisma.aMLAlert.count(),
        prisma.aMLAlert.count({ where: { isResolved: false } }),
        prisma.aMLAlert.count({ where: { severity: 'CRITICAL' } }),
        prisma.aMLTransaction.count(),
        prisma.aMLTransaction.count({ where: { isFlagged: true } }),
      ]);

    return { totalAlerts, pendingAlerts, criticalAlerts, totalTransactions, flaggedTransactions };
  }

  async getWhitelistStatsInternal() {
    const [total, active, suspended] = await Promise.all([
      prisma.whitelistEntry.count(),
      prisma.whitelistEntry.count({ where: { status: 'ACTIVE' } }),
      prisma.whitelistEntry.count({ where: { status: 'SUSPENDED' } }),
    ]);

    return { total, active, suspended };
  }

  // 나머지 메서드들은 기본 구현
  async getKYCUserDetails(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getKYCAuditLogs(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async submitAMLReport(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getAMLTransactions(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getUserAMLTransactions(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async addToWhitelist(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async removeFromWhitelist(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getWhitelistStats(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getRealtimeData(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getNotifications(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getAdminSettings(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async updateAdminSettings(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }

  async getAdminAuditLogs(req, res) {
    // TODO: 구현
    res.status(501).json({ success: false, message: '구현 예정' });
  }
}

module.exports = new AdminController();
