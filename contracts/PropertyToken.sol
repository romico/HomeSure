// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './KYCVerification.sol';
import './IERC1400.sol';

/**
 * @title PropertyToken
 * @dev ERC-1400 기반 부동산 토큰화 컨트랙트
 * 부동산 자산을 토큰으로 변환하고 관리하는 기능을 제공합니다.
 * KYCVerification 컨트랙트와 통합하여 규제 준수를 보장합니다.
 */
contract PropertyToken is ERC20, Ownable, Pausable, AccessControl, ReentrancyGuard, IERC1400 {
    // KYC 검증 컨트랙트 참조
    KYCVerification public kycVerification;

    // 역할 정의
    bytes32 public constant ISSUER_ROLE = keccak256('ISSUER_ROLE');
    bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');
    bytes32 public constant KYC_ROLE = keccak256('KYC_ROLE');
    bytes32 public constant AML_ROLE = keccak256('AML_ROLE');

    // 부동산 상태 열거형
    enum PropertyStatus {
        PENDING,    // 0: 등록 대기
        ACTIVE,     // 1: 활성
        SOLD,       // 2: 판매 완료
        SUSPENDED   // 3: 일시 중지
    }

    // 부동산 유형 열거형
    enum PropertyType {
        RESIDENTIAL,    // 0: 주거용
        COMMERCIAL,     // 1: 상업용
        INDUSTRIAL,     // 2: 산업용
        LAND,          // 3: 토지
        MIXED          // 4: 복합용도
    }

    // 전송 제한 유형
    enum TransferRestriction {
        NONE,           // 0: 제한 없음
        LOCKUP,         // 1: 락업 기간
        HOLDING_PERIOD, // 2: 보유 기간
        TRADING_WINDOW, // 3: 거래 시간대
        VOLUME_LIMIT    // 4: 거래량 제한
    }

    // 소각 상태 열거형
    enum RedeemStatus {
        PENDING,    // 0: 대기
        APPROVED,   // 1: 승인됨
        REJECTED,   // 2: 거부됨
        COMPLETED   // 3: 완료
    }

    // 부동산 정보 구조체
    struct Property {
        uint256 propertyId;
        string location;
        uint256 totalValue;      // 부동산 총 가치 (wei)
        uint256 totalTokens;     // 발행된 총 토큰 수
        uint256 maxTokens;       // 최대 발행 가능 토큰 수
        PropertyStatus status;
        PropertyType propertyType;
        uint256 createdAt;
        uint256 updatedAt;
        string metadata;         // IPFS 해시 등 추가 메타데이터
        address owner;           // 부동산 소유자
        uint256 issueFee;        // 발행 수수료 (basis points, 100 = 1%)
        uint256 transferFee;     // 전송 수수료 (basis points, 100 = 1%)
        uint256 redeemFee;       // 소각 수수료 (basis points, 100 = 1%)
        uint256 lockupPeriod;    // 락업 기간 (초)
        uint256 minTransferAmount; // 최소 전송 금액
        uint256 maxTransferAmount; // 최대 전송 금액
        uint256 minRedeemAmount; // 최소 소각 금액
        uint256 maxRedeemAmount; // 최대 소각 금액
        bool redeemEnabled;      // 소각 활성화 여부
    }

    // 토큰 발행 정보 구조체
    struct TokenIssue {
        uint256 issueId;
        uint256 propertyId;
        address issuer;
        address recipient;
        uint256 amount;
        uint256 price;
        uint256 fee;
        uint256 timestamp;
        string reason;
        uint256 ownershipPercentage; // 소유권 분할 비율 (basis points)
        string tokenMetadata;        // 토큰 메타데이터 (IPFS 해시)
    }

    // 소유권 정보 구조체
    struct Ownership {
        uint256 propertyId;
        uint256 tokens;
        uint256 percentage;      // 소유 비율 (basis points, 10000 = 100%)
        uint256 lastUpdated;
        uint256 lockupEndTime;   // 락업 종료 시간
        uint256 firstAcquired;   // 최초 획득 시간
    }

    // 전송 제한 정보 구조체
    struct TransferRestrictionInfo {
        TransferRestriction restrictionType;
        uint256 startTime;
        uint256 endTime;
        uint256 minAmount;
        uint256 maxAmount;
        bool active;
    }

    // 소각 요청 정보 구조체
    struct RedeemRequest {
        uint256 requestId;
        uint256 propertyId;
        address requester;
        uint256 amount;
        uint256 assetValue;      // 회수할 자산 가치
        uint256 fee;            // 소각 수수료
        uint256 tax;            // 세금
        RedeemStatus status;
        uint256 timestamp;
        string reason;
        bool partialRedeem;     // 부분 소각 여부
    }

    // 상태 변수
    uint256 private _propertyIds;
    uint256 private _issueIds;
    uint256 private _redeemRequestIds;
    
    // 기본 설정
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_ISSUE_FEE = 50;    // 0.5%
    uint256 public constant MAX_ISSUE_FEE = 500;   // 5%
    uint256 public constant DEFAULT_ISSUE_FEE = 100; // 1%
    uint256 public constant MIN_TRANSFER_FEE = 10; // 0.1%
    uint256 public constant MAX_TRANSFER_FEE = 200; // 2%
    uint256 public constant DEFAULT_TRANSFER_FEE = 50; // 0.5%
    uint256 public constant MIN_REDEEM_FEE = 20;   // 0.2%
    uint256 public constant MAX_REDEEM_FEE = 300;  // 3%
    uint256 public constant DEFAULT_REDEEM_FEE = 100; // 1%
    uint256 public constant MIN_REDEEM_TAX = 0;    // 0%
    uint256 public constant MAX_REDEEM_TAX = 500;  // 5%
    uint256 public constant DEFAULT_REDEEM_TAX = 50; // 0.5%
    
    // 토큰 발행 관련 설정
    uint256 public constant MIN_TOKEN_PRICE = 0.001 ether;  // 0.001 ETH
    uint256 public constant MAX_TOKEN_PRICE = 10 ether;     // 10 ETH
    uint256 public constant DEFAULT_TOKEN_PRICE = 0.01 ether; // 0.01 ETH
    uint256 public constant MIN_OWNERSHIP_PERCENTAGE = 100;  // 1%
    uint256 public constant MAX_OWNERSHIP_PERCENTAGE = 10000; // 100%
    uint256 public constant MIN_TOKENS_PER_ISSUE = 1;       // 최소 1 토큰
    uint256 public constant MAX_TOKENS_PER_ISSUE = 1000000; // 최대 1M 토큰
    
    // 매핑
    mapping(uint256 => Property) public properties;
    mapping(uint256 => TokenIssue) public tokenIssues;
    mapping(uint256 => RedeemRequest) public redeemRequests;
    mapping(address => bool) public kycWhitelist;
    mapping(address => bool) public frozenAddresses;
    mapping(address => uint256[]) public userProperties; // 사용자가 보유한 부동산 ID 목록
    mapping(address => mapping(uint256 => Ownership)) public ownerships; // 사용자별 부동산 소유권 정보
    mapping(uint256 => address[]) public propertyOwners; // 부동산별 소유자 목록
    mapping(uint256 => TransferRestrictionInfo) public transferRestrictions; // 부동산별 전송 제한 정보
    mapping(uint256 => uint256[]) public propertyRedeemRequests; // 부동산별 소각 요청 목록

    // 이벤트 정의
    event PropertyRegistered(
        uint256 indexed propertyId,
        string location,
        uint256 totalValue,
        uint256 maxTokens,
        PropertyType propertyType,
        address indexed owner
    );

    event TokenIssued(
        uint256 indexed issueId,
        uint256 indexed propertyId,
        address indexed to,
        uint256 amount,
        uint256 price,
        uint256 fee
    );

    event TokenMetadataUpdated(
        uint256 indexed issueId,
        uint256 indexed propertyId,
        string oldMetadata,
        string newMetadata
    );

    event TokenSupplyUpdated(
        uint256 indexed propertyId,
        uint256 oldSupply,
        uint256 newSupply
    );

    event TokenTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        bool forced,
        uint256 fee
    );

    event TokenRedeemed(
        uint256 indexed propertyId,
        address indexed from,
        uint256 amount,
        uint256 assetValue,
        uint256 fee,
        uint256 tax
    );

    event RedeemRequestCreated(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester,
        uint256 amount,
        uint256 assetValue
    );

    event RedeemRequestApproved(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester
    );

    event RedeemRequestRejected(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester,
        string reason
    );

    event WhitelistUpdated(
        address indexed account,
        bool status
    );

    event AddressFrozen(
        address indexed account,
        bool status
    );

    event PropertyStatusUpdated(
        uint256 indexed propertyId,
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    );

    event IssueFeeUpdated(
        uint256 indexed propertyId,
        uint256 oldFee,
        uint256 newFee
    );

    event TransferFeeUpdated(
        uint256 indexed propertyId,
        uint256 oldFee,
        uint256 newFee
    );

    event RedeemFeeUpdated(
        uint256 indexed propertyId,
        uint256 oldFee,
        uint256 newFee
    );

    event OwnershipUpdated(
        address indexed owner,
        uint256 indexed propertyId,
        uint256 tokens,
        uint256 percentage
    );

    event TransferRestrictionSet(
        uint256 indexed propertyId,
        TransferRestriction restrictionType,
        uint256 startTime,
        uint256 endTime
    );

    // 에러 정의
    error PropertyNotFound(uint256 propertyId);
    error PropertyNotActive(uint256 propertyId);
    error InsufficientBalance(address account, uint256 required, uint256 available);
    error NotKYCVerified(address account);
    error AddressIsFrozen(address account);
    error TransferNotAllowed(address from, address to);
    error InvalidAmount(uint256 amount);
    error UnauthorizedOperation(address caller, bytes32 role);
    error ExceedsMaxTokens(uint256 propertyId, uint256 requested, uint256 available);
    error InvalidIssueFee(uint256 fee);
    error InvalidTransferFee(uint256 fee);
    error InvalidRedeemFee(uint256 fee);
    error InvalidPropertyType();
    error TransferRestricted(uint256 propertyId, TransferRestriction restrictionType);
    error LockupPeriodNotEnded(address account, uint256 propertyId, uint256 endTime);
    error TransferAmountExceedsLimit(uint256 propertyId, uint256 amount, uint256 limit);
    error TransferAmountBelowMinimum(uint256 propertyId, uint256 amount, uint256 minimum);
    error RedeemNotEnabled(uint256 propertyId);
    error RedeemAmountExceedsLimit(uint256 propertyId, uint256 amount, uint256 limit);
    error RedeemAmountBelowMinimum(uint256 propertyId, uint256 amount, uint256 minimum);
    error RedeemRequestNotFound(uint256 requestId);
    error RedeemRequestNotApproved(uint256 requestId);
    error RedeemRequestAlreadyProcessed(uint256 requestId);
    error KYCVerificationFailed(address account);
    error TransactionLimitExceeded(address account, uint256 amount, uint256 limit);

    /**
     * @dev KYC 검증 modifier
     * @param account 검증할 주소
     */
    modifier onlyKYCVerified(address account) {
        if (!kycVerification.isKYCVerified(account)) {
            revert KYCVerificationFailed(account);
        }
        _;
    }

    /**
     * @dev 거래 한도 검증 modifier
     * @param account 검증할 주소
     * @param amount 거래 금액
     */
    modifier withinTransactionLimits(address account, uint256 amount) {
        if (!kycVerification.validateTransactionLimits(account, amount)) {
            revert TransactionLimitExceeded(account, amount, 0);
        }
        _;
    }

    /**
     * @dev 생성자
     * @param name 토큰 이름
     * @param symbol 토큰 심볼
     * @param _kycVerification KYC 검증 컨트랙트 주소
     */
    constructor(
        string memory name,
        string memory symbol,
        address _kycVerification
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_kycVerification != address(0), 'Invalid KYC verification address');
        kycVerification = KYCVerification(_kycVerification);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(KYC_ROLE, msg.sender);
        _grantRole(AML_ROLE, msg.sender);
    }

    /**
     * @dev 부동산 등록
     * @param location 부동산 위치
     * @param totalValue 부동산 총 가치
     * @param maxTokens 최대 발행 가능 토큰 수
     * @param propertyType 부동산 유형
     * @param metadata 추가 메타데이터 (IPFS 해시 등)
     * @return propertyId 등록된 부동산 ID
     */
    function registerProperty(
        string memory location,
        uint256 totalValue,
        uint256 maxTokens,
        PropertyType propertyType,
        string memory metadata
    ) external onlyRole(ISSUER_ROLE) returns (uint256 propertyId) {
        require(totalValue > 0, 'Property value must be greater than 0');
        require(maxTokens > 0, 'Max tokens must be greater than 0');
        require(bytes(location).length > 0, 'Location cannot be empty');

        _propertyIds++;
        propertyId = _propertyIds;

        properties[propertyId] = Property({
            propertyId: propertyId,
            location: location,
            totalValue: totalValue,
            totalTokens: 0,
            maxTokens: maxTokens,
            status: PropertyStatus.PENDING,
            propertyType: propertyType,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            metadata: metadata,
            owner: msg.sender,
            issueFee: DEFAULT_ISSUE_FEE,
            transferFee: DEFAULT_TRANSFER_FEE,
            redeemFee: DEFAULT_REDEEM_FEE,
            lockupPeriod: 0,
            minTransferAmount: 0,
            maxTransferAmount: maxTokens,
            minRedeemAmount: 0,
            maxRedeemAmount: maxTokens,
            redeemEnabled: true
        });

        emit PropertyRegistered(propertyId, location, totalValue, maxTokens, propertyType, msg.sender);
    }

    /**
     * @dev 부동산 상태 업데이트 (테스트용)
     * @param propertyId 부동산 ID
     * @param newStatus 새로운 상태
     */
    function updatePropertyStatus(uint256 propertyId, PropertyStatus newStatus) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        properties[propertyId].status = newStatus;
        properties[propertyId].updatedAt = block.timestamp;
        emit PropertyStatusUpdated(propertyId, properties[propertyId].status, newStatus);
    }

    /**
     * @dev 토큰 발행량 계산
     * @param propertyValue 부동산 가치
     * @param tokenPrice 토큰 가격
     * @param ownershipPercentage 소유권 분할 비율 (basis points)
     * @return 계산된 토큰 수량
     */
    function calculateTokenAmount(
        uint256 propertyValue,
        uint256 tokenPrice,
        uint256 ownershipPercentage
    ) public pure returns (uint256) {
        require(tokenPrice >= MIN_TOKEN_PRICE && tokenPrice <= MAX_TOKEN_PRICE, 'Invalid token price');
        require(ownershipPercentage >= MIN_OWNERSHIP_PERCENTAGE && ownershipPercentage <= MAX_OWNERSHIP_PERCENTAGE, 'Invalid ownership percentage');
        
        // 토큰 수량 = (부동산 가치 * 소유권 비율) / 토큰 가격
        uint256 tokenAmount = (propertyValue * ownershipPercentage) / (BASIS_POINTS * tokenPrice);
        
        require(tokenAmount >= MIN_TOKENS_PER_ISSUE, 'Token amount too low');
        require(tokenAmount <= MAX_TOKENS_PER_ISSUE, 'Token amount too high');
        
        return tokenAmount;
    }

    /**
     * @dev 토큰 발행 (개선된 버전)
     * @param propertyId 부동산 ID
     * @param to 발행 대상 주소
     * @param tokenPrice 토큰 가격
     * @param ownershipPercentage 소유권 분할 비율 (basis points)
     * @param reason 발행 사유
     * @param tokenMetadata 토큰 메타데이터 (IPFS 해시)
     * @return issueId 발행 ID
     */
    function issueTokensAdvanced(
        uint256 propertyId,
        address to,
        uint256 tokenPrice,
        uint256 ownershipPercentage,
        string memory reason,
        string memory tokenMetadata
    ) external onlyRole(ISSUER_ROLE) nonReentrant onlyKYCVerified(to) returns (uint256 issueId) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (properties[propertyId].status != PropertyStatus.ACTIVE) {
            revert PropertyNotActive(propertyId);
        }
        if (to == address(0)) {
            revert TransferNotAllowed(msg.sender, to);
        }

        Property storage property = properties[propertyId];
        
        // 토큰 수량 계산
        uint256 amount = calculateTokenAmount(property.totalValue, tokenPrice, ownershipPercentage);

        // 거래 한도 검증
        if (!kycVerification.validateTransactionLimits(to, amount)) {
            revert TransactionLimitExceeded(to, amount, 0);
        }

        // 최대 발행량 확인
        if (property.totalTokens + amount > property.maxTokens) {
            revert ExceedsMaxTokens(propertyId, amount, property.maxTokens - property.totalTokens);
        }

        _issueIds++;
        issueId = _issueIds;

        // 발행 수수료 계산
        uint256 fee = (amount * property.issueFee) / BASIS_POINTS;
        uint256 netAmount = amount - fee;

        // 토큰 발행 (수수료 제외한 순수량)
        _mint(to, netAmount);
        
        // 수수료는 컨트랙트 소유자에게 발행
        if (fee > 0) {
            _mint(owner(), fee);
        }

        // 부동산 정보 업데이트
        property.totalTokens += amount;
        property.updatedAt = block.timestamp;

        // 발행 정보 저장
        tokenIssues[issueId] = TokenIssue({
            issueId: issueId,
            propertyId: propertyId,
            issuer: msg.sender,
            recipient: to,
            amount: netAmount,
            price: tokenPrice,
            fee: fee,
            timestamp: block.timestamp,
            reason: reason,
            ownershipPercentage: ownershipPercentage,
            tokenMetadata: tokenMetadata
        });

        // 소유권 정보 업데이트
        _updateOwnership(to, propertyId, netAmount);

        emit TokenIssued(issueId, propertyId, to, netAmount, tokenPrice, fee);
    }

    /**
     * @dev 토큰 발행 (기존 버전 - 호환성 유지)
     * @param propertyId 부동산 ID
     * @param to 발행 대상 주소
     * @param amount 발행할 토큰 수량
     * @param price 토큰 가격
     * @param reason 발행 사유
     */
    function issueTokens(
        uint256 propertyId,
        address to,
        uint256 amount,
        uint256 price,
        string memory reason
    ) external onlyRole(ISSUER_ROLE) nonReentrant {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (properties[propertyId].status != PropertyStatus.ACTIVE) {
            revert PropertyNotActive(propertyId);
        }
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
        if (to == address(0)) {
            revert TransferNotAllowed(msg.sender, to);
        }

        // 최대 발행량 확인
        Property storage property = properties[propertyId];
        if (property.totalTokens + amount > property.maxTokens) {
            revert ExceedsMaxTokens(propertyId, amount, property.maxTokens - property.totalTokens);
        }

        // KYC 검증 확인
        if (!kycWhitelist[to]) {
            revert NotKYCVerified(to);
        }

        // 동결된 주소 확인
        if (frozenAddresses[to]) {
            revert AddressIsFrozen(to);
        }

        _issueIds++;
        uint256 issueId = _issueIds;

        // 발행 수수료 계산
        uint256 fee = (amount * property.issueFee) / BASIS_POINTS;
        uint256 netAmount = amount - fee;

        // 토큰 발행 (수수료 제외한 순수량)
        _mint(to, netAmount);
        
        // 수수료는 컨트랙트 소유자에게 발행
        if (fee > 0) {
            _mint(owner(), fee);
        }

        // 부동산 정보 업데이트
        property.totalTokens += amount;
        property.updatedAt = block.timestamp;

        // 발행 정보 저장 (기존 호환성을 위해 기본값 사용)
        tokenIssues[issueId] = TokenIssue({
            issueId: issueId,
            propertyId: propertyId,
            issuer: msg.sender,
            recipient: to,
            amount: netAmount,
            price: price,
            fee: fee,
            timestamp: block.timestamp,
            reason: reason,
            ownershipPercentage: (amount * BASIS_POINTS) / property.totalTokens,
            tokenMetadata: ''
        });

        // 소유권 정보 업데이트
        _updateOwnership(to, propertyId, netAmount);

        emit TokenIssued(issueId, propertyId, to, netAmount, price, fee);
    }

    /**
     * @dev 발행 수수료 설정
     * @param propertyId 부동산 ID
     * @param fee 수수료 (basis points)
     */
    function setIssueFee(
        uint256 propertyId,
        uint256 fee
    ) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (fee < MIN_ISSUE_FEE || fee > MAX_ISSUE_FEE) {
            revert InvalidIssueFee(fee);
        }

        uint256 oldFee = properties[propertyId].issueFee;
        properties[propertyId].issueFee = fee;
        properties[propertyId].updatedAt = block.timestamp;

        emit IssueFeeUpdated(propertyId, oldFee, fee);
    }

    /**
     * @dev 전송 수수료 설정
     * @param propertyId 부동산 ID
     * @param fee 수수료 (basis points)
     */
    function setTransferFee(
        uint256 propertyId,
        uint256 fee
    ) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (fee < MIN_TRANSFER_FEE || fee > MAX_TRANSFER_FEE) {
            revert InvalidTransferFee(fee);
        }

        uint256 oldFee = properties[propertyId].transferFee;
        properties[propertyId].transferFee = fee;
        properties[propertyId].updatedAt = block.timestamp;

        emit TransferFeeUpdated(propertyId, oldFee, fee);
    }

    /**
     * @dev 소각 수수료 설정
     * @param propertyId 부동산 ID
     * @param fee 수수료 (basis points)
     */
    function setRedeemFee(
        uint256 propertyId,
        uint256 fee
    ) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (fee < MIN_REDEEM_FEE || fee > MAX_REDEEM_FEE) {
            revert InvalidRedeemFee(fee);
        }

        uint256 oldFee = properties[propertyId].redeemFee;
        properties[propertyId].redeemFee = fee;
        properties[propertyId].updatedAt = block.timestamp;

        emit RedeemFeeUpdated(propertyId, oldFee, fee);
    }

    /**
     * @dev 토큰 메타데이터 업데이트
     * @param issueId 발행 ID
     * @param newMetadata 새로운 메타데이터 (IPFS 해시)
     */
    function updateTokenMetadata(
        uint256 issueId,
        string memory newMetadata
    ) external onlyRole(ISSUER_ROLE) {
        if (tokenIssues[issueId].issueId == 0) {
            revert PropertyNotFound(issueId);
        }

        string memory oldMetadata = tokenIssues[issueId].tokenMetadata;
        tokenIssues[issueId].tokenMetadata = newMetadata;

        emit TokenMetadataUpdated(issueId, tokenIssues[issueId].propertyId, oldMetadata, newMetadata);
    }

    /**
     * @dev 토큰 공급량 업데이트
     * @param propertyId 부동산 ID
     * @param newMaxTokens 새로운 최대 토큰 수
     */
    function updateTokenSupply(
        uint256 propertyId,
        uint256 newMaxTokens
    ) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (newMaxTokens < properties[propertyId].totalTokens) {
            revert InvalidAmount(newMaxTokens);
        }

        uint256 oldMaxTokens = properties[propertyId].maxTokens;
        properties[propertyId].maxTokens = newMaxTokens;
        properties[propertyId].updatedAt = block.timestamp;

        emit TokenSupplyUpdated(propertyId, oldMaxTokens, newMaxTokens);
    }

    /**
     * @dev 토큰 발행 정보 조회
     * @param issueId 발행 ID
     * @return TokenIssue 구조체
     */
    function getTokenIssue(uint256 issueId) external view returns (TokenIssue memory) {
        if (tokenIssues[issueId].issueId == 0) {
            revert PropertyNotFound(issueId);
        }
        return tokenIssues[issueId];
    }

    /**
     * @dev 부동산별 토큰 발행 이력 조회
     * @param propertyId 부동산 ID
     * @return 발행 ID 배열
     */
    function getPropertyTokenIssues(uint256 propertyId) external view returns (uint256[] memory) {
        uint256[] memory issues = new uint256[](_issueIds);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= _issueIds; i++) {
            if (tokenIssues[i].propertyId == propertyId) {
                issues[count] = i;
                count++;
            }
        }
        
        // 배열 크기 조정
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = issues[i];
        }
        
        return result;
    }

    /**
     * @dev 소각 활성화/비활성화 설정
     * @param propertyId 부동산 ID
     * @param enabled 활성화 여부
     */
    function setRedeemEnabled(
        uint256 propertyId,
        bool enabled
    ) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }

        properties[propertyId].redeemEnabled = enabled;
        properties[propertyId].updatedAt = block.timestamp;
    }

    /**
     * @dev 소각 요청 생성
     * @param propertyId 부동산 ID
     * @param amount 소각할 토큰 수량
     * @param reason 소각 사유
     * @return requestId 요청 ID
     */
    function createRedeemRequest(
        uint256 propertyId,
        uint256 amount,
        string memory reason
    ) external returns (uint256 requestId) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (!properties[propertyId].redeemEnabled) {
            revert RedeemNotEnabled(propertyId);
        }
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
        if (balanceOf(msg.sender) < amount) {
            revert InsufficientBalance(msg.sender, amount, balanceOf(msg.sender));
        }

        Property storage property = properties[propertyId];
        if (amount < property.minRedeemAmount) {
            revert RedeemAmountBelowMinimum(propertyId, amount, property.minRedeemAmount);
        }
        if (amount > property.maxRedeemAmount) {
            revert RedeemAmountExceedsLimit(propertyId, amount, property.maxRedeemAmount);
        }

        _redeemRequestIds++;
        requestId = _redeemRequestIds;

        // 자산 가치 계산
        uint256 assetValue = (amount * property.totalValue) / property.totalTokens;
        
        // 소각 수수료 계산
        uint256 fee = (amount * property.redeemFee) / BASIS_POINTS;
        
        // 세금 계산 (기본 0.5%)
        uint256 tax = (amount * DEFAULT_REDEEM_TAX) / BASIS_POINTS;

        // 소각 요청 저장
        redeemRequests[requestId] = RedeemRequest({
            requestId: requestId,
            propertyId: propertyId,
            requester: msg.sender,
            amount: amount,
            assetValue: assetValue,
            fee: fee,
            tax: tax,
            status: RedeemStatus.PENDING,
            timestamp: block.timestamp,
            reason: reason,
            partialRedeem: amount < balanceOf(msg.sender)
        });

        // 부동산별 소각 요청 목록에 추가
        propertyRedeemRequests[propertyId].push(requestId);

        emit RedeemRequestCreated(requestId, propertyId, msg.sender, amount, assetValue);
    }

    /**
     * @dev 소각 요청 승인
     * @param requestId 요청 ID
     */
    function approveRedeemRequest(uint256 requestId) external onlyRole(ISSUER_ROLE) nonReentrant {
        RedeemRequest storage request = redeemRequests[requestId];
        if (request.requestId == 0) {
            revert RedeemRequestNotFound(requestId);
        }
        if (request.status != RedeemStatus.PENDING) {
            revert RedeemRequestAlreadyProcessed(requestId);
        }

        request.status = RedeemStatus.APPROVED;

        // 토큰 소각
        _burn(request.requester, request.amount);

        // 부동산 정보 업데이트
        Property storage property = properties[request.propertyId];
        property.totalTokens -= request.amount;
        property.updatedAt = block.timestamp;

        // 소유권 정보 업데이트
        Ownership storage ownership = ownerships[request.requester][request.propertyId];
        if (ownership.tokens > 0) {
            ownership.tokens -= request.amount;
            ownership.percentage = (ownership.tokens * BASIS_POINTS) / property.totalTokens;
            ownership.lastUpdated = block.timestamp;
        }

        emit RedeemRequestApproved(requestId, request.propertyId, request.requester);
        emit TokenRedeemed(request.propertyId, request.requester, request.amount, request.assetValue, request.fee, request.tax);
    }

    /**
     * @dev 소각 요청 거부
     * @param requestId 요청 ID
     * @param reason 거부 사유
     */
    function rejectRedeemRequest(
        uint256 requestId,
        string memory reason
    ) external onlyRole(ISSUER_ROLE) {
        RedeemRequest storage request = redeemRequests[requestId];
        if (request.requestId == 0) {
            revert RedeemRequestNotFound(requestId);
        }
        if (request.status != RedeemStatus.PENDING) {
            revert RedeemRequestAlreadyProcessed(requestId);
        }

        request.status = RedeemStatus.REJECTED;

        emit RedeemRequestRejected(requestId, request.propertyId, request.requester, reason);
    }

    /**
     * @dev 즉시 토큰 소각 (승인 없이)
     * @param propertyId 부동산 ID
     * @param amount 소각할 토큰 수량
     */
    function redeemTokens(
        uint256 propertyId,
        uint256 amount
    ) external nonReentrant {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (!properties[propertyId].redeemEnabled) {
            revert RedeemNotEnabled(propertyId);
        }
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
        if (balanceOf(msg.sender) < amount) {
            revert InsufficientBalance(msg.sender, amount, balanceOf(msg.sender));
        }

        Property storage property = properties[propertyId];
        if (amount < property.minRedeemAmount) {
            revert RedeemAmountBelowMinimum(propertyId, amount, property.minRedeemAmount);
        }
        if (amount > property.maxRedeemAmount) {
            revert RedeemAmountExceedsLimit(propertyId, amount, property.maxRedeemAmount);
        }

        // 자산 가치 계산
        uint256 assetValue = (amount * property.totalValue) / property.totalTokens;
        
        // 소각 수수료 계산
        uint256 fee = (amount * property.redeemFee) / BASIS_POINTS;
        
        // 세금 계산
        uint256 tax = (amount * DEFAULT_REDEEM_TAX) / BASIS_POINTS;

        // 토큰 소각
        _burn(msg.sender, amount);

        // 부동산 정보 업데이트
        property.totalTokens -= amount;
        property.updatedAt = block.timestamp;

        // 소유권 정보 업데이트
        Ownership storage ownership = ownerships[msg.sender][propertyId];
        if (ownership.tokens > 0) {
            ownership.tokens -= amount;
            ownership.percentage = (ownership.tokens * BASIS_POINTS) / property.totalTokens;
            ownership.lastUpdated = block.timestamp;
        }

        emit TokenRedeemed(propertyId, msg.sender, amount, assetValue, fee, tax);
    }

    /**
     * @dev 소각 요청 정보 조회
     * @param requestId 요청 ID
     * @return RedeemRequest 구조체
     */
    function getRedeemRequest(uint256 requestId) external view returns (RedeemRequest memory) {
        if (redeemRequests[requestId].requestId == 0) {
            revert RedeemRequestNotFound(requestId);
        }
        return redeemRequests[requestId];
    }

    /**
     * @dev 부동산별 소각 요청 목록 조회
     * @param propertyId 부동산 ID
     * @return 요청 ID 배열
     */
    function getPropertyRedeemRequests(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyRedeemRequests[propertyId];
    }

    /**
     * @dev 전송 제한 설정
     * @param propertyId 부동산 ID
     * @param restrictionType 제한 유형
     * @param startTime 시작 시간
     * @param endTime 종료 시간
     * @param minAmount 최소 금액
     * @param maxAmount 최대 금액
     */
    function setTransferRestriction(
        uint256 propertyId,
        TransferRestriction restrictionType,
        uint256 startTime,
        uint256 endTime,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }

        transferRestrictions[propertyId] = TransferRestrictionInfo({
            restrictionType: restrictionType,
            startTime: startTime,
            endTime: endTime,
            minAmount: minAmount,
            maxAmount: maxAmount,
            active: true
        });

        emit TransferRestrictionSet(propertyId, restrictionType, startTime, endTime);
    }

    /**
     * @dev 전송 제한 해제
     * @param propertyId 부동산 ID
     */
    function removeTransferRestriction(uint256 propertyId) external onlyRole(ISSUER_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }

        transferRestrictions[propertyId].active = false;
    }

    /**
     * @dev 전송 가능 여부 확인
     * @param propertyId 부동산 ID
     * @param from 발신자
     * @param to 수신자
     * @param amount 수량
     * @return 전송 가능 여부
     */
    function canTransfer(
        uint256 propertyId,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool) {
        try this._validateTransferExternal(propertyId, from, to, amount) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev 전송 제한 검증 (외부 호출용)
     * @param propertyId 부동산 ID
     * @param from 발신자
     * @param to 수신자
     * @param amount 수량
     */
    function _validateTransferExternal(
        uint256 propertyId,
        address from,
        address to,
        uint256 amount
    ) external view {
        _validateTransferWithRestrictions(propertyId, from, to, amount);
    }

    /**
     * @dev 전송 제한 검증 (내부 함수)
     * @param propertyId 부동산 ID
     * @param from 발신자
     * @param to 수신자
     * @param amount 수량
     */
    function _validateTransferWithRestrictions(
        uint256 propertyId,
        address from,
        address to,
        uint256 amount
    ) internal view {
        // 기본 전송 검증
        _validateTransfer(from, to, amount);

        // 전송 제한 확인
        TransferRestrictionInfo storage restriction = transferRestrictions[propertyId];
        if (restriction.active) {
            uint256 currentTime = block.timestamp;
            
            // 시간 제한 확인
            if (currentTime >= restriction.startTime && currentTime <= restriction.endTime) {
                revert TransferRestricted(propertyId, restriction.restrictionType);
            }
            
            // 금액 제한 확인
            if (amount < restriction.minAmount) {
                revert TransferAmountBelowMinimum(propertyId, amount, restriction.minAmount);
            }
            if (amount > restriction.maxAmount) {
                revert TransferAmountExceedsLimit(propertyId, amount, restriction.maxAmount);
            }
        }

        // 락업 기간 확인
        Ownership storage ownership = ownerships[from][propertyId];
        if (ownership.lockupEndTime > block.timestamp) {
            revert LockupPeriodNotEnded(from, propertyId, ownership.lockupEndTime);
        }

        // 부동산별 전송 제한 확인
        Property storage property = properties[propertyId];
        if (amount < property.minTransferAmount) {
            revert TransferAmountBelowMinimum(propertyId, amount, property.minTransferAmount);
        }
        if (amount > property.maxTransferAmount) {
            revert TransferAmountExceedsLimit(propertyId, amount, property.maxTransferAmount);
        }
    }

    /**
     * @dev 소유권 정보 업데이트 내부 함수
     * @param owner 소유자
     * @param propertyId 부동산 ID
     * @param tokens 토큰 수량
     */
    function _updateOwnership(
        address owner,
        uint256 propertyId,
        uint256 tokens
    ) internal {
        Property storage property = properties[propertyId];
        
        // 기존 소유권 정보 업데이트
        Ownership storage ownership = ownerships[owner][propertyId];
        if (ownership.propertyId == 0) {
            // 새로운 소유자 추가
            ownership.propertyId = propertyId;
            ownership.tokens = tokens;
            ownership.firstAcquired = block.timestamp;
            ownership.lockupEndTime = block.timestamp + property.lockupPeriod;
            propertyOwners[propertyId].push(owner);
        } else {
            // 기존 소유자 토큰 수량 업데이트
            ownership.tokens += tokens;
        }
        
        // 소유 비율 계산
        ownership.percentage = (ownership.tokens * BASIS_POINTS) / property.totalTokens;
        ownership.lastUpdated = block.timestamp;

        // 사용자 부동산 목록에 추가 (중복 방지)
        uint256[] storage userProps = userProperties[owner];
        bool exists = false;
        for (uint256 i = 0; i < userProps.length; i++) {
            if (userProps[i] == propertyId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            userProps.push(propertyId);
        }

        emit OwnershipUpdated(owner, propertyId, ownership.tokens, ownership.percentage);
    }

    /**
     * @dev 토큰 전송 (ERC-1400 규정 준수)
     * @param to 수신자 주소
     * @param amount 전송할 토큰 수량
     * @return 성공 여부
     */
    function transfer(
        address to,
        uint256 amount
    ) public override(ERC20) whenNotPaused onlyKYCVerified(msg.sender) onlyKYCVerified(to) withinTransactionLimits(msg.sender, amount) returns (bool) {
        // 전송 제한 검증
        _validateTransferWithRestrictions(0, msg.sender, to, amount);
        
        // 전송 수수료 계산 및 처리
        uint256 netAmount = _calculateAndDeductTransferFee(msg.sender, amount);
        
        bool success = super.transfer(to, netAmount);
        if (success) {
            _updateOwnershipAfterTransfer(msg.sender, to, netAmount);
        }
        return success;
    }

    /**
     * @dev 토큰 전송 (허용량 사용)
     * @param from 발신자 주소
     * @param to 수신자 주소
     * @param amount 전송할 토큰 수량
     * @return 성공 여부
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override(ERC20) whenNotPaused onlyKYCVerified(from) onlyKYCVerified(to) withinTransactionLimits(from, amount) returns (bool) {
        // 전송 제한 검증
        _validateTransferWithRestrictions(0, from, to, amount);
        
        // 전송 수수료 계산 및 처리
        uint256 netAmount = _calculateAndDeductTransferFee(from, amount);
        
        bool success = super.transferFrom(from, to, netAmount);
        if (success) {
            _updateOwnershipAfterTransfer(from, to, netAmount);
        }
        return success;
    }

    /**
     * @dev 전송 수수료 계산 및 공제
     * @param from 발신자
     * @param amount 전송 금액
     * @return 수수료 공제 후 순수 금액
     */
    function _calculateAndDeductTransferFee(
        address from,
        uint256 amount
    ) internal returns (uint256) {
        // 모든 부동산에 대해 수수료 계산
        uint256[] storage userProps = userProperties[from];
        uint256 totalFee = 0;
        
        for (uint256 i = 0; i < userProps.length; i++) {
            uint256 propertyId = userProps[i];
            Property storage property = properties[propertyId];
            Ownership storage ownership = ownerships[from][propertyId];
            
            if (ownership.tokens > 0) {
                // 해당 부동산의 비율에 따른 수수료 계산
                uint256 propertyFee = (amount * property.transferFee * ownership.percentage) / (BASIS_POINTS * BASIS_POINTS);
                totalFee += propertyFee;
            }
        }
        
        // 수수료를 컨트랙트 소유자에게 전송
        if (totalFee > 0) {
            _transfer(from, owner(), totalFee);
        }
        
        return amount - totalFee;
    }

    /**
     * @dev 강제 전송 (관리자만 가능)
     * @param from 발신자 주소
     * @param to 수신자 주소
     * @param amount 전송할 토큰 수량
     * @return 성공 여부
     */
    function forcedTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyRole(ISSUER_ROLE) nonReentrant returns (bool) {
        require(from != address(0) && to != address(0), 'Invalid addresses');
        require(amount > 0, 'Amount must be greater than 0');

        _transfer(from, to, amount);
        _updateOwnershipAfterTransfer(from, to, amount);
        emit TokenTransferred(from, to, amount, true, 0);
        return true;
    }

    /**
     * @dev KYC 화이트리스트 관리 (KYCVerification 컨트랙트와 연동)
     * @param account 주소
     * @param status KYC 상태
     */
    function setKYCStatus(
        address account,
        bool status
    ) external onlyRole(KYC_ROLE) {
        // KYCVerification 컨트랙트의 화이트리스트 상태를 업데이트
        kycVerification.setWhitelistStatus(account, status);
        
        // 기존 호환성을 위해 로컬 화이트리스트도 업데이트
        kycWhitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /**
     * @dev 주소 동결/해제 (KYCVerification 컨트랙트와 연동)
     * @param account 주소
     * @param status 동결 상태
     */
    function setFrozenStatus(
        address account,
        bool status
    ) external onlyRole(ISSUER_ROLE) {
        // KYCVerification 컨트랙트의 블랙리스트 상태를 업데이트
        kycVerification.setBlacklistStatus(account, status);
        
        // 기존 호환성을 위해 로컬 동결 상태도 업데이트
        frozenAddresses[account] = status;
        emit AddressFrozen(account, status);
    }

    /**
     * @dev KYC 상태 확인 (KYCVerification 컨트랙트 사용)
     * @param account 확인할 주소
     * @return KYC 인증 여부
     */
    function isKYCVerified(address account) external view returns (bool) {
        return kycVerification.isKYCVerified(account);
    }

    /**
     * @dev 주소 동결 상태 확인 (KYCVerification 컨트랙트 사용)
     * @param account 확인할 주소
     * @return 동결 여부
     */
    function isFrozen(address account) external view returns (bool) {
        return kycVerification.isBlacklisted(account);
    }

    /**
     * @dev KYCVerification 컨트랙트 주소 업데이트
     * @param newKYCVerification 새로운 KYC 검증 컨트랙트 주소
     */
    function updateKYCVerificationContract(address newKYCVerification) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newKYCVerification != address(0), 'Invalid KYC verification address');
        kycVerification = KYCVerification(newKYCVerification);
    }

    /**
     * @dev 컨트랙트 일시 중지
     */
    function pause() external onlyRole(ISSUER_ROLE) {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 중지 해제
     */
    function unpause() external onlyRole(ISSUER_ROLE) {
        _unpause();
    }

    /**
     * @dev 전송 검증 내부 함수
     * @param from 발신자
     * @param to 수신자
     * @param amount 수량
     */
    function _validateTransfer(
        address from,
        address to,
        uint256 amount
    ) internal view {
        require(amount > 0, 'Amount must be greater than 0');
        require(to != address(0), 'Cannot transfer to zero address');

        // KYC 검증은 modifier에서 처리됨
        // 동결된 주소 확인은 KYCVerification 컨트랙트에서 처리됨

        // 잔액 확인
        if (balanceOf(from) < amount) {
            revert InsufficientBalance(from, amount, balanceOf(from));
        }
    }

    /**
     * @dev 전송 후 소유권 정보 업데이트
     * @param from 발신자
     * @param to 수신자
     * @param amount 수량
     */
    function _updateOwnershipAfterTransfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        // 모든 부동산에 대해 소유권 정보 업데이트
        uint256[] storage fromProps = userProperties[from];
        for (uint256 i = 0; i < fromProps.length; i++) {
            uint256 propertyId = fromProps[i];
            Ownership storage fromOwnership = ownerships[from][propertyId];
            
            if (fromOwnership.tokens > 0) {
                // 전송할 토큰이 해당 부동산 소유권보다 작은 경우
                uint256 transferAmount = amount > fromOwnership.tokens ? fromOwnership.tokens : amount;
                
                // 발신자 소유권 감소
                fromOwnership.tokens -= transferAmount;
                fromOwnership.percentage = (fromOwnership.tokens * BASIS_POINTS) / properties[propertyId].totalTokens;
                fromOwnership.lastUpdated = block.timestamp;
                
                // 수신자 소유권 증가
                _updateOwnership(to, propertyId, transferAmount);
                
                amount -= transferAmount;
                if (amount == 0) break;
            }
        }
    }

    /**
     * @dev ERC20 표준 지원
     */
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ============ ERC-1400 표준 구현 ============

    // 파티션 관련 상태 변수
    mapping(bytes32 => mapping(address => uint256)) private _balancesByPartition;
    mapping(address => bytes32[]) private _partitionsOf;
    mapping(bytes32 => bool) private _isPartition;

    // 기본 파티션 (전체 토큰)
    bytes32 public constant DEFAULT_PARTITION = bytes32(0);

    /**
     * @dev ERC-1400: 파티션별 잔액 조회
     */
    function balanceOfByPartition(bytes32 partition, address tokenHolder) external view override returns (uint256) {
        return _balancesByPartition[partition][tokenHolder];
    }

    /**
     * @dev ERC-1400: 토큰 홀더의 파티션 목록 조회
     */
    function partitionsOf(address tokenHolder) external view override returns (bytes32[] memory) {
        return _partitionsOf[tokenHolder];
    }

    /**
     * @dev ERC-1400: 파티션별 토큰 전송
     */
    function transferByPartition(
        bytes32 partition,
        address to,
        uint256 amount,
        bytes calldata data
    ) external override returns (bytes32) {
        require(_isPartition[partition], "Invalid partition");
        require(_balancesByPartition[partition][msg.sender] >= amount, "Insufficient balance in partition");
        
        _transferByPartition(partition, msg.sender, to, amount, data, "");
        
        return partition;
    }

    /**
     * @dev ERC-1400: 오퍼레이터를 통한 파티션별 토큰 전송
     */
    function operatorTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external override returns (bytes32) {
        require(_isPartition[partition], "Invalid partition");
        require(hasRole(OPERATOR_ROLE, msg.sender), "Not authorized operator");
        require(_balancesByPartition[partition][from] >= amount, "Insufficient balance in partition");
        
        _transferByPartition(partition, from, to, amount, data, operatorData);
        
        return partition;
    }

    /**
     * @dev ERC-1400: 토큰 발행
     */
    function issueTokens(address to, uint256 amount, bytes calldata data) external override returns (bool) {
        require(hasRole(ISSUER_ROLE, msg.sender), "Not authorized issuer");
        require(to != address(0), "Cannot issue to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        _mint(to, amount);
        _balancesByPartition[DEFAULT_PARTITION][to] += amount;
        _addPartitionToHolder(to, DEFAULT_PARTITION);
        
        emit Issued(msg.sender, to, amount, data);
        return true;
    }

    /**
     * @dev ERC-1400: 토큰 소각
     */
    function redeemTokens(uint256 amount, bytes calldata data) external override returns (bool) {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(amount > 0, "Amount must be greater than 0");
        
        _burn(msg.sender, amount);
        _balancesByPartition[DEFAULT_PARTITION][msg.sender] -= amount;
        
        emit Redeemed(msg.sender, msg.sender, amount, data);
        return true;
    }

    /**
     * @dev ERC-1400: 데이터와 함께 토큰 전송
     */
    function transferWithData(address to, uint256 amount, bytes calldata data) external override returns (bool) {
        return transfer(to, amount);
    }

    /**
     * @dev ERC-1400: 데이터와 함께 토큰 전송 (from)
     */
    function transferFromWithData(address from, address to, uint256 amount, bytes calldata data) external override returns (bool) {
        return transferFrom(from, to, amount);
    }

    /**
     * @dev ERC-1400: 발행자 권한 확인
     */
    function isIssuer(address operator) external view override returns (bool) {
        return hasRole(ISSUER_ROLE, operator);
    }

    /**
     * @dev ERC-1400: 오퍼레이터 권한 확인
     */
    function isOperator(address operator) external view override returns (bool) {
        return hasRole(OPERATOR_ROLE, operator);
    }

    /**
     * @dev ERC-1400: 오퍼레이터 권한 부여
     */
    function authorizeOperator(address operator) external override {
        require(operator != address(0), "Invalid operator address");
        _authorizedOperators[msg.sender][operator] = true;
        emit AuthorizedOperator(operator, msg.sender);
    }

    /**
     * @dev ERC-1400: 오퍼레이터 권한 회수
     */
    function revokeOperator(address operator) external override {
        _authorizedOperators[msg.sender][operator] = false;
        emit RevokedOperator(operator, msg.sender);
    }

    /**
     * @dev ERC-1400: 파티션별 오퍼레이터 권한 부여
     */
    function authorizeOperatorByPartition(bytes32 partition, address operator) external override {
        require(_isPartition[partition], "Invalid partition");
        require(operator != address(0), "Invalid operator address");
        _authorizedOperatorsByPartition[msg.sender][partition][operator] = true;
        emit AuthorizedOperatorByPartition(partition, operator, msg.sender);
    }

    /**
     * @dev ERC-1400: 파티션별 오퍼레이터 권한 회수
     */
    function revokeOperatorByPartition(bytes32 partition, address operator) external override {
        _authorizedOperatorsByPartition[msg.sender][partition][operator] = false;
        emit RevokedOperatorByPartition(partition, operator, msg.sender);
    }

    /**
     * @dev ERC-1400: 전송 가능 여부 확인
     */
    function isTransferable(bytes32 partition, address to, uint256 amount, bytes calldata data) external view override returns (bool) {
        (bool transferable, , ) = canTransfer(partition, to, amount, data);
        return transferable;
    }

    /**
     * @dev ERC-1400: 전송 가능 여부 및 이유 확인
     */
    function canTransfer(bytes32 partition, address to, uint256 amount, bytes calldata data) public view override returns (bool, bytes32, bytes32) {
        // 기본 검증
        if (to == address(0)) {
            return (false, bytes32("INVALID_RECIPIENT"), bytes32(""));
        }
        if (amount == 0) {
            return (false, bytes32("INVALID_AMOUNT"), bytes32(""));
        }
        if (paused()) {
            return (false, bytes32("CONTRACT_PAUSED"), bytes32(""));
        }
        
        // KYC 검증
        if (!kycVerification.isKYCVerified(to)) {
            return (false, bytes32("KYC_NOT_VERIFIED"), bytes32(""));
        }
        
        // 동결 상태 확인
        if (kycVerification.isBlacklisted(to)) {
            return (false, bytes32("ADDRESS_FROZEN"), bytes32(""));
        }
        
        return (true, bytes32("SUCCESS"), bytes32(""));
    }

    // 내부 함수들
    mapping(address => mapping(address => bool)) private _authorizedOperators;
    mapping(address => mapping(bytes32 => mapping(address => bool))) private _authorizedOperatorsByPartition;

    /**
     * @dev 파티션별 전송 내부 함수
     */
    function _transferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        _balancesByPartition[partition][from] -= amount;
        _balancesByPartition[partition][to] += amount;
        
        _addPartitionToHolder(to, partition);
        
        emit TransferByPartition(partition, msg.sender, from, to, amount, data, operatorData);
    }

    /**
     * @dev 토큰 홀더에 파티션 추가
     */
    function _addPartitionToHolder(address tokenHolder, bytes32 partition) internal {
        bytes32[] storage partitions = _partitionsOf[tokenHolder];
        bool exists = false;
        
        for (uint256 i = 0; i < partitions.length; i++) {
            if (partitions[i] == partition) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            partitions.push(partition);
        }
    }

    /**
     * @dev 파티션 생성
     */
    function _createPartition(bytes32 partition) internal {
        _isPartition[partition] = true;
    }
}