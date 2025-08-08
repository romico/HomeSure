const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const blockchainConfig = require('../config/blockchain');

const prisma = new PrismaClient();

class AMLService {
  constructor() {
    // API 설정
    this.ofacApiKey = process.env.OFAC_API_KEY || 'test_ofac_key';
    this.unSanctionsApiKey = process.env.UN_SANCTIONS_API_KEY || 'test_un_key';
    this.chainalysisApiKey = process.env.CHAINALYSIS_API_KEY || 'test_chainalysis_key';
    
    // 시뮬레이션 모드 (개발용)
    this.simulationMode = process.env.NODE_ENV === 'development';
    
    // 위험도 점수 기준
    this.riskThresholds = {
      LOW: 0.3,
      MEDIUM: 0.6,
      HIGH: 0.8
    };
    
    // 거래 패턴 분석 설정
    this.patternAnalysis = {
      suspiciousPatterns: [
        'structuring', // 구조화 (대금을 작은 금액으로 나누어 거래)
        'layering', // 레이어링 (복잡한 거래 구조로 자금 출처 은폐)
        'integration', // 통합 (합법적 비즈니스에 불법 자금 혼입)
        'rapidMovement', // 급속한 자금 이동
        'highValue', // 고액 거래
        'unusualTiming', // 비정상적인 거래 시간
        'geographicRisk' // 고위험 지역 거래
      ],
      thresholds: {
        structuring: { amount: 10000, count: 5, timeWindow: 24 * 60 * 60 * 1000 }, // 24시간 내 5회 이상, 총 10,000 이상
        layering: { depth: 3, timeWindow: 60 * 60 * 1000 }, // 1시간 내 3단계 이상 거래
        rapidMovement: { timeWindow: 5 * 60 * 1000, amount: 50000 }, // 5분 내 50,000 이상
        highValue: { amount: 100000 }, // 100,000 이상 단일 거래
        unusualTiming: { startHour: 22, endHour: 6 }, // 오후 10시 ~ 오전 6시
        geographicRisk: { riskCountries: ['IR', 'KP', 'CU', 'VE', 'SY'] }
      }
    };
  }

  /**
   * 사용자 AML 체크
   * @param {string} walletAddress - 지갑 주소
   * @param {Object} userData - 사용자 정보
   * @returns {Object} AML 체크 결과
   */
  async performUserAMLCheck(walletAddress, userData) {
    try {
      logger.info(`AML 체크 시작: ${walletAddress}`);

      const checks = await Promise.allSettled([
        this.checkSanctionsList(walletAddress, userData),
        this.checkRiskScore(walletAddress),
        this.analyzeTransactionPatterns(walletAddress),
        this.checkGeographicRisk(userData)
      ]);

      const results = checks.map(check => 
        check.status === 'fulfilled' ? check.value : { success: false, error: check.reason.message }
      );

      const overallRisk = this.calculateOverallRisk(results);
      const isFlagged = overallRisk >= this.riskThresholds.HIGH;

      // AML 체크 결과 저장
      await prisma.aMLTransaction.create({
        data: {
          walletAddress,
          checkType: 'USER_VERIFICATION',
          riskScore: overallRisk,
          isFlagged,
          checkResults: results,
          metadata: {
            userData,
            timestamp: new Date()
          }
        }
      });

      return {
        success: true,
        walletAddress,
        riskScore: overallRisk,
        riskLevel: this.getRiskLevel(overallRisk),
        isFlagged,
        checks: results,
        recommendations: this.generateRecommendations(results, overallRisk)
      };

    } catch (error) {
      logger.error('AML 체크 실패:', error.message);
      throw new Error(`AML 체크 실패: ${error.message}`);
    }
  }

  /**
   * 거래 AML 체크
   * @param {Object} transactionData - 거래 데이터
   * @returns {Object} 거래 AML 체크 결과
   */
  async performTransactionAMLCheck(transactionData) {
    try {
      const { fromAddress, toAddress, amount, propertyId } = transactionData;
      
      logger.info(`거래 AML 체크: ${fromAddress} -> ${toAddress}, ${amount}`);

      const checks = await Promise.allSettled([
        this.checkAddressSanctions(fromAddress),
        this.checkAddressSanctions(toAddress),
        this.checkTransactionAmount(amount),
        this.checkTransactionPattern(fromAddress, toAddress, amount),
        this.checkPropertyRisk(propertyId)
      ]);

      const results = checks.map(check => 
        check.status === 'fulfilled' ? check.value : { success: false, error: check.reason.message }
      );

      const overallRisk = this.calculateOverallRisk(results);
      const isFlagged = overallRisk >= this.riskThresholds.MEDIUM;

      // 거래 AML 체크 결과 저장
      await prisma.aMLTransaction.create({
        data: {
          walletAddress: fromAddress,
          checkType: 'TRANSACTION',
          riskScore: overallRisk,
          isFlagged,
          checkResults: results,
          metadata: {
            transactionData,
            timestamp: new Date()
          }
        }
      });

      return {
        success: true,
        transactionId: transactionData.transactionId,
        riskScore: overallRisk,
        riskLevel: this.getRiskLevel(overallRisk),
        isFlagged,
        checks: results,
        shouldBlock: isFlagged,
        recommendations: this.generateRecommendations(results, overallRisk)
      };

    } catch (error) {
      logger.error('거래 AML 체크 실패:', error.message);
      throw new Error(`거래 AML 체크 실패: ${error.message}`);
    }
  }

  /**
   * 제재 리스트 체크
   * @param {string} walletAddress - 지갑 주소
   * @param {Object} userData - 사용자 정보
   * @returns {Object} 제재 리스트 체크 결과
   */
  async checkSanctionsList(walletAddress, userData) {
    try {
      if (this.simulationMode) {
        // 시뮬레이션: 5% 확률로 제재 대상
        const isSanctioned = Math.random() < 0.05;
        
        return {
          success: true,
          checkType: 'SANCTIONS_LIST',
          isSanctioned,
          riskScore: isSanctioned ? 1.0 : 0.0,
          details: isSanctioned ? {
            list: 'OFAC_SDN',
            reason: 'Specially Designated Nationals',
            dateAdded: '2023-01-15'
          } : null
        };
      }

      // OFAC SDN 리스트 체크
      const ofacResult = await this.checkOFACList(walletAddress, userData);
      
      // UN 제재 리스트 체크
      const unResult = await this.checkUNSanctionsList(walletAddress, userData);
      
      // EU 제재 리스트 체크
      const euResult = await this.checkEUSanctionsList(walletAddress, userData);

      const isSanctioned = ofacResult.isSanctioned || unResult.isSanctioned || euResult.isSanctioned;
      const riskScore = isSanctioned ? 1.0 : Math.max(ofacResult.riskScore, unResult.riskScore, euResult.riskScore);

      return {
        success: true,
        checkType: 'SANCTIONS_LIST',
        isSanctioned,
        riskScore,
        details: {
          ofac: ofacResult,
          un: unResult,
          eu: euResult
        }
      };

    } catch (error) {
      logger.error('제재 리스트 체크 실패:', error.message);
      return {
        success: false,
        checkType: 'SANCTIONS_LIST',
        error: error.message,
        riskScore: 0.5 // 에러 시 중간 위험도
      };
    }
  }

  /**
   * 주소별 제재 리스트 체크
   * @param {string} address - 주소
   * @returns {Object} 제재 리스트 체크 결과
   */
  async checkAddressSanctions(address) {
    try {
      if (this.simulationMode) {
        // 시뮬레이션: 2% 확률로 제재 대상
        const isSanctioned = Math.random() < 0.02;
        
        return {
          success: true,
          checkType: 'ADDRESS_SANCTIONS',
          address,
          isSanctioned,
          riskScore: isSanctioned ? 1.0 : 0.0
        };
      }

      // Chainalysis API를 통한 주소 체크
      const response = await axios.get(
        `https://api.chainalysis.com/api/risk/v2/entities/${address}`,
        {
          headers: {
            'Token': this.chainalysisApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const riskScore = response.data.risk || 0.0;
      const isSanctioned = riskScore >= 0.8;

      return {
        success: true,
        checkType: 'ADDRESS_SANCTIONS',
        address,
        isSanctioned,
        riskScore,
        details: response.data
      };

    } catch (error) {
      logger.error('주소 제재 리스트 체크 실패:', error.message);
      return {
        success: false,
        checkType: 'ADDRESS_SANCTIONS',
        address,
        error: error.message,
        riskScore: 0.3
      };
    }
  }

  /**
   * 위험도 점수 계산
   * @param {string} walletAddress - 지갑 주소
   * @returns {Object} 위험도 점수 결과
   */
  async checkRiskScore(walletAddress) {
    try {
      if (this.simulationMode) {
        // 시뮬레이션: 랜덤 위험도 점수
        const riskScore = Math.random();
        
        return {
          success: true,
          checkType: 'RISK_SCORE',
          riskScore,
          factors: {
            transactionHistory: Math.random() * 0.3,
            geographicRisk: Math.random() * 0.2,
            behavioralRisk: Math.random() * 0.3,
            networkRisk: Math.random() * 0.2
          }
        };
      }

      // 거래 히스토리 분석
      const transactionHistory = await this.analyzeTransactionHistory(walletAddress);
      
      // 지리적 위험도 분석
      const geographicRisk = await this.analyzeGeographicRisk(walletAddress);
      
      // 행동 패턴 분석
      const behavioralRisk = await this.analyzeBehavioralPatterns(walletAddress);
      
      // 네트워크 위험도 분석
      const networkRisk = await this.analyzeNetworkRisk(walletAddress);

      const riskScore = (
        transactionHistory.riskScore * 0.3 +
        geographicRisk.riskScore * 0.2 +
        behavioralRisk.riskScore * 0.3 +
        networkRisk.riskScore * 0.2
      );

      return {
        success: true,
        checkType: 'RISK_SCORE',
        riskScore,
        factors: {
          transactionHistory,
          geographicRisk,
          behavioralRisk,
          networkRisk
        }
      };

    } catch (error) {
      logger.error('위험도 점수 계산 실패:', error.message);
      return {
        success: false,
        checkType: 'RISK_SCORE',
        error: error.message,
        riskScore: 0.5
      };
    }
  }

  /**
   * 거래 패턴 분석
   * @param {string} walletAddress - 지갑 주소
   * @returns {Object} 거래 패턴 분석 결과
   */
  async analyzeTransactionPatterns(walletAddress) {
    try {
      if (this.simulationMode) {
        // 시뮬레이션: 랜덤 패턴 분석
        const patterns = this.patternAnalysis.suspiciousPatterns.filter(() => Math.random() < 0.3);
        
        return {
          success: true,
          checkType: 'TRANSACTION_PATTERNS',
          detectedPatterns: patterns,
          riskScore: patterns.length * 0.2,
          details: patterns.map(pattern => ({
            pattern,
            confidence: Math.random() * 0.5 + 0.5,
            description: `Detected ${pattern} pattern`
          }))
        };
      }

      // 최근 거래 내역 조회
      const recentTransactions = await prisma.trade.findMany({
        where: {
          OR: [
            { buyerAddress: walletAddress },
            { sellerAddress: walletAddress }
          ],
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30일
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const detectedPatterns = [];
      let totalRiskScore = 0;

      // 구조화 패턴 체크
      const structuringResult = this.detectStructuringPattern(recentTransactions, walletAddress);
      if (structuringResult.detected) {
        detectedPatterns.push({
          pattern: 'structuring',
          confidence: structuringResult.confidence,
          description: structuringResult.description
        });
        totalRiskScore += 0.3;
      }

      // 레이어링 패턴 체크
      const layeringResult = this.detectLayeringPattern(recentTransactions, walletAddress);
      if (layeringResult.detected) {
        detectedPatterns.push({
          pattern: 'layering',
          confidence: layeringResult.confidence,
          description: layeringResult.description
        });
        totalRiskScore += 0.4;
      }

      // 급속한 자금 이동 체크
      const rapidMovementResult = this.detectRapidMovementPattern(recentTransactions, walletAddress);
      if (rapidMovementResult.detected) {
        detectedPatterns.push({
          pattern: 'rapidMovement',
          confidence: rapidMovementResult.confidence,
          description: rapidMovementResult.description
        });
        totalRiskScore += 0.2;
      }

      return {
        success: true,
        checkType: 'TRANSACTION_PATTERNS',
        detectedPatterns,
        riskScore: Math.min(totalRiskScore, 1.0),
        details: {
          totalTransactions: recentTransactions.length,
          analysisPeriod: '30 days',
          patterns: detectedPatterns
        }
      };

    } catch (error) {
      logger.error('거래 패턴 분석 실패:', error.message);
      return {
        success: false,
        checkType: 'TRANSACTION_PATTERNS',
        error: error.message,
        riskScore: 0.3
      };
    }
  }

  /**
   * 지리적 위험도 체크
   * @param {Object} userData - 사용자 정보
   * @returns {Object} 지리적 위험도 체크 결과
   */
  async checkGeographicRisk(userData) {
    try {
      if (this.simulationMode) {
        // 시뮬레이션: 10% 확률로 고위험 지역
        const isHighRisk = Math.random() < 0.1;
        
        return {
          success: true,
          checkType: 'GEOGRAPHIC_RISK',
          isHighRisk,
          riskScore: isHighRisk ? 0.8 : 0.1,
          details: isHighRisk ? {
            country: 'IR',
            riskLevel: 'HIGH',
            reason: 'Sanctioned country'
          } : {
            country: 'KR',
            riskLevel: 'LOW',
            reason: 'Low risk country'
          }
        };
      }

      const country = userData.country || 'KR';
      const isHighRiskCountry = this.patternAnalysis.thresholds.geographicRisk.riskCountries.includes(country);
      
      return {
        success: true,
        checkType: 'GEOGRAPHIC_RISK',
        isHighRisk: isHighRiskCountry,
        riskScore: isHighRiskCountry ? 0.8 : 0.1,
        details: {
          country,
          riskLevel: isHighRiskCountry ? 'HIGH' : 'LOW',
          reason: isHighRiskCountry ? 'Sanctioned country' : 'Low risk country'
        }
      };

    } catch (error) {
      logger.error('지리적 위험도 체크 실패:', error.message);
      return {
        success: false,
        checkType: 'GEOGRAPHIC_RISK',
        error: error.message,
        riskScore: 0.3
      };
    }
  }

  /**
   * 거래 금액 체크
   * @param {number} amount - 거래 금액
   * @returns {Object} 거래 금액 체크 결과
   */
  async checkTransactionAmount(amount) {
    try {
      const highValueThreshold = this.patternAnalysis.thresholds.highValue.amount;
      const isHighValue = amount >= highValueThreshold;
      
      return {
        success: true,
        checkType: 'TRANSACTION_AMOUNT',
        isHighValue,
        riskScore: isHighValue ? 0.6 : 0.1,
        details: {
          amount,
          threshold: highValueThreshold,
          riskLevel: isHighValue ? 'MEDIUM' : 'LOW'
        }
      };

    } catch (error) {
      logger.error('거래 금액 체크 실패:', error.message);
      return {
        success: false,
        checkType: 'TRANSACTION_AMOUNT',
        error: error.message,
        riskScore: 0.3
      };
    }
  }

  /**
   * 거래 패턴 체크
   * @param {string} fromAddress - 송금 주소
   * @param {string} toAddress - 수신 주소
   * @param {number} amount - 거래 금액
   * @returns {Object} 거래 패턴 체크 결과
   */
  async checkTransactionPattern(fromAddress, toAddress, amount) {
    try {
      // 동일 주소 간 거래 체크
      const isSelfTransaction = fromAddress.toLowerCase() === toAddress.toLowerCase();
      
      // 고액 거래 체크
      const isHighValue = amount >= this.patternAnalysis.thresholds.highValue.amount;
      
      // 비정상적인 시간 체크
      const currentHour = new Date().getHours();
      const isUnusualTime = currentHour >= this.patternAnalysis.thresholds.unusualTiming.startHour || 
                           currentHour <= this.patternAnalysis.thresholds.unusualTiming.endHour;

      let riskScore = 0.0;
      const flags = [];

      if (isSelfTransaction) {
        riskScore += 0.3;
        flags.push('SELF_TRANSACTION');
      }

      if (isHighValue) {
        riskScore += 0.4;
        flags.push('HIGH_VALUE');
      }

      if (isUnusualTime) {
        riskScore += 0.2;
        flags.push('UNUSUAL_TIMING');
      }

      return {
        success: true,
        checkType: 'TRANSACTION_PATTERN',
        riskScore: Math.min(riskScore, 1.0),
        flags,
        details: {
          isSelfTransaction,
          isHighValue,
          isUnusualTime,
          currentHour
        }
      };

    } catch (error) {
      logger.error('거래 패턴 체크 실패:', error.message);
      return {
        success: false,
        checkType: 'TRANSACTION_PATTERN',
        error: error.message,
        riskScore: 0.3
      };
    }
  }

  /**
   * 부동산 위험도 체크
   * @param {number} propertyId - 부동산 ID
   * @returns {Object} 부동산 위험도 체크 결과
   */
  async checkPropertyRisk(propertyId) {
    try {
      // 부동산 정보 조회
      const property = await prisma.property.findUnique({
        where: { propertyId }
      });

      if (!property) {
        return {
          success: true,
          checkType: 'PROPERTY_RISK',
          riskScore: 0.5,
          details: {
            reason: 'Property not found'
          }
        };
      }

      // 부동산 가치 대비 거래 금액 체크
      const propertyValue = parseFloat(property.value);
      const transactionAmount = parseFloat(property.currentPrice || property.value);
      const valueRatio = transactionAmount / propertyValue;

      let riskScore = 0.0;
      const flags = [];

      if (valueRatio > 2.0) {
        riskScore += 0.4;
        flags.push('OVER_VALUED');
      }

      if (valueRatio < 0.5) {
        riskScore += 0.3;
        flags.push('UNDER_VALUED');
      }

      return {
        success: true,
        checkType: 'PROPERTY_RISK',
        riskScore: Math.min(riskScore, 1.0),
        flags,
        details: {
          propertyValue,
          transactionAmount,
          valueRatio,
          propertyLocation: property.location
        }
      };

    } catch (error) {
      logger.error('부동산 위험도 체크 실패:', error.message);
      return {
        success: false,
        checkType: 'PROPERTY_RISK',
        error: error.message,
        riskScore: 0.3
      };
    }
  }

  // 헬퍼 메서드들
  calculateOverallRisk(results) {
    const validResults = results.filter(result => result.success);
    if (validResults.length === 0) return 0.5;

    const totalRisk = validResults.reduce((sum, result) => sum + (result.riskScore || 0), 0);
    return totalRisk / validResults.length;
  }

  getRiskLevel(riskScore) {
    if (riskScore >= this.riskThresholds.HIGH) return 'HIGH';
    if (riskScore >= this.riskThresholds.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  generateRecommendations(results, overallRisk) {
    const recommendations = [];

    if (overallRisk >= this.riskThresholds.HIGH) {
      recommendations.push('거래를 즉시 중단하고 관리자에게 보고하세요.');
      recommendations.push('추가적인 신원 확인이 필요합니다.');
    } else if (overallRisk >= this.riskThresholds.MEDIUM) {
      recommendations.push('거래를 주의 깊게 모니터링하세요.');
      recommendations.push('추가 문서 검증을 고려하세요.');
    }

    results.forEach(result => {
      if (result.success && result.riskScore > 0.7) {
        recommendations.push(`${result.checkType} 검증을 강화하세요.`);
      }
    });

    return recommendations;
  }

  detectStructuringPattern(transactions, walletAddress) {
    // 구조화 패턴 감지 로직
    const timeWindow = this.patternAnalysis.thresholds.structuring.timeWindow;
    const amountThreshold = this.patternAnalysis.thresholds.structuring.amount;
    const countThreshold = this.patternAnalysis.thresholds.structuring.count;

    const recentTransactions = transactions.filter(tx => 
      Date.now() - new Date(tx.createdAt).getTime() <= timeWindow
    );

    const totalAmount = recentTransactions.reduce((sum, tx) => {
      const amount = tx.buyerAddress === walletAddress ? tx.totalAmount : 0;
      return sum + parseFloat(amount);
    }, 0);

    const detected = recentTransactions.length >= countThreshold && totalAmount >= amountThreshold;

    return {
      detected,
      confidence: detected ? 0.8 : 0.0,
      description: detected ? 
        `${recentTransactions.length} transactions totaling ${totalAmount} within 24 hours` : 
        'No structuring pattern detected'
    };
  }

  detectLayeringPattern(transactions, walletAddress) {
    // 레이어링 패턴 감지 로직
    const timeWindow = this.patternAnalysis.thresholds.layering.timeWindow;
    const depthThreshold = this.patternAnalysis.thresholds.layering.depth;

    const recentTransactions = transactions.filter(tx => 
      Date.now() - new Date(tx.createdAt).getTime() <= timeWindow
    );

    // 거래 체인 깊이 계산
    const transactionChain = this.calculateTransactionChain(recentTransactions, walletAddress);
    const detected = transactionChain.length >= depthThreshold;

    return {
      detected,
      confidence: detected ? 0.7 : 0.0,
      description: detected ? 
        `Transaction chain depth of ${transactionChain.length} within 1 hour` : 
        'No layering pattern detected'
    };
  }

  detectRapidMovementPattern(transactions, walletAddress) {
    // 급속한 자금 이동 패턴 감지 로직
    const timeWindow = this.patternAnalysis.thresholds.rapidMovement.timeWindow;
    const amountThreshold = this.patternAnalysis.thresholds.rapidMovement.amount;

    const recentTransactions = transactions.filter(tx => 
      Date.now() - new Date(tx.createdAt).getTime() <= timeWindow
    );

    const totalAmount = recentTransactions.reduce((sum, tx) => {
      const amount = tx.buyerAddress === walletAddress ? tx.totalAmount : 0;
      return sum + parseFloat(amount);
    }, 0);

    const detected = totalAmount >= amountThreshold;

    return {
      detected,
      confidence: detected ? 0.6 : 0.0,
      description: detected ? 
        `Rapid movement of ${totalAmount} within 5 minutes` : 
        'No rapid movement pattern detected'
    };
  }

  calculateTransactionChain(transactions, walletAddress) {
    // 거래 체인 계산 로직 (간단한 구현)
    return transactions.filter(tx => 
      tx.buyerAddress === walletAddress || tx.sellerAddress === walletAddress
    );
  }

  // API 호출 메서드들 (실제 구현 필요)
  async checkOFACList(walletAddress, userData) {
    // OFAC API 호출 구현
    throw new Error('OFAC API not implemented');
  }

  async checkUNSanctionsList(walletAddress, userData) {
    // UN 제재 리스트 API 호출 구현
    throw new Error('UN Sanctions API not implemented');
  }

  async checkEUSanctionsList(walletAddress, userData) {
    // EU 제재 리스트 API 호출 구현
    throw new Error('EU Sanctions API not implemented');
  }

  async analyzeTransactionHistory(walletAddress) {
    // 거래 히스토리 분석 구현
    throw new Error('Transaction history analysis not implemented');
  }

  async analyzeGeographicRisk(walletAddress) {
    // 지리적 위험도 분석 구현
    throw new Error('Geographic risk analysis not implemented');
  }

  async analyzeBehavioralPatterns(walletAddress) {
    // 행동 패턴 분석 구현
    throw new Error('Behavioral pattern analysis not implemented');
  }

  async analyzeNetworkRisk(walletAddress) {
    // 네트워크 위험도 분석 구현
    throw new Error('Network risk analysis not implemented');
  }
}

module.exports = new AMLService(); 