// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';

/**
 * @title KYCVerification
 * @dev KYC 검증 및 화이트리스트 관리를 위한 스마트 컨트랙트
 * PropertyToken과 연동하여 KYC 인증된 사용자만 토큰 거래가 가능하도록 합니다.
 */
contract KYCVerification is AccessControl, ReentrancyGuard, Pausable {
    // 역할 정의
    bytes32 public constant KYC_MANAGER_ROLE = keccak256('KYC_MANAGER_ROLE');
    bytes32 public constant AML_MANAGER_ROLE = keccak256('AML_MANAGER_ROLE');
    bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

    // KYC 상태 열거형
    enum KYCStatus {
        PENDING,        // 0: 대기
        VERIFIED,       // 1: 인증됨
        REJECTED,       // 2: 거부됨
        EXPIRED,        // 3: 만료됨
        SUSPENDED       // 4: 일시 중지
    }

    // KYC 레벨 열거형
    enum KYCLevel {
        BASIC,          // 0: 기본 인증
        ENHANCED,       // 1: 강화 인증
        PREMIUM         // 2: 프리미엄 인증
    }

    // AML 위험도 열거형
    enum RiskLevel {
        LOW,            // 0: 낮음
        MEDIUM,         // 1: 중간
        HIGH,           // 2: 높음
        CRITICAL        // 3: 매우 높음
    }

    // KYC 정보 구조체
    struct KYCInfo {
        address userAddress;
        KYCStatus status;
        KYCLevel level;
        RiskLevel riskLevel;
        uint256 verificationDate;
        uint256 expiryDate;
        uint256 riskScore;
        string documentHash;
        string verificationId;
        bool isActive;
        uint256 lastUpdated;
        address verifiedBy;
        string rejectionReason;
        uint256 dailyLimit;
        uint256 monthlyLimit;
        uint256 totalLimit;
    }

    // AML 거래 정보 구조체
    struct AMLTransaction {
        uint256 transactionId;
        address userAddress;
        uint256 amount;
        uint256 riskScore;
        RiskLevel riskLevel;
        uint256 timestamp;
        bool isFlagged;
        bool isBlocked;
        string reason;
    }

    // 상태 변수
    mapping(address => KYCInfo) public kycRegistry;
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;
    mapping(address => uint256) public userRiskScores;
    mapping(address => uint256[]) public userTransactions;
    mapping(uint256 => AMLTransaction) public amlTransactions;
    
    uint256 private _transactionCounter;
    uint256 private _verificationCounter;

    // 설정값
    uint256 public constant MAX_DAILY_LIMIT = 1000000 * 10**18; // 1M tokens
    uint256 public constant MAX_MONTHLY_LIMIT = 10000000 * 10**18; // 10M tokens
    uint256 public constant MAX_TOTAL_LIMIT = 100000000 * 10**18; // 100M tokens
    uint256 public constant KYC_EXPIRY_DURATION = 365 days;
    uint256 public constant HIGH_RISK_THRESHOLD = 70;
    uint256 public constant CRITICAL_RISK_THRESHOLD = 90;

    // 이벤트 정의
    event KYCVerified(
        address indexed userAddress,
        KYCLevel level,
        uint256 verificationDate,
        uint256 expiryDate,
        address indexed verifiedBy
    );

    event KYCRejected(
        address indexed userAddress,
        string reason,
        address indexed rejectedBy
    );

    event KYCExpired(
        address indexed userAddress,
        uint256 expiryDate
    );

    event KYCUpdated(
        address indexed userAddress,
        KYCStatus oldStatus,
        KYCStatus newStatus,
        address indexed updatedBy
    );

    event WhitelistUpdated(
        address indexed userAddress,
        bool status,
        address indexed updatedBy
    );

    event BlacklistUpdated(
        address indexed userAddress,
        bool status,
        address indexed updatedBy
    );

    event RiskScoreUpdated(
        address indexed userAddress,
        uint256 oldScore,
        uint256 newScore,
        address indexed updatedBy
    );

    event AMLTransactionFlagged(
        uint256 indexed transactionId,
        address indexed userAddress,
        uint256 riskScore,
        RiskLevel riskLevel,
        string reason
    );

    event DailyLimitUpdated(
        address indexed userAddress,
        uint256 oldLimit,
        uint256 newLimit,
        address indexed updatedBy
    );

    // 에러 정의
    error UserNotKYCVerified(address userAddress);
    error UserKYCExpired(address userAddress);
    error UserBlacklisted(address userAddress);
    error UserNotWhitelisted(address userAddress);
    error KYCAlreadyVerified(address userAddress);
    error KYCNotPending(address userAddress);
    error InvalidKYCLevel();
    error InvalidRiskLevel();
    error InvalidLimits(uint256 daily, uint256 monthly, uint256 total);
    error TransactionExceedsDailyLimit(address userAddress, uint256 amount, uint256 limit);
    error TransactionExceedsMonthlyLimit(address userAddress, uint256 amount, uint256 limit);
    error TransactionExceedsTotalLimit(address userAddress, uint256 amount, uint256 limit);
    error UnauthorizedOperation(address caller, bytes32 role);

    /**
     * @dev 생성자
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KYC_MANAGER_ROLE, msg.sender);
        _grantRole(AML_MANAGER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @dev KYC 인증 수행
     * @param userAddress 사용자 주소
     * @param level KYC 레벨
     * @param documentHash 문서 해시
     * @param verificationId 외부 검증 ID
     * @param riskScore 위험도 점수
     */
    function verifyKYC(
        address userAddress,
        KYCLevel level,
        string memory documentHash,
        string memory verificationId,
        uint256 riskScore
    ) external onlyRole(KYC_MANAGER_ROLE) nonReentrant {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        KYCInfo storage kyc = kycRegistry[userAddress];
        
        if (kyc.status == KYCStatus.VERIFIED && kyc.isActive) {
            revert KYCAlreadyVerified(userAddress);
        }

        // 위험도 레벨 결정
        RiskLevel riskLevel = _determineRiskLevel(riskScore);

        // 거래 한도 설정
        uint256 dailyLimit = _calculateDailyLimit(level, riskLevel);
        uint256 monthlyLimit = dailyLimit * 30;
        uint256 totalLimit = monthlyLimit * 12;

        // KYC 정보 업데이트
        kyc.userAddress = userAddress;
        kyc.status = KYCStatus.VERIFIED;
        kyc.level = level;
        kyc.riskLevel = riskLevel;
        kyc.verificationDate = block.timestamp;
        kyc.expiryDate = block.timestamp + KYC_EXPIRY_DURATION;
        kyc.riskScore = riskScore;
        kyc.documentHash = documentHash;
        kyc.verificationId = verificationId;
        kyc.isActive = true;
        kyc.lastUpdated = block.timestamp;
        kyc.verifiedBy = msg.sender;
        kyc.dailyLimit = dailyLimit;
        kyc.monthlyLimit = monthlyLimit;
        kyc.totalLimit = totalLimit;

        // 화이트리스트에 추가
        whitelist[userAddress] = true;
        userRiskScores[userAddress] = riskScore;

        _verificationCounter++;

        emit KYCVerified(userAddress, level, block.timestamp, kyc.expiryDate, msg.sender);
        emit WhitelistUpdated(userAddress, true, msg.sender);
    }

    /**
     * @dev KYC 거부
     * @param userAddress 사용자 주소
     * @param reason 거부 사유
     */
    function rejectKYC(
        address userAddress,
        string memory reason
    ) external onlyRole(KYC_MANAGER_ROLE) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        KYCInfo storage kyc = kycRegistry[userAddress];
        kyc.status = KYCStatus.REJECTED;
        kyc.rejectionReason = reason;
        kyc.lastUpdated = block.timestamp;
        kyc.isActive = false;

        // 화이트리스트에서 제거
        whitelist[userAddress] = false;

        emit KYCRejected(userAddress, reason, msg.sender);
        emit WhitelistUpdated(userAddress, false, msg.sender);
    }

    /**
     * @dev KYC 상태 업데이트
     * @param userAddress 사용자 주소
     * @param newStatus 새로운 상태
     */
    function updateKYCStatus(
        address userAddress,
        KYCStatus newStatus
    ) external onlyRole(KYC_MANAGER_ROLE) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        KYCInfo storage kyc = kycRegistry[userAddress];
        KYCStatus oldStatus = kyc.status;
        
        kyc.status = newStatus;
        kyc.lastUpdated = block.timestamp;

        // 상태에 따른 화이트리스트 관리
        if (newStatus == KYCStatus.VERIFIED) {
            whitelist[userAddress] = true;
            kyc.isActive = true;
        } else {
            whitelist[userAddress] = false;
            kyc.isActive = false;
        }

        emit KYCUpdated(userAddress, oldStatus, newStatus, msg.sender);
        emit WhitelistUpdated(userAddress, whitelist[userAddress], msg.sender);
    }

    /**
     * @dev 위험도 점수 업데이트
     * @param userAddress 사용자 주소
     * @param newRiskScore 새로운 위험도 점수
     */
    function updateRiskScore(
        address userAddress,
        uint256 newRiskScore
    ) external onlyRole(AML_MANAGER_ROLE) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        uint256 oldScore = userRiskScores[userAddress];
        userRiskScores[userAddress] = newRiskScore;

        KYCInfo storage kyc = kycRegistry[userAddress];
        if (kyc.userAddress != address(0)) {
            kyc.riskScore = newRiskScore;
            kyc.riskLevel = _determineRiskLevel(newRiskScore);
            kyc.lastUpdated = block.timestamp;

            // 위험도에 따른 한도 재계산
            uint256 newDailyLimit = _calculateDailyLimit(kyc.level, kyc.riskLevel);
            uint256 oldDailyLimit = kyc.dailyLimit;
            
            kyc.dailyLimit = newDailyLimit;
            kyc.monthlyLimit = newDailyLimit * 30;
            kyc.totalLimit = kyc.monthlyLimit * 12;

            emit DailyLimitUpdated(userAddress, oldDailyLimit, newDailyLimit, msg.sender);
        }

        emit RiskScoreUpdated(userAddress, oldScore, newRiskScore, msg.sender);
    }

    /**
     * @dev 화이트리스트 관리
     * @param userAddress 사용자 주소
     * @param status 화이트리스트 상태
     */
    function setWhitelistStatus(
        address userAddress,
        bool status
    ) external onlyRole(KYC_MANAGER_ROLE) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        whitelist[userAddress] = status;
        
        KYCInfo storage kyc = kycRegistry[userAddress];
        if (kyc.userAddress != address(0)) {
            kyc.isActive = status;
            kyc.lastUpdated = block.timestamp;
        }

        emit WhitelistUpdated(userAddress, status, msg.sender);
    }

    /**
     * @dev 블랙리스트 관리
     * @param userAddress 사용자 주소
     * @param status 블랙리스트 상태
     */
    function setBlacklistStatus(
        address userAddress,
        bool status
    ) external onlyRole(AML_MANAGER_ROLE) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        blacklist[userAddress] = status;
        
        if (status) {
            // 블랙리스트에 추가되면 화이트리스트에서 제거
            whitelist[userAddress] = false;
            
            KYCInfo storage kyc = kycRegistry[userAddress];
            if (kyc.userAddress != address(0)) {
                kyc.isActive = false;
                kyc.lastUpdated = block.timestamp;
            }
        }

        emit BlacklistUpdated(userAddress, status, msg.sender);
        if (status) {
            emit WhitelistUpdated(userAddress, false, msg.sender);
        }
    }

    /**
     * @dev 거래 위험도 분석 및 기록
     * @param userAddress 사용자 주소
     * @param amount 거래 금액
     * @param riskScore 위험도 점수
     * @param reason 위험 사유
     * @return transactionId 거래 ID
     */
    function recordAMLTransaction(
        address userAddress,
        uint256 amount,
        uint256 riskScore,
        string memory reason
    ) external onlyRole(AML_MANAGER_ROLE) returns (uint256 transactionId) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        _transactionCounter++;
        transactionId = _transactionCounter;

        RiskLevel riskLevel = _determineRiskLevel(riskScore);
        bool isFlagged = riskScore >= HIGH_RISK_THRESHOLD;
        bool isBlocked = riskScore >= CRITICAL_RISK_THRESHOLD;

        AMLTransaction storage transaction = amlTransactions[transactionId];
        transaction.transactionId = transactionId;
        transaction.userAddress = userAddress;
        transaction.amount = amount;
        transaction.riskScore = riskScore;
        transaction.riskLevel = riskLevel;
        transaction.timestamp = block.timestamp;
        transaction.isFlagged = isFlagged;
        transaction.isBlocked = isBlocked;
        transaction.reason = reason;

        userTransactions[userAddress].push(transactionId);

        if (isFlagged) {
            emit AMLTransactionFlagged(transactionId, userAddress, riskScore, riskLevel, reason);
        }

        return transactionId;
    }

    /**
     * @dev 거래 한도 검증
     * @param userAddress 사용자 주소
     * @param amount 거래 금액
     * @return 검증 통과 여부
     */
    function validateTransactionLimits(
        address userAddress,
        uint256 amount
    ) external view returns (bool) {
        if (userAddress == address(0)) {
            revert UserNotKYCVerified(userAddress);
        }

        KYCInfo storage kyc = kycRegistry[userAddress];
        
        // KYC 검증 확인
        if (kyc.status != KYCStatus.VERIFIED || !kyc.isActive) {
            revert UserNotKYCVerified(userAddress);
        }

        // KYC 만료 확인
        if (kyc.expiryDate < block.timestamp) {
            revert UserKYCExpired(userAddress);
        }

        // 블랙리스트 확인
        if (blacklist[userAddress]) {
            revert UserBlacklisted(userAddress);
        }

        // 화이트리스트 확인
        if (!whitelist[userAddress]) {
            revert UserNotWhitelisted(userAddress);
        }

        // 거래 한도 확인 (실제 구현에서는 일일/월간 거래 내역을 추적해야 함)
        if (amount > kyc.dailyLimit) {
            revert TransactionExceedsDailyLimit(userAddress, amount, kyc.dailyLimit);
        }

        return true;
    }

    /**
     * @dev KYC 정보 조회
     * @param userAddress 사용자 주소
     * @return KYCInfo 구조체
     */
    function getKYCInfo(address userAddress) external view returns (KYCInfo memory) {
        return kycRegistry[userAddress];
    }

    /**
     * @dev 사용자 위험도 점수 조회
     * @param userAddress 사용자 주소
     * @return 위험도 점수
     */
    function getUserRiskScore(address userAddress) external view returns (uint256) {
        return userRiskScores[userAddress];
    }

    /**
     * @dev KYC 인증 상태 확인
     * @param userAddress 사용자 주소
     * @return 인증 여부
     */
    function isKYCVerified(address userAddress) external view returns (bool) {
        KYCInfo storage kyc = kycRegistry[userAddress];
        return kyc.status == KYCStatus.VERIFIED && 
               kyc.isActive && 
               kyc.expiryDate > block.timestamp &&
               whitelist[userAddress] &&
               !blacklist[userAddress];
    }

    /**
     * @dev 화이트리스트 상태 확인
     * @param userAddress 사용자 주소
     * @return 화이트리스트 여부
     */
    function isWhitelisted(address userAddress) external view returns (bool) {
        return whitelist[userAddress] && !blacklist[userAddress];
    }

    /**
     * @dev 블랙리스트 상태 확인
     * @param userAddress 사용자 주소
     * @return 블랙리스트 여부
     */
    function isBlacklisted(address userAddress) external view returns (bool) {
        return blacklist[userAddress];
    }

    /**
     * @dev 사용자 거래 내역 조회
     * @param userAddress 사용자 주소
     * @return 거래 ID 배열
     */
    function getUserTransactions(address userAddress) external view returns (uint256[] memory) {
        return userTransactions[userAddress];
    }

    /**
     * @dev AML 거래 정보 조회
     * @param transactionId 거래 ID
     * @return AMLTransaction 구조체
     */
    function getAMLTransaction(uint256 transactionId) external view returns (AMLTransaction memory) {
        return amlTransactions[transactionId];
    }

    /**
     * @dev 만료된 KYC 정리
     */
    function cleanupExpiredKYC() external onlyRole(OPERATOR_ROLE) {
        // 실제 구현에서는 모든 사용자를 순회하여 만료된 KYC를 정리
        // 가스 제한으로 인해 배치 처리 필요
    }

    /**
     * @dev 위험도 레벨 결정
     * @param riskScore 위험도 점수
     * @return RiskLevel
     */
    function _determineRiskLevel(uint256 riskScore) internal pure returns (RiskLevel) {
        if (riskScore >= CRITICAL_RISK_THRESHOLD) {
            return RiskLevel.CRITICAL;
        } else if (riskScore >= HIGH_RISK_THRESHOLD) {
            return RiskLevel.HIGH;
        } else if (riskScore >= 30) {
            return RiskLevel.MEDIUM;
        } else {
            return RiskLevel.LOW;
        }
    }

    /**
     * @dev 일일 거래 한도 계산
     * @param level KYC 레벨
     * @param riskLevel 위험도 레벨
     * @return 일일 한도
     */
    function _calculateDailyLimit(KYCLevel level, RiskLevel riskLevel) internal pure returns (uint256) {
        uint256 baseLimit = MAX_DAILY_LIMIT;
        
        // KYC 레벨에 따른 한도 조정
        if (level == KYCLevel.BASIC) {
            baseLimit = baseLimit / 10; // 100K tokens
        } else if (level == KYCLevel.ENHANCED) {
            baseLimit = baseLimit / 2; // 500K tokens
        }
        // PREMIUM은 기본 한도 유지

        // 위험도에 따른 한도 조정
        if (riskLevel == RiskLevel.HIGH) {
            baseLimit = baseLimit / 2;
        } else if (riskLevel == RiskLevel.CRITICAL) {
            baseLimit = baseLimit / 10;
        }

        return baseLimit;
    }

    /**
     * @dev 컨트랙트 일시 중지
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 중지 해제
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev ERC165 인터페이스 지원
     */
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
} 