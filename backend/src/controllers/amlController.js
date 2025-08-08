const amlService = require('../services/amlService');
const logger = require('../utils/logger');

class AMLController {
  /**
   * 거래 위험도 분석
   */
  async analyzeTransaction(req, res) {
    try {
      const transaction = req.body;

      // 필수 필드 검증
      if (!transaction.transactionId || !transaction.userId || !transaction.amount) {
        return res.status(400).json({
          success: false,
          message: '거래 ID, 사용자 ID, 거래 금액은 필수입니다.',
        });
      }

      // 거래 위험도 분석
      const analysis = await amlService.analyzeTransactionRisk(transaction);

      // 알림 생성 (필요한 경우)
      let alert = null;
      if (analysis.isFlagged) {
        alert = await amlService.createAlert(transaction, analysis);
      }

      logger.info(
        `AML 거래 분석 완료: ${transaction.transactionId}, 위험도: ${analysis.riskScore}`
      );

      res.status(200).json({
        success: true,
        data: {
          analysis,
          alert,
          shouldBlock: amlService.shouldBlockTransaction(analysis),
        },
        message: '거래 위험도 분석이 완료되었습니다.',
      });
    } catch (error) {
      logger.error('AML 거래 분석 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '거래 위험도 분석 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 알림 목록 조회
   */
  async getAlerts(req, res) {
    try {
      const { page = 1, limit = 10, severity, isResolved } = req.query;

      // TODO: 데이터베이스에서 조회
      const mockAlerts = [
        {
          id: 'alert_1',
          transactionId: 'tx1',
          userId: 'user1',
          alertType: 'HIGH_VALUE_TRANSACTION',
          severity: 'MEDIUM',
          description: '위험도 점수 65점: 거래 금액이 임계값(10000 USD)을 초과합니다.',
          riskScore: 65,
          isResolved: false,
          createdAt: new Date(),
        },
      ];

      // 필터링
      let filteredAlerts = mockAlerts;
      if (severity) {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
      }
      if (isResolved !== undefined) {
        filteredAlerts = filteredAlerts.filter(
          alert => alert.isResolved === (isResolved === 'true')
        );
      }

      res.status(200).json({
        success: true,
        data: {
          alerts: filteredAlerts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredAlerts.length,
          },
        },
        message: 'AML 알림 목록을 조회했습니다.',
      });
    } catch (error) {
      logger.error('AML 알림 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'AML 알림 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 알림 해결
   */
  async resolveAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { resolution, resolvedBy } = req.body;

      if (!alertId) {
        return res.status(400).json({
          success: false,
          message: '알림 ID가 필요합니다.',
        });
      }

      // TODO: 데이터베이스에서 알림 업데이트
      logger.info(`AML 알림 해결: ${alertId} by ${resolvedBy}`);

      res.status(200).json({
        success: true,
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
   * AML 리포트 생성
   */
  async generateReport(req, res) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30일 전
      const end = endDate ? new Date(endDate) : new Date();

      const report = await amlService.generateAMLReport(userId, start, end);

      res.status(200).json({
        success: true,
        data: report,
        message: 'AML 리포트가 생성되었습니다.',
      });
    } catch (error) {
      logger.error('AML 리포트 생성 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'AML 리포트 생성 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * 규제 당국 신고
   */
  async submitRegulatoryReport(req, res) {
    try {
      const { alertId } = req.params;

      if (!alertId) {
        return res.status(400).json({
          success: false,
          message: '알림 ID가 필요합니다.',
        });
      }

      // TODO: 데이터베이스에서 알림 조회
      const mockAlert = {
        id: alertId,
        userId: 'user1',
        transactionId: 'tx1',
        severity: 'HIGH',
        description: '의심스러운 거래 패턴',
        riskScore: 75,
      };

      const report = await amlService.generateRegulatoryReport(mockAlert);

      logger.info(`규제 당국 신고 제출: ${report.reportId}`);

      res.status(200).json({
        success: true,
        data: report,
        message: '규제 당국에 신고가 제출되었습니다.',
      });
    } catch (error) {
      logger.error('규제 당국 신고 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '규제 당국 신고 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 통계 조회
   */
  async getAMLStats(req, res) {
    try {
      const { period = '30d' } = req.query;

      // TODO: 데이터베이스에서 통계 조회
      const stats = {
        totalTransactions: 1250,
        flaggedTransactions: 45,
        blockedTransactions: 12,
        averageRiskScore: 23.5,
        alertsBySeverity: {
          CRITICAL: 3,
          HIGH: 15,
          MEDIUM: 27,
          LOW: 0,
        },
        alertsByType: {
          HIGH_VALUE_TRANSACTION: 20,
          FREQUENT_TRANSACTIONS: 12,
          STRUCTURED_TRANSACTION: 8,
          GEOGRAPHIC_RISK: 5,
        },
        period,
        lastUpdated: new Date(),
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
   * 사용자 위험도 점수 조회
   */
  async getUserRiskScore(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      // TODO: 데이터베이스에서 사용자 위험도 점수 조회
      const riskScore = Math.floor(Math.random() * 100); // 시뮬레이션
      const riskLevel = amlService.determineRiskLevel(riskScore);

      res.status(200).json({
        success: true,
        data: {
          userId,
          riskScore,
          riskLevel,
          lastUpdated: new Date(),
        },
        message: '사용자 위험도 점수를 조회했습니다.',
      });
    } catch (error) {
      logger.error('사용자 위험도 점수 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '사용자 위험도 점수 조회 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }

  /**
   * AML 규칙 설정 업데이트
   */
  async updateAMLRules(req, res) {
    try {
      const { rules } = req.body;

      if (!rules) {
        return res.status(400).json({
          success: false,
          message: 'AML 규칙이 필요합니다.',
        });
      }

      // TODO: 데이터베이스에 규칙 저장
      logger.info('AML 규칙 업데이트:', rules);

      res.status(200).json({
        success: true,
        message: 'AML 규칙이 업데이트되었습니다.',
      });
    } catch (error) {
      logger.error('AML 규칙 업데이트 실패:', error.message);
      res.status(500).json({
        success: false,
        message: 'AML 규칙 업데이트 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  }
}

module.exports = new AMLController();
