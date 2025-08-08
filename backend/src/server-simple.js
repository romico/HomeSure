const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 기본 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'HomeSure Backend Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// KYC API 모킹
app.get('/api/kyc/whitelist/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;
  
  // 모의 데이터 반환
  res.json({
    success: true,
    data: {
      isVerified: false,
      kycLevel: 0,
      isBlacklisted: false,
      expiryDate: null,
      dailyLimit: 0,
      monthlyLimit: 0,
      walletAddress
    },
    message: 'KYC 상태 조회 완료'
  });
});

// 새로운 KYC API 엔드포인트들
app.get('/api/kyc/status/:userAddress', (req, res) => {
  const { userAddress } = req.params;
  
  // 모의 KYC 상태 데이터
  res.json({
    success: true,
    data: {
      isVerified: false,
      kycInfo: {
        userAddress,
        status: 'PENDING',
        level: 'BASIC',
        riskLevel: 'LOW',
        verificationDate: null,
        expiryDate: null,
        riskScore: '0',
        documentHash: '',
        verificationId: '',
        isActive: false,
        lastUpdated: new Date().toISOString(),
        verifiedBy: null,
        rejectionReason: '',
        dailyLimit: '0',
        monthlyLimit: '0',
        totalLimit: '0'
      }
    }
  });
});

app.post('/api/kyc/initiate', (req, res) => {
  const userData = req.body;
  
  // 모의 검증 결과
  const verificationId = `kyc_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  res.json({
    success: true,
    data: {
      verificationId,
      riskScore: Math.floor(Math.random() * 30) + 10, // 10-40
      riskLevel: 'LOW',
      kycLevel: 'BASIC',
      estimatedProcessingTime: '24-48 hours'
    }
  });
});

app.post('/api/kyc/transaction-risk', (req, res) => {
  const { userAddress, amount } = req.body;
  
  // 모의 위험도 평가
  const riskScore = Math.floor(Math.random() * 100);
  const isBlocked = riskScore > 80;
  
  res.json({
    success: true,
    data: {
      riskScore: riskScore.toString(),
      isBlocked,
      riskLevel: riskScore > 70 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW',
      recommendation: isBlocked ? 'TRANSACTION_BLOCKED' : 'APPROVED'
    }
  });
});

app.post('/api/kyc/whitelist/add', (req, res) => {
  const { userAddress } = req.body;
  
  res.json({
    success: true,
    data: { success: true }
  });
});

app.post('/api/kyc/blacklist/add', (req, res) => {
  const { userAddress, reason } = req.body;
  
  res.json({
    success: true,
    data: { success: true }
  });
});

app.post('/api/kyc/session', (req, res) => {
  const userData = req.body;
  
  // 모의 세션 생성
  const sessionId = `session_${Date.now()}`;
  
  res.json({
    success: true,
    data: {
      sessionId,
      kycLevel: 'BASIC',
      status: 'PENDING',
      estimatedProcessingTime: '24-48 hours',
      riskScore: Math.floor(Math.random() * 30) + 10,
      riskLevel: 'LOW'
    }
  });
});

app.get('/api/kyc/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { userAddress } = req.query;
  
  // 모의 검증 상태 (80% 확률로 승인)
  const isApproved = Math.random() > 0.2;
  
  res.json({
    success: true,
    data: {
      sessionId,
      status: isApproved ? 'APPROVED' : 'PENDING',
      kycLevel: 'BASIC',
      verificationDate: isApproved ? new Date().toISOString() : null,
      riskScore: Math.floor(Math.random() * 30) + 10,
      riskLevel: 'LOW',
      isVerified: isApproved
    }
  });
});

app.get('/api/kyc/api-status', (req, res) => {
  res.json({
    success: true,
    data: {
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
      contractAddress: '0x0165878A594ca255338adfa4d48449f69242Eb8F'
    }
  });
});

// 7.2 KYC 승인/거부 기능 (Mock)
// 대기 중인 KYC 신청 목록 조회
app.get('/api/admin/kyc/pending', (req, res) => {
  // 모의 대기 중인 KYC 신청 목록
  const pendingApplications = [
    {
      id: 'kyc_001',
      userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      applicantName: '김철수',
      documentType: 'PASSPORT',
      documentNumber: 'M12345678',
      submittedAt: new Date(Date.now() - 86400000).toISOString(), // 1일 전
      status: 'PENDING',
      riskScore: '15',
      riskLevel: 'LOW',
      kycLevel: 'BASIC',
      estimatedProcessingTime: '24-48 hours'
    },
    {
      id: 'kyc_002',
      userAddress: '0x8ba1f109551bD432803012645Hac136c772c3c3',
      applicantName: '이영희',
      documentType: 'DRIVERS_LICENSE',
      documentNumber: 'DL98765432',
      submittedAt: new Date(Date.now() - 172800000).toISOString(), // 2일 전
      status: 'PENDING',
      riskScore: '25',
      riskLevel: 'MEDIUM',
      kycLevel: 'BASIC',
      estimatedProcessingTime: '24-48 hours'
    },
    {
      id: 'kyc_003',
      userAddress: '0x1234567890123456789012345678901234567890',
      applicantName: '박민수',
      documentType: 'NATIONAL_ID',
      documentNumber: 'ID123456789',
      submittedAt: new Date(Date.now() - 3600000).toISOString(), // 1시간 전
      status: 'PENDING',
      riskScore: '8',
      riskLevel: 'LOW',
      kycLevel: 'BASIC',
      estimatedProcessingTime: '24-48 hours'
    }
  ];
  
  res.json({
    success: true,
    data: {
      applications: pendingApplications,
      totalCount: pendingApplications.length,
      timestamp: new Date().toISOString()
    }
  });
});

// KYC 승인/거부 이력 조회
app.get('/api/admin/kyc/history', (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  
  // 모의 이력 데이터
  const historyData = [
    {
      id: 'kyc_001',
      userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      applicantName: '김철수',
      status: 'APPROVED',
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
      processedAt: new Date(Date.now() - 3600000).toISOString(),
      processedBy: 'admin@homesure.com',
      kycLevel: 'BASIC',
      riskScore: '15'
    },
    {
      id: 'kyc_002',
      userAddress: '0x8ba1f109551bD432803012645Hac136c772c3c3',
      applicantName: '이영희',
      status: 'REJECTED',
      submittedAt: new Date(Date.now() - 172800000).toISOString(),
      processedAt: new Date(Date.now() - 7200000).toISOString(),
      processedBy: 'admin@homesure.com',
      reason: '서류 불완전',
      riskScore: '25'
    },
    {
      id: 'kyc_003',
      userAddress: '0x1234567890123456789012345678901234567890',
      applicantName: '박민수',
      status: 'APPROVED',
      submittedAt: new Date(Date.now() - 259200000).toISOString(),
      processedAt: new Date(Date.now() - 10800000).toISOString(),
      processedBy: 'admin@homesure.com',
      kycLevel: 'BASIC',
      riskScore: '8'
    }
  ];
  
  // 상태 필터링
  let filteredHistory = historyData;
  if (status) {
    filteredHistory = historyData.filter(item => item.status === status.toUpperCase());
  }
  
  // 페이지네이션
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      history: paginatedHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount: filteredHistory.length,
        totalPages: Math.ceil(filteredHistory.length / limit)
      }
    }
  });
});

// KYC 통계 정보
app.get('/api/admin/kyc/stats', (req, res) => {
  const stats = {
    totalApplications: 156,
    pendingApplications: 3,
    approvedApplications: 142,
    rejectedApplications: 11,
    approvalRate: 92.8,
    averageProcessingTime: '2.3 days',
    todayApplications: 5,
    todayApprovals: 4,
    todayRejections: 1,
    riskDistribution: {
      low: 89,
      medium: 45,
      high: 22
    },
    kycLevelDistribution: {
      basic: 120,
      enhanced: 28,
      premium: 8
    },
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: stats
  });
});

// 특정 KYC 신청 상세 정보 조회
app.get('/api/admin/kyc/:applicationId', (req, res) => {
  const { applicationId } = req.params;
  
  // 모의 상세 정보
  const applicationDetail = {
    id: applicationId,
    userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    applicantName: '김철수',
    email: 'kim@example.com',
    phone: '+82-10-1234-5678',
    dateOfBirth: '1990-01-15',
    nationality: 'KR',
    documentType: 'PASSPORT',
    documentNumber: 'M12345678',
    documentExpiry: '2030-12-31',
    address: {
      street: '서울시 강남구 테헤란로 123',
      city: '서울',
      postalCode: '06123',
      country: 'KR'
    },
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'PENDING',
    riskScore: '15',
    riskLevel: 'LOW',
    kycLevel: 'BASIC',
    amlCheck: {
      isPassed: true,
      riskFactors: [],
      screeningResult: 'CLEAR'
    },
    documentVerification: {
      isVerified: true,
      confidence: 0.95,
      verificationMethod: 'AUTOMATED'
    },
    estimatedProcessingTime: '24-48 hours',
    notes: '모든 서류가 정상적으로 제출되었습니다.'
  };
  
  res.json({
    success: true,
    data: applicationDetail
  });
});

// KYC 신청 승인
app.post('/api/admin/kyc/:applicationId/approve', (req, res) => {
  const { applicationId } = req.params;
  const { adminNotes, kycLevel, limits } = req.body;
  
  // 모의 승인 처리
  const approvalResult = {
    applicationId,
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
    approvedBy: 'admin@homesure.com',
    kycLevel: kycLevel || 'BASIC',
    limits: limits || {
      dailyLimit: '1000000', // 100만원
      monthlyLimit: '10000000', // 1000만원
      totalLimit: '50000000' // 5000만원
    },
    adminNotes: adminNotes || '승인 완료',
    blockchainTransaction: {
      txHash: '0x' + Math.random().toString(36).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: Math.floor(Math.random() * 100000) + 50000
    }
  };
  
  res.json({
    success: true,
    data: approvalResult,
    message: 'KYC 신청이 성공적으로 승인되었습니다.'
  });
});

// KYC 신청 거부
app.post('/api/admin/kyc/:applicationId/reject', (req, res) => {
  const { applicationId } = req.params;
  const { reason, adminNotes } = req.body;
  
  // 모의 거부 처리
  const rejectionResult = {
    applicationId,
    status: 'REJECTED',
    rejectedAt: new Date().toISOString(),
    rejectedBy: 'admin@homesure.com',
    reason: reason || '서류 불완전',
    adminNotes: adminNotes || '추가 서류 제출 필요',
    canReapply: true,
    reapplyAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7일 후 재신청 가능
  };
  
  res.json({
    success: true,
    data: rejectionResult,
    message: 'KYC 신청이 거부되었습니다.'
  });
});

// 블록체인 API 모킹
app.get('/api/blockchain/status', (req, res) => {
  res.json({
    success: true,
    data: {
      network: 'localhost',
      chainId: 31337,
      blockNumber: '0x0',
      gasPrice: '0x0',
      balance: '0.0',
      address: '0x0000000000000000000000000000000000000000'
    },
    message: '블록체인 상태 조회 완료'
  });
});

// 에러 핸들링
app.use((err, req, res, next) => {
  logger.error('서버 오류:', err);
  res.status(500).json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// 부동산 API 엔드포인트들
app.get('/api/properties', (req, res) => {
  const { page = 1, limit = 10, status, propertyType } = req.query;
  
  const mockProperties = [
    {
      id: '1',
      location: '서울시 강남구 테헤란로 123',
      totalValue: '1000000000',
      landArea: 500,
      buildingArea: 300,
      yearBuilt: 2020,
      propertyType: 'RESIDENTIAL',
      status: 'ACTIVE',
      isTokenized: true,
      metadata: 'QmTestMetadataHash1',
      owner: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      location: '서울시 서초구 서초대로 456',
      totalValue: '2000000000',
      landArea: 800,
      buildingArea: 600,
      yearBuilt: 2019,
      propertyType: 'COMMERCIAL',
      status: 'ACTIVE',
      isTokenized: true,
      metadata: 'QmTestMetadataHash2',
      owner: '0x8ba1f109551bD432803012645Hac136c772c3',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '3',
      location: '부산시 해운대구 해운대로 789',
      totalValue: '1500000000',
      landArea: 1200,
      buildingArea: 800,
      yearBuilt: 2021,
      propertyType: 'RESIDENTIAL',
      status: 'PENDING',
      isTokenized: false,
      metadata: 'QmTestMetadataHash3',
      owner: '0x1234567890abcdef1234567890abcdef12345678',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // 필터링
  let filteredProperties = mockProperties;
  if (status) {
    filteredProperties = filteredProperties.filter(p => p.status === status);
  }
  if (propertyType) {
    filteredProperties = filteredProperties.filter(p => p.propertyType === propertyType);
  }

  // 페이지네이션
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

  res.json({
    properties: paginatedProperties,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalCount: filteredProperties.length,
      totalPages: Math.ceil(filteredProperties.length / limit)
    }
  });
});

app.get('/api/properties/:propertyId', (req, res) => {
  const { propertyId } = req.params;
  
  const mockProperty = {
    id: propertyId,
    location: '서울시 강남구 테헤란로 123',
    totalValue: '1000000000',
    landArea: 500,
    buildingArea: 300,
    yearBuilt: 2020,
    propertyType: 'RESIDENTIAL',
    status: 'ACTIVE',
    isTokenized: true,
    metadata: 'QmTestMetadataHash1',
    owner: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  res.json(mockProperty);
});

app.post('/api/properties/register', (req, res) => {
  const { location, totalValue, landArea, buildingArea, yearBuilt, propertyType, metadata } = req.body;
  
  res.json({
    requestId: `req_${Date.now()}`,
    status: 'PENDING',
    message: '부동산 등록 요청이 성공적으로 제출되었습니다.'
  });
});

app.get('/api/properties/register/:requestId/status', (req, res) => {
  const { requestId } = req.params;
  
  res.json({
    requestId,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  });
});

app.post('/api/properties/:propertyId/tokenize', (req, res) => {
  const { propertyId } = req.params;
  const { totalTokens, tokenPrice, minInvestment, maxInvestment, lockupPeriod, dividendRate, tokenMetadata } = req.body;
  
  res.json({
    propertyId,
    tokenContractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokenSymbol: 'HSPT',
    totalTokens,
    tokenPrice,
    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  });
});

app.get('/api/properties/tokenized', (req, res) => {
  const mockTokenizedProperties = [
    {
      propertyId: '1',
      tokenSymbol: 'HSPT1',
      totalSupply: '1000000',
      currentPrice: '1.25',
      marketCap: '1250000',
      volume24h: '50000',
      change24h: '+5.2%',
      dividendYield: '4.8%',
      lockupPeriod: 365 * 24 * 60 * 60,
      minInvestment: '100',
      maxInvestment: '10000'
    },
    {
      propertyId: '2',
      tokenSymbol: 'HSPT2',
      totalSupply: '2000000',
      currentPrice: '2.10',
      marketCap: '4200000',
      volume24h: '75000',
      change24h: '+3.1%',
      dividendYield: '5.2%',
      lockupPeriod: 365 * 24 * 60 * 60,
      minInvestment: '200',
      maxInvestment: '20000'
    }
  ];

  res.json(mockTokenizedProperties);
});

app.get('/api/properties/:propertyId/token', (req, res) => {
  const { propertyId } = req.params;
  
  const mockPropertyToken = {
    propertyId,
    tokenSymbol: 'HSPT1',
    totalSupply: '1000000',
    currentPrice: '1.25',
    marketCap: '1250000',
    volume24h: '50000',
    change24h: '+5.2%',
    dividendYield: '4.8%',
    lockupPeriod: 365 * 24 * 60 * 60,
    minInvestment: '100',
    maxInvestment: '10000'
  };

  res.json(mockPropertyToken);
});

app.get('/api/properties/search', (req, res) => {
  const { q } = req.query;
  
  const mockSearchResults = [
    {
      id: '1',
      location: '서울시 강남구 테헤란로 123',
      totalValue: '1000000000',
      landArea: 500,
      buildingArea: 300,
      yearBuilt: 2020,
      propertyType: 'RESIDENTIAL',
      status: 'ACTIVE',
      isTokenized: true,
      metadata: 'QmTestMetadataHash1',
      owner: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  res.json(mockSearchResults);
});

app.get('/api/properties/stats', (req, res) => {
  res.json({
    totalProperties: 25,
    tokenizedProperties: 18,
    totalValue: '50000000000',
    averageValue: '2000000000',
    propertiesByType: {
      RESIDENTIAL: 15,
      COMMERCIAL: 8,
      INDUSTRIAL: 2
    },
    propertiesByStatus: {
      ACTIVE: 20,
      PENDING: 3,
      SOLD: 2
    }
  });
});

// WebSocket 통계 엔드포인트 (Mock)
app.get('/api/websocket/stats', (req, res) => {
  if (global.webSocketService) {
    res.json(global.webSocketService.getStats());
  } else {
    res.json({
      enabled: false,
      message: 'WebSocket service is not available in simple server mode',
      totalClients: 0,
      priceSubscriptions: 0,
      portfolioSubscriptions: 0,
      transactionSubscriptions: 0,
      priceDataCount: 0,
      portfolioDataCount: 0,
      transactionDataCount: 0,
      config: {
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        heartbeatInterval: 30000
      }
    });
  }
});

// 404 핸들링 (모든 라우트 뒤에 배치)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 엔드포인트를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// 서버 시작
const server = app.listen(PORT, () => {
  logger.info(`🚀 HomeSure Backend Server is running on port ${PORT}`);
  logger.info(`📡 Health check: http://localhost:${PORT}/health`);
  logger.info(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});

// WebSocket 서버 초기화
try {
  const WebSocketService = require('./services/websocketService');
  const webSocketService = new WebSocketService(server);
  global.webSocketService = webSocketService;
  logger.info('✅ WebSocket service initialized in simple server');
} catch (error) {
  logger.warn('⚠️ WebSocket service failed to initialize:', error.message);
  global.webSocketService = null;
} 