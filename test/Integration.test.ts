import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory, Signer, BigNumber } from "ethers";

describe("HomeSure Integration Tests", function () {
  let PropertyToken: ContractFactory;
  let PropertyRegistry: ContractFactory;
  let PropertyOracle: ContractFactory;
  let PropertyValuation: ContractFactory;
  
  let propertyToken: Contract;
  let propertyRegistry: Contract;
  let propertyOracle: Contract;
  let propertyValuation: Contract;
  
  let owner: Signer;
  let issuer: Signer;
  let registrar: Signer;
  let oracle: Signer;
  let valuator: Signer;
  let expert: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  
  let ownerAddress: string;
  let issuerAddress: string;
  let registrarAddress: string;
  let oracleAddress: string;
  let valuatorAddress: string;
  let expertAddress: string;
  let user1Address: string;
  let user2Address: string;
  let user3Address: string;

  const BASIS_POINTS = 10000;
  const DEFAULT_TOKEN_PRICE = ethers.utils.parseEther("0.01");
  const MIN_PROPERTY_VALUE = ethers.utils.parseEther("1000");
  const MAX_PROPERTY_VALUE = ethers.utils.parseEther("1000000");

  beforeEach(async function () {
    [owner, issuer, registrar, oracle, valuator, expert, user1, user2, user3] = await ethers.getSigners();
    
    ownerAddress = await owner.getAddress();
    issuerAddress = await issuer.getAddress();
    registrarAddress = await registrar.getAddress();
    oracleAddress = await oracle.getAddress();
    valuatorAddress = await valuator.getAddress();
    expertAddress = await expert.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();
    user3Address = await user3.getAddress();

    // 컨트랙트 팩토리 가져오기
    PropertyToken = await ethers.getContractFactory("PropertyToken");
    PropertyRegistry = await ethers.getContractFactory("PropertyRegistry");
    PropertyOracle = await ethers.getContractFactory("PropertyOracle");
    PropertyValuation = await ethers.getContractFactory("PropertyValuation");

    // PropertyOracle 배포
    propertyOracle = await PropertyOracle.deploy();
    await propertyOracle.deployed();

    // PropertyToken 배포
    propertyToken = await PropertyToken.deploy("HomeSure Property Token", "HSPT");
    await propertyToken.deployed();

    // PropertyRegistry 배포
    propertyRegistry = await PropertyRegistry.deploy(propertyToken.address);
    await propertyRegistry.deployed();

    // PropertyValuation 배포
    propertyValuation = await PropertyValuation.deploy(propertyOracle.address);
    await propertyValuation.deployed();

    // 역할 설정
    await propertyToken.grantRole(await propertyToken.ISSUER_ROLE(), issuerAddress);
    await propertyToken.grantRole(await propertyToken.REGISTRAR_ROLE(), registrarAddress);
    await propertyToken.grantRole(await propertyToken.ORACLE_ROLE(), oracleAddress);
    await propertyToken.grantRole(await propertyToken.VALIDATOR_ROLE(), valuatorAddress);

    await propertyRegistry.grantRole(await propertyRegistry.REGISTRAR_ROLE(), registrarAddress);
    await propertyRegistry.grantRole(await propertyRegistry.VALIDATOR_ROLE(), valuatorAddress);
    await propertyRegistry.grantRole(await propertyRegistry.ORACLE_ROLE(), oracleAddress);

    await propertyOracle.grantRole(await propertyOracle.ORACLE_ROLE(), oracleAddress);
    await propertyOracle.grantRole(await propertyOracle.VALIDATOR_ROLE(), valuatorAddress);

    await propertyValuation.grantRole(await propertyValuation.VALUATOR_ROLE(), valuatorAddress);
    await propertyValuation.grantRole(await propertyValuation.EXPERT_ROLE(), expertAddress);
  });

  describe("1. 부동산 등록 및 토큰화 전체 플로우", function () {
    it("1.1 부동산 등록부터 토큰 발행까지 전체 플로우 테스트", async function () {
      const propertyValue = ethers.utils.parseEther("500000");
      const tokenPrice = ethers.utils.parseEther("0.01");
      const ownershipPercentage = 5000; // 50%

      // 1. 부동산 등록 요청 생성
      const registrationRequest = await propertyRegistry.connect(registrar).createRegistrationRequest(
        "강남구 테헤란로 123",
        "서울특별시",
        "대한민국",
        "12345",
        propertyValue,
        "아파트",
        "매매",
        "좋은 위치의 아파트입니다.",
        "QmHash123"
      );

      const requestId = 1;
      expect(await propertyRegistry.getRegistrationRequest(requestId)).to.not.be.undefined;

      // 2. 등록 요청 승인
      await propertyRegistry.connect(registrar).approveRegistrationRequest(
        requestId,
        "승인됨"
      );

      const propertyId = 1;
      const property = await propertyRegistry.getProperty(propertyId);
      expect(property.status).to.equal(1); // ACTIVE

      // 3. 토큰 발행
      const tokenAmount = await propertyToken.calculateTokenAmount(
        propertyValue,
        tokenPrice,
        ownershipPercentage
      );

      await propertyToken.connect(issuer).issueTokensAdvanced(
        propertyId,
        user1Address,
        tokenPrice,
        ownershipPercentage,
        "초기 토큰 발행",
        "QmTokenMetadata123"
      );

      // 4. 토큰 잔액 확인
      const balance = await propertyToken.balanceOf(user1Address);
      expect(balance).to.equal(tokenAmount);

      // 5. 소유권 이전 기록
      await propertyRegistry.connect(registrar).recordOwnershipTransferAdvanced(
        propertyId,
        ethers.constants.AddressZero,
        user1Address,
        propertyValue,
        "초기 소유권 이전",
        tokenAmount,
        ownershipPercentage,
        "0x1234567890abcdef"
      );

      // 6. 소유권 현황 확인
      const ownershipStatuses = await propertyRegistry.getPropertyOwnershipStatuses(propertyId);
      expect(ownershipStatuses.length).to.be.greaterThan(0);
    });

    it("1.2 다중 사용자 토큰 발행 및 소유권 분할 테스트", async function () {
      const propertyValue = ethers.utils.parseEther("1000000");
      const tokenPrice = ethers.utils.parseEther("0.01");

      // 부동산 등록
      await propertyRegistry.connect(registrar).createRegistrationRequest(
        "서초구 서초대로 456",
        "서울특별시",
        "대한민국",
        "67890",
        propertyValue,
        "오피스텔",
        "매매",
        "비즈니스 중심지 오피스텔",
        "QmHash456"
      );

      await propertyRegistry.connect(registrar).approveRegistrationRequest(2, "승인됨");

      // 사용자1: 30% 소유권
      await propertyToken.connect(issuer).issueTokensAdvanced(
        2,
        user1Address,
        tokenPrice,
        3000, // 30%
        "사용자1 토큰 발행",
        "QmTokenMetadata1"
      );

      // 사용자2: 40% 소유권
      await propertyToken.connect(issuer).issueTokensAdvanced(
        2,
        user2Address,
        tokenPrice,
        4000, // 40%
        "사용자2 토큰 발행",
        "QmTokenMetadata2"
      );

      // 사용자3: 30% 소유권
      await propertyToken.connect(issuer).issueTokensAdvanced(
        2,
        user3Address,
        tokenPrice,
        3000, // 30%
        "사용자3 토큰 발행",
        "QmTokenMetadata3"
      );

      // 소유권 분산도 확인
      const distribution = await propertyRegistry.getOwnershipDistribution(2);
      expect(distribution).to.equal(3); // 3명의 소유자
    });
  });

  describe("2. 오라클 데이터 연동 테스트", function () {
    it("2.1 오라클 데이터 업데이트 및 검증", async function () {
      const propertyId = 1;

      // 오라클 데이터 업데이트
      await propertyOracle.connect(oracle).updateOracleData(
        propertyId,
        0, // PROPERTY_PRICE
        0, // CHAINLINK
        "chainlink-price-feed",
        ethers.utils.parseEther("520000"),
        2, // HIGH
        "최신 시장 가격 데이터",
        85,
        3600 // 1시간마다 업데이트
      );

      // 오라클 소스 등록
      await propertyOracle.connect(oracle).registerOracleSource(
        oracleAddress,
        "Chainlink Price Feed",
        0, // CHAINLINK
        2, // HIGH
        ethers.utils.parseEther("0.001")
      );

      // 데이터 요청 생성
      await propertyOracle.connect(user1).createDataRequest(
        propertyId,
        0, // PROPERTY_PRICE
        "https://api.example.com/callback"
      );

      // 데이터 요청 처리
      const dataId = 1;
      await propertyOracle.connect(oracle).fulfillDataRequest(2, dataId);

      // 최신 데이터 조회
      const latestDataId = await propertyOracle.getLatestData(propertyId, 0);
      expect(latestDataId).to.equal(dataId);

      // 검증된 데이터 조회
      await propertyOracle.connect(valuator).verifyData(dataId, true);
      const verifiedData = await propertyOracle.getVerifiedData(propertyId, 0);
      expect(verifiedData.length).to.be.greaterThan(0);
    });

    it("2.2 다중 오라클 소스 테스트", async function () {
      // Chainlink 소스 등록
      await propertyOracle.connect(oracle).registerOracleSource(
        oracleAddress,
        "Chainlink Price Feed",
        0, // CHAINLINK
        3, // VERY_HIGH
        ethers.utils.parseEther("0.001")
      );

      // API3 소스 등록
      await propertyOracle.connect(oracle).registerOracleSource(
        oracleAddress,
        "API3 Price Feed",
        1, // API3
        2, // HIGH
        ethers.utils.parseEther("0.002")
      );

      // 정부 데이터 소스 등록
      await propertyOracle.connect(oracle).registerOracleSource(
        oracleAddress,
        "Government Real Estate Data",
        6, // GOVERNMENT_DATA
        3, // VERY_HIGH
        ethers.utils.parseEther("0.0005")
      );

      // 총 소스 수 확인
      const totalSources = await propertyOracle.getTotalSources();
      expect(totalSources).to.equal(3);
    });
  });

  describe("3. 부동산 평가 및 검증 테스트", function () {
    it("3.1 평가 생성부터 완료까지 전체 플로우", async function () {
      const propertyId = 1;
      const originalValue = ethers.utils.parseEther("500000");
      const evaluatedValue = ethers.utils.parseEther("520000");
      const marketValue = ethers.utils.parseEther("510000");

      // 평가 생성
      const valuationId = await propertyValuation.connect(valuator).createValuation(
        propertyId,
        originalValue,
        0, // COMPARABLE_SALES
        "QmReportHash123",
        "시장 비교법을 통한 평가"
      );

      expect(valuationId).to.equal(1);

      // 평가 완료
      await propertyValuation.connect(valuator).completeValuation(
        valuationId,
        evaluatedValue,
        marketValue,
        85,
        "평가 완료 - 시장가 대비 2% 상승"
      );

      // 평가 정보 확인
      const valuation = await propertyValuation.getValuation(valuationId);
      expect(valuation.status).to.equal(2); // COMPLETED
      expect(valuation.confidenceScore).to.equal(85);

      // 전문가 검증
      const reviewId = await propertyValuation.connect(expert).submitExpertReview(
        valuationId,
        true,
        90,
        "평가가 적절하며 시장 상황을 잘 반영함"
      );

      expect(reviewId).to.equal(1);
    });

    it("3.2 이의제기 및 재평가 플로우 테스트", async function () {
      const propertyId = 1;
      const originalValue = ethers.utils.parseEther("500000");
      const evaluatedValue = ethers.utils.parseEther("520000");
      const marketValue = ethers.utils.parseEther("510000");

      // 평가 생성 및 완료
      const valuationId = await propertyValuation.connect(valuator).createValuation(
        propertyId,
        originalValue,
        0, // COMPARABLE_SALES
        "QmReportHash456",
        "시장 비교법을 통한 평가"
      );

      await propertyValuation.connect(valuator).completeValuation(
        valuationId,
        evaluatedValue,
        marketValue,
        85,
        "평가 완료"
      );

      // 이의제기 생성
      const disputeId = await propertyValuation.connect(user1).createDispute(
        valuationId,
        ethers.utils.parseEther("480000"),
        "평가가 너무 높음 - 시장 상황과 맞지 않음",
        { value: ethers.utils.parseEther("0.05") }
      );

      expect(disputeId).to.equal(1);

      // 이의제기 해결
      await propertyValuation.connect(valuator).resolveDispute(
        disputeId,
        "재평가 진행",
        0
      );

      // 재평가 요청
      const requestId = await propertyValuation.connect(user1).requestRevaluation(
        propertyId,
        valuationId,
        "시장 상황 변화로 인한 재평가 필요",
        { value: ethers.utils.parseEther("0.1") }
      );

      expect(requestId).to.equal(1);

      // 재평가 요청 승인
      await propertyValuation.connect(valuator).approveRevaluationRequest(requestId);

      // 재평가 완료
      const newValuationId = 2;
      await propertyValuation.connect(valuator).completeRevaluation(requestId, newValuationId);

      // 재평가 요청 상태 확인
      const request = await propertyValuation.getRevaluationRequest(requestId);
      expect(request.isCompleted).to.be.true;
      expect(request.newValuationId).to.equal(newValuationId);
    });

    it("3.3 편차 계산 및 검증 테스트", async function () {
      const propertyId = 1;
      const originalValue = ethers.utils.parseEther("500000");

      // 정상적인 편차 (20% 이내)
      const normalEvaluatedValue = ethers.utils.parseEther("520000");
      const normalMarketValue = ethers.utils.parseEther("510000");

      const valuationId1 = await propertyValuation.connect(valuator).createValuation(
        propertyId,
        originalValue,
        0, // COMPARABLE_SALES
        "QmReportHash789",
        "정상 편차 평가"
      );

      await propertyValuation.connect(valuator).completeValuation(
        valuationId1,
        normalEvaluatedValue,
        normalMarketValue,
        85,
        "정상 편차 평가 완료"
      );

      // 과도한 편차 (20% 초과) - 실패해야 함
      const excessiveEvaluatedValue = ethers.utils.parseEther("700000");
      const excessiveMarketValue = ethers.utils.parseEther("500000");

      const valuationId2 = await propertyValuation.connect(valuator).createValuation(
        propertyId,
        originalValue,
        0, // COMPARABLE_SALES
        "QmReportHash999",
        "과도한 편차 평가"
      );

      await expect(
        propertyValuation.connect(valuator).completeValuation(
          valuationId2,
          excessiveEvaluatedValue,
          excessiveMarketValue,
          85,
          "과도한 편차 평가 완료"
        )
      ).to.be.revertedWithCustomError(propertyValuation, "InvalidDeviationPercentage");
    });
  });

  describe("4. 문서 관리 및 IPFS 연동 테스트", function () {
    it("4.1 문서 업로드 및 버전 관리", async function () {
      const propertyId = 1;

      // 기본 문서 업로드
      await propertyRegistry.connect(registrar).uploadDocument(
        propertyId,
        "등기부등본",
        "QmDocumentHash1",
        "부동산 등기부등본"
      );

      // 고급 문서 업로드 (암호화 포함)
      await propertyRegistry.connect(registrar).uploadDocumentAdvanced(
        propertyId,
        "감정평가서",
        "QmDocumentHash2",
        "감정평가법인 감정평가서",
        "1.0",
        true,
        "encryption-key-123",
        "QmDocumentHash2"
      );

      // 문서 버전 업데이트
      await propertyRegistry.connect(registrar).updateDocumentVersion(
        2, // documentId
        "2.0",
        "QmDocumentHash2_v2"
      );

      // 활성 문서 조회
      const activeDocuments = await propertyRegistry.getActiveDocuments(propertyId);
      expect(activeDocuments.length).to.be.greaterThan(0);

      // 검증된 문서 조회
      await propertyRegistry.connect(valuator).verifyDocument(1, true);
      const verifiedDocuments = await propertyRegistry.getVerifiedDocuments(propertyId);
      expect(verifiedDocuments.length).to.be.greaterThan(0);

      // 문서 유형별 조회
      const documentsByType = await propertyRegistry.getDocumentsByType(propertyId, 0); // 등기부등본
      expect(documentsByType.length).to.be.greaterThan(0);
    });

    it("4.2 문서 무결성 검증", async function () {
      const propertyId = 1;

      // 문서 업로드
      await propertyRegistry.connect(registrar).uploadDocumentAdvanced(
        propertyId,
        "매매계약서",
        "QmDocumentHash3",
        "부동산 매매계약서",
        "1.0",
        false,
        "",
        "QmDocumentHash3"
      );

      // 문서 무결성 검증
      const documentHash = "QmDocumentHash3";
      const isValid = await propertyRegistry.verifyDocumentIntegrity(3, documentHash);
      expect(isValid).to.be.true;

      // 잘못된 해시로 검증 시도
      const invalidHash = "QmInvalidHash";
      const isInvalid = await propertyRegistry.verifyDocumentIntegrity(3, invalidHash);
      expect(isInvalid).to.be.false;
    });
  });

  describe("5. 부동산 상태 관리 테스트", function () {
    it("5.1 상태 변경 및 히스토리 추적", async function () {
      const propertyId = 1;

      // 초기 상태 확인 (ACTIVE)
      let property = await propertyRegistry.getProperty(propertyId);
      expect(property.status).to.equal(1); // ACTIVE

      // 상태 변경 (SOLD)
      await propertyRegistry.connect(registrar).updatePropertyStatusWithReason(
        propertyId,
        2, // SOLD
        "매매 완료"
      );

      property = await propertyRegistry.getProperty(propertyId);
      expect(property.status).to.equal(2); // SOLD

      // 상태 변경 (SUSPENDED)
      await propertyRegistry.connect(registrar).updatePropertyStatusWithReason(
        propertyId,
        3, // SUSPENDED
        "법적 분쟁으로 인한 일시 중지"
      );

      property = await propertyRegistry.getProperty(propertyId);
      expect(property.status).to.equal(3); // SUSPENDED

      // 상태 히스토리 조회
      const statusHistory = await propertyRegistry.getPropertyStatusHistory(propertyId);
      expect(statusHistory.length).to.be.greaterThan(0);

      // 상태별 부동산 목록 조회
      const suspendedProperties = await propertyRegistry.getPropertiesByStatus(3); // SUSPENDED
      expect(suspendedProperties.length).to.be.greaterThan(0);
    });

    it("5.2 유효한 상태 전환 검증", async function () {
      const propertyId = 1;

      // ACTIVE → SOLD (유효)
      let isValid = await propertyRegistry.isValidStatusTransition(1, 2); // ACTIVE → SOLD
      expect(isValid).to.be.true;

      // ACTIVE → ACTIVE (유효)
      isValid = await propertyRegistry.isValidStatusTransition(1, 1); // ACTIVE → ACTIVE
      expect(isValid).to.be.true;

      // SOLD → PENDING (무효)
      isValid = await propertyRegistry.isValidStatusTransition(2, 0); // SOLD → PENDING
      expect(isValid).to.be.false;
    });
  });

  describe("6. 성능 및 가스 최적화 테스트", function () {
    it("6.1 대량 데이터 처리 테스트", async function () {
      const numProperties = 10;
      const promises = [];

      // 대량 부동산 등록
      for (let i = 0; i < numProperties; i++) {
        const promise = propertyRegistry.connect(registrar).createRegistrationRequest(
          `강남구 테헤란로 ${123 + i}`,
          "서울특별시",
          "대한민국",
          `${12345 + i}`,
          ethers.utils.parseEther("500000"),
          "아파트",
          "매매",
          `부동산 ${i + 1}번`,
          `QmHash${i}`
        );
        promises.push(promise);
      }

      await Promise.all(promises);

      // 모든 등록 요청 승인
      for (let i = 0; i < numProperties; i++) {
        await propertyRegistry.connect(registrar).approveRegistrationRequest(
          i + 3, // requestId (기존 2개 + 새로 생성된 것들)
          "대량 등록 승인"
        );
      }

      // 총 부동산 수 확인
      const totalProperties = await propertyRegistry.getTotalProperties();
      expect(totalProperties).to.be.greaterThanOrEqual(numProperties);
    });

    it("6.2 가스 사용량 최적화 확인", async function () {
      const propertyId = 1;
      const originalValue = ethers.utils.parseEther("500000");

      // 평가 생성 가스 사용량 측정
      const tx1 = await propertyValuation.connect(valuator).createValuation(
        propertyId,
        originalValue,
        0, // COMPARABLE_SALES
        "QmReportHashGas1",
        "가스 테스트"
      );

      const receipt1 = await tx1.wait();
      console.log(`평가 생성 가스 사용량: ${receipt1.gasUsed.toString()}`);

      // 평가 완료 가스 사용량 측정
      const tx2 = await propertyValuation.connect(valuator).completeValuation(
        1, // valuationId
        ethers.utils.parseEther("520000"),
        ethers.utils.parseEther("510000"),
        85,
        "가스 테스트 완료"
      );

      const receipt2 = await tx2.wait();
      console.log(`평가 완료 가스 사용량: ${receipt2.gasUsed.toString()}`);

      // 가스 사용량이 합리적인 범위 내에 있는지 확인
      expect(receipt1.gasUsed).to.be.lessThan(500000); // 50만 가스 이하
      expect(receipt2.gasUsed).to.be.lessThan(300000); // 30만 가스 이하
    });
  });

  describe("7. 보안 및 접근 제어 테스트", function () {
    it("7.1 역할 기반 접근 제어", async function () {
      // 권한이 없는 사용자가 평가 생성 시도
      await expect(
        propertyValuation.connect(user1).createValuation(
          1,
          ethers.utils.parseEther("500000"),
          0,
          "QmReportHash",
          "권한 없는 사용자"
        )
      ).to.be.revertedWith("AccessControl");

      // 권한이 없는 사용자가 토큰 발행 시도
      await expect(
        propertyToken.connect(user1).issueTokensAdvanced(
          1,
          user2Address,
          ethers.utils.parseEther("0.01"),
          5000,
          "권한 없는 사용자",
          "QmMetadata"
        )
      ).to.be.revertedWith("AccessControl");

      // 권한이 없는 사용자가 부동산 등록 승인 시도
      await expect(
        propertyRegistry.connect(user1).approveRegistrationRequest(
          1,
          "권한 없는 사용자"
        )
      ).to.be.revertedWith("AccessControl");
    });

    it("7.2 재진입 공격 방지", async function () {
      const propertyId = 1;
      const originalValue = ethers.utils.parseEther("500000");

      // 평가 생성 (nonReentrant 보호)
      const valuationId = await propertyValuation.connect(valuator).createValuation(
        propertyId,
        originalValue,
        0,
        "QmReportHash",
        "재진입 테스트"
      );

      // 동일한 평가를 다시 완료하려고 시도
      await propertyValuation.connect(valuator).completeValuation(
        valuationId,
        ethers.utils.parseEther("520000"),
        ethers.utils.parseEther("510000"),
        85,
        "첫 번째 완료"
      );

      // 이미 완료된 평가를 다시 완료하려고 시도
      await expect(
        propertyValuation.connect(valuator).completeValuation(
          valuationId,
          ethers.utils.parseEther("530000"),
          ethers.utils.parseEther("520000"),
          90,
          "두 번째 완료 시도"
        )
      ).to.be.revertedWithCustomError(propertyValuation, "ValuationAlreadyCompleted");
    });
  });

  describe("8. 에러 처리 및 예외 상황 테스트", function () {
    it("8.1 잘못된 입력값 처리", async function () {
      // 0 가치로 평가 생성 시도
      await expect(
        propertyValuation.connect(valuator).createValuation(
          1,
          0,
          0,
          "QmReportHash",
          "0 가치"
        )
      ).to.be.revertedWith("Original value must be greater than 0");

      // 잘못된 신뢰도 점수로 평가 완료 시도
      await expect(
        propertyValuation.connect(valuator).completeValuation(
          1,
          ethers.utils.parseEther("520000"),
          ethers.utils.parseEther("510000"),
          150, // 100 초과
          "잘못된 신뢰도"
        )
      ).to.be.revertedWithCustomError(propertyValuation, "InvalidConfidenceScore");

      // 존재하지 않는 평가 ID로 조회 시도
      await expect(
        propertyValuation.getValuation(999)
      ).to.be.revertedWithCustomError(propertyValuation, "ValuationNotFound");
    });

    it("8.2 수수료 부족 상황 처리", async function () {
      // 이의제기 수수료 부족
      await expect(
        propertyValuation.connect(user1).createDispute(
          1,
          ethers.utils.parseEther("480000"),
          "수수료 부족",
          { value: ethers.utils.parseEther("0.001") } // 부족한 수수료
        )
      ).to.be.revertedWith("Insufficient dispute fee");

      // 재평가 요청 수수료 부족
      await expect(
        propertyValuation.connect(user1).requestRevaluation(
          1,
          1,
          "수수료 부족",
          { value: ethers.utils.parseEther("0.001") } // 부족한 수수료
        )
      ).to.be.revertedWith("Insufficient valuation fee");
    });
  });

  describe("9. 이벤트 발생 확인 테스트", function () {
    it("9.1 주요 이벤트 발생 확인", async function () {
      const propertyId = 1;
      const originalValue = ethers.utils.parseEther("500000");

      // 평가 생성 이벤트 확인
      await expect(
        propertyValuation.connect(valuator).createValuation(
          propertyId,
          originalValue,
          0,
          "QmReportHash",
          "이벤트 테스트"
        )
      ).to.emit(propertyValuation, "ValuationCreated");

      // 평가 완료 이벤트 확인
      await expect(
        propertyValuation.connect(valuator).completeValuation(
          1,
          ethers.utils.parseEther("520000"),
          ethers.utils.parseEther("510000"),
          85,
          "이벤트 테스트 완료"
        )
      ).to.emit(propertyValuation, "ValuationCompleted");

      // 이의제기 이벤트 확인
      await expect(
        propertyValuation.connect(user1).createDispute(
          1,
          ethers.utils.parseEther("480000"),
          "이벤트 테스트 이의제기",
          { value: ethers.utils.parseEther("0.05") }
        )
      ).to.emit(propertyValuation, "ValuationDisputed");

      // 전문가 검증 이벤트 확인
      await expect(
        propertyValuation.connect(expert).submitExpertReview(
          1,
          true,
          90,
          "이벤트 테스트 검증"
        )
      ).to.emit(propertyValuation, "ExpertReviewSubmitted");
    });
  });

  describe("10. 통합 시나리오 테스트", function () {
    it("10.1 부동산 투자 시나리오", async function () {
      // 1. 부동산 등록
      await propertyRegistry.connect(registrar).createRegistrationRequest(
        "마포구 합정동 789",
        "서울특별시",
        "대한민국",
        "04001",
        ethers.utils.parseEther("800000"),
        "상가",
        "임대",
        "번화가 상가",
        "QmHashInvestment"
      );

      await propertyRegistry.connect(registrar).approveRegistrationRequest(3, "투자용 승인");

      // 2. 오라클 데이터 등록
      await propertyOracle.connect(oracle).updateOracleData(
        3, // propertyId
        0, // PROPERTY_PRICE
        0, // CHAINLINK
        "market-data",
        ethers.utils.parseEther("820000"),
        2, // HIGH
        "시장 데이터",
        90,
        3600
      );

      // 3. 부동산 평가
      const valuationId = await propertyValuation.connect(valuator).createValuation(
        3,
        ethers.utils.parseEther("800000"),
        1, // INCOME_CAPITALIZATION
        "QmReportInvestment",
        "수익 환원법 평가"
      );

      await propertyValuation.connect(valuator).completeValuation(
        valuationId,
        ethers.utils.parseEther("850000"),
        ethers.utils.parseEther("820000"),
        88,
        "투자 가치 평가 완료"
      );

      // 4. 전문가 검증
      await propertyValuation.connect(expert).submitExpertReview(
        valuationId,
        true,
        92,
        "투자 가치가 우수함"
      );

      // 5. 토큰 발행 (다중 투자자)
      await propertyToken.connect(issuer).issueTokensAdvanced(
        3,
        user1Address,
        ethers.utils.parseEther("0.01"),
        4000, // 40%
        "투자자1 토큰",
        "QmToken1"
      );

      await propertyToken.connect(issuer).issueTokensAdvanced(
        3,
        user2Address,
        ethers.utils.parseEther("0.01"),
        3500, // 35%
        "투자자2 토큰",
        "QmToken2"
      );

      await propertyToken.connect(issuer).issueTokensAdvanced(
        3,
        user3Address,
        ethers.utils.parseEther("0.01"),
        2500, // 25%
        "투자자3 토큰",
        "QmToken3"
      );

      // 6. 소유권 이전 기록
      await propertyRegistry.connect(registrar).recordOwnershipTransferAdvanced(
        3,
        ethers.constants.AddressZero,
        user1Address,
        ethers.utils.parseEther("320000"),
        "투자자1 소유권 이전",
        await propertyToken.calculateTokenAmount(
          ethers.utils.parseEther("800000"),
          ethers.utils.parseEther("0.01"),
          4000
        ),
        4000,
        "0xinvestment1"
      );

      // 7. 최종 상태 확인
      const property = await propertyRegistry.getProperty(3);
      expect(property.status).to.equal(1); // ACTIVE

      const distribution = await propertyRegistry.getOwnershipDistribution(3);
      expect(distribution).to.equal(3); // 3명의 투자자

      const valuation = await propertyValuation.getValuation(valuationId);
      expect(valuation.status).to.equal(2); // COMPLETED

      console.log("✅ 투자 시나리오 테스트 완료");
      console.log(`- 부동산 ID: ${property.propertyId}`);
      console.log(`- 평가 가치: ${ethers.utils.formatEther(valuation.evaluatedValue)} ETH`);
      console.log(`- 소유자 수: ${distribution}명`);
    });
  });
}); 