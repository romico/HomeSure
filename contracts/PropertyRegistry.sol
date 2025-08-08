// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import './PropertyToken.sol';

/**
 * @title PropertyRegistry
 * @dev 부동산 등록 및 토큰화 시스템
 * 부동산 자산을 등록하고 토큰으로 변환하는 핵심 비즈니스 로직을 제공합니다.
 */
contract PropertyRegistry is Ownable, AccessControl, Pausable, ReentrancyGuard {
    using Strings for uint256;

    // 역할 정의
    bytes32 public constant REGISTRAR_ROLE = keccak256('REGISTRAR_ROLE');
    bytes32 public constant VALIDATOR_ROLE = keccak256('VALIDATOR_ROLE');
    bytes32 public constant ORACLE_ROLE = keccak256('ORACLE_ROLE');

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

    // 문서 유형 열거형
    enum DocumentType {
        REGISTRATION_CERTIFICATE,  // 0: 등기부등본
        APPRAISAL_REPORT,         // 1: 감정평가서
        PROPERTY_PHOTOS,          // 2: 부동산 사진
        OWNERSHIP_DOCUMENT,       // 3: 소유권 증명서
        TAX_DOCUMENT,             // 4: 세금 관련 문서
        INSURANCE_DOCUMENT,       // 5: 보험 관련 문서
        OTHER                     // 6: 기타
    }

    // 부동산 정보 구조체
    struct Property {
        uint256 propertyId;
        string location;
        uint256 totalValue;      // 부동산 총 가치 (wei)
        uint256 landArea;        // 토지 면적 (제곱미터)
        uint256 buildingArea;    // 건물 면적 (제곱미터)
        uint256 yearBuilt;       // 건축년도
        PropertyStatus status;
        PropertyType propertyType;
        uint256 createdAt;
        uint256 updatedAt;
        address owner;           // 부동산 소유자
        string metadata;         // IPFS 해시 등 추가 메타데이터
        uint256 registrationFee; // 등록 수수료
        bool isTokenized;        // 토큰화 여부
        uint256 tokenContractId; // 연결된 토큰 컨트랙트 ID
    }

    // 문서 정보 구조체
    struct Document {
        uint256 documentId;
        uint256 propertyId;
        DocumentType documentType;
        string ipfsHash;
        string fileName;
        uint256 fileSize;
        uint256 uploadedAt;
        address uploadedBy;
        bool isVerified;
        string verificationNote;
        uint256 version;           // 문서 버전
        bool isEncrypted;          // 암호화 여부
        string encryptionKey;      // 암호화 키 (해시)
        string documentHash;       // 문서 해시 (무결성 검증용)
        uint256 verifiedAt;        // 검증 완료 시간
        address verifiedBy;        // 검증자
        bool isActive;             // 활성 상태
    }

    // 등록 요청 구조체
    struct RegistrationRequest {
        uint256 requestId;
        uint256 propertyId;
        address requester;
        string location;
        uint256 totalValue;
        uint256 landArea;
        uint256 buildingArea;
        uint256 yearBuilt;
        PropertyType propertyType;
        string metadata;
        uint256 registrationFee;
        bool isApproved;
        bool isRejected;
        string rejectionReason;
        uint256 createdAt;
        uint256 processedAt;
    }

    // 소유권 이전 히스토리 구조체
    struct OwnershipHistory {
        uint256 historyId;
        uint256 propertyId;
        address previousOwner;
        address newOwner;
        uint256 transferAmount;
        uint256 transferDate;
        string transferReason;
        uint256 tokenAmount;
        uint256 ownershipPercentage; // 소유권 비율 (basis points)
        string transactionHash;       // 트랜잭션 해시
    }

    // 소유권 현황 구조체
    struct OwnershipStatus {
        uint256 propertyId;
        address owner;
        uint256 totalTokens;
        uint256 ownershipPercentage;
        uint256 lastUpdated;
        bool isActive;
    }

    // 부동산 상태 변경 히스토리 구조체
    struct StatusChangeHistory {
        uint256 historyId;
        uint256 propertyId;
        PropertyStatus oldStatus;
        PropertyStatus newStatus;
        uint256 changedAt;
        address changedBy;
        string reason;
        bool isAutomatic;
    }

    // 상태 변수
    uint256 private _propertyIds;
    uint256 private _documentIds;
    uint256 private _registrationRequestIds;
    uint256 private _ownershipHistoryIds;
    uint256 private _statusChangeHistoryIds;
    uint256 private _ownershipStatusIds;
    
    // 기본 설정
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_REGISTRATION_FEE = 0.001 ether;    // 0.001 ETH
    uint256 public constant MAX_REGISTRATION_FEE = 0.1 ether;      // 0.1 ETH
    uint256 public constant DEFAULT_REGISTRATION_FEE = 0.01 ether; // 0.01 ETH
    uint256 public constant MIN_PROPERTY_VALUE = 1000 ether;       // 1000 ETH
    uint256 public constant MAX_PROPERTY_VALUE = 1000000 ether;    // 1M ETH
    
    // 매핑
    mapping(uint256 => Property) public properties;
    mapping(uint256 => Document) public documents;
    mapping(uint256 => RegistrationRequest) public registrationRequests;
    mapping(uint256 => OwnershipHistory) public ownershipHistories;
    mapping(uint256 => StatusChangeHistory) public statusChangeHistories;
    mapping(uint256 => uint256[]) public propertyDocuments; // 부동산별 문서 목록
    mapping(uint256 => uint256[]) public propertyOwnershipHistory; // 부동산별 소유권 이력
    mapping(uint256 => uint256[]) public propertyStatusHistory; // 부동산별 상태 변경 이력
    mapping(address => uint256[]) public userProperties; // 사용자별 부동산 목록
    mapping(address => uint256[]) public userRegistrationRequests; // 사용자별 등록 요청 목록
    mapping(string => bool) public locationExists; // 위치 중복 확인
    mapping(uint256 => bool) public propertyExists; // 부동산 ID 존재 확인
    mapping(PropertyStatus => uint256[]) public propertiesByStatus; // 상태별 부동산 목록
    mapping(uint256 => OwnershipStatus) public ownershipStatuses; // 소유권 현황
    mapping(uint256 => uint256[]) public propertyOwnershipStatuses; // 부동산별 소유권 현황 목록
    mapping(address => uint256[]) public ownerProperties; // 소유자별 부동산 목록
    mapping(address => mapping(uint256 => uint256)) public ownerTokenBalances; // 소유자별 토큰 잔액

    // PropertyToken 컨트랙트 참조
    PropertyToken public propertyToken;

    // 이벤트 정의
    event PropertyRegistered(
        uint256 indexed propertyId,
        string location,
        uint256 totalValue,
        PropertyType propertyType,
        address indexed owner
    );

    event RegistrationRequestCreated(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester,
        string location,
        uint256 totalValue
    );

    event RegistrationRequestApproved(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester
    );

    event RegistrationRequestRejected(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester,
        string reason
    );

    event DocumentUploaded(
        uint256 indexed documentId,
        uint256 indexed propertyId,
        DocumentType documentType,
        string ipfsHash,
        address indexed uploadedBy
    );

    event DocumentVerified(
        uint256 indexed documentId,
        uint256 indexed propertyId,
        address indexed verifiedBy,
        string note
    );

    event DocumentVersionUpdated(
        uint256 indexed documentId,
        uint256 indexed propertyId,
        uint256 oldVersion,
        uint256 newVersion
    );

    event DocumentEncrypted(
        uint256 indexed documentId,
        uint256 indexed propertyId,
        bool isEncrypted,
        string encryptionKey
    );

    event DocumentDeactivated(
        uint256 indexed documentId,
        uint256 indexed propertyId,
        address indexed deactivatedBy
    );

    event PropertyStatusUpdated(
        uint256 indexed propertyId,
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    );

    event StatusChangeHistoryRecorded(
        uint256 indexed historyId,
        uint256 indexed propertyId,
        PropertyStatus oldStatus,
        PropertyStatus newStatus,
        address indexed changedBy,
        bool isAutomatic
    );

    event AutomaticStatusTransition(
        uint256 indexed propertyId,
        PropertyStatus oldStatus,
        PropertyStatus newStatus,
        string trigger
    );

    event OwnershipTransferred(
        uint256 indexed propertyId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 transferAmount
    );

    event OwnershipStatusUpdated(
        uint256 indexed propertyId,
        address indexed owner,
        uint256 totalTokens,
        uint256 ownershipPercentage
    );

    event TokenBalanceUpdated(
        address indexed owner,
        uint256 indexed propertyId,
        uint256 oldBalance,
        uint256 newBalance
    );

    event PropertyTokenized(
        uint256 indexed propertyId,
        uint256 indexed tokenContractId,
        address indexed owner
    );

    // 에러 정의
    error PropertyNotFound(uint256 propertyId);
    error PropertyAlreadyExists(uint256 propertyId);
    error LocationAlreadyExists(string location);
    error InvalidPropertyValue(uint256 value);
    error InvalidRegistrationFee(uint256 fee);
    error RegistrationRequestNotFound(uint256 requestId);
    error RegistrationRequestAlreadyProcessed(uint256 requestId);
    error DocumentNotFound(uint256 documentId);
    error UnauthorizedOperation(address caller, bytes32 role);
    error InvalidPropertyType();
    error InvalidDocumentType();
    error PropertyNotActive(uint256 propertyId);
    error PropertyAlreadyTokenized(uint256 propertyId);
    error PropertyNotTokenized(uint256 propertyId);

    /**
     * @dev 생성자
     * @param _propertyToken PropertyToken 컨트랙트 주소
     */
    constructor(address _propertyToken) Ownable(msg.sender) {
        require(_propertyToken != address(0), 'Invalid PropertyToken address');
        
        propertyToken = PropertyToken(_propertyToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    /**
     * @dev 부동산 등록 요청 생성
     * @param location 부동산 위치
     * @param totalValue 부동산 총 가치
     * @param landArea 토지 면적
     * @param buildingArea 건물 면적
     * @param yearBuilt 건축년도
     * @param propertyType 부동산 유형
     * @param metadata 추가 메타데이터
     * @return requestId 등록 요청 ID
     */
    function createRegistrationRequest(
        string memory location,
        uint256 totalValue,
        uint256 landArea,
        uint256 buildingArea,
        uint256 yearBuilt,
        PropertyType propertyType,
        string memory metadata
    ) external payable nonReentrant returns (uint256 requestId) {
        require(bytes(location).length > 0, 'Location cannot be empty');
        require(totalValue >= MIN_PROPERTY_VALUE, 'Property value too low');
        require(totalValue <= MAX_PROPERTY_VALUE, 'Property value too high');
        require(landArea > 0, 'Land area must be greater than 0');
        require(buildingArea >= 0, 'Building area cannot be negative');
        require(yearBuilt > 1900 && yearBuilt <= block.timestamp, 'Invalid year built');
        require(msg.value >= DEFAULT_REGISTRATION_FEE, 'Insufficient registration fee');

        // 위치 중복 확인
        if (locationExists[location]) {
            revert LocationAlreadyExists(location);
        }

        _registrationRequestIds++;
        requestId = _registrationRequestIds;

        registrationRequests[requestId] = RegistrationRequest({
            requestId: requestId,
            propertyId: 0, // 아직 할당되지 않음
            requester: msg.sender,
            location: location,
            totalValue: totalValue,
            landArea: landArea,
            buildingArea: buildingArea,
            yearBuilt: yearBuilt,
            propertyType: propertyType,
            metadata: metadata,
            registrationFee: msg.value,
            isApproved: false,
            isRejected: false,
            rejectionReason: '',
            createdAt: block.timestamp,
            processedAt: 0
        });

        // 사용자별 등록 요청 목록에 추가
        userRegistrationRequests[msg.sender].push(requestId);

        emit RegistrationRequestCreated(requestId, 0, msg.sender, location, totalValue);
    }

    /**
     * @dev 등록 요청 승인
     * @param requestId 요청 ID
     */
    function approveRegistrationRequest(uint256 requestId) external onlyRole(REGISTRAR_ROLE) nonReentrant {
        RegistrationRequest storage request = registrationRequests[requestId];
        if (request.requestId == 0) {
            revert RegistrationRequestNotFound(requestId);
        }
        if (request.isApproved || request.isRejected) {
            revert RegistrationRequestAlreadyProcessed(requestId);
        }

        // 부동산 ID 할당
        _propertyIds++;
        uint256 propertyId = _propertyIds;

        // 위치 중복 확인
        if (locationExists[request.location]) {
            revert LocationAlreadyExists(request.location);
        }

        // 부동산 등록
        properties[propertyId] = Property({
            propertyId: propertyId,
            location: request.location,
            totalValue: request.totalValue,
            landArea: request.landArea,
            buildingArea: request.buildingArea,
            yearBuilt: request.yearBuilt,
            status: PropertyStatus.PENDING,
            propertyType: request.propertyType,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            owner: request.requester,
            metadata: request.metadata,
            registrationFee: request.registrationFee,
            isTokenized: false,
            tokenContractId: 0
        });

        // 요청 정보 업데이트
        request.propertyId = propertyId;
        request.isApproved = true;
        request.processedAt = block.timestamp;

        // 매핑 업데이트
        locationExists[request.location] = true;
        propertyExists[propertyId] = true;
        userProperties[request.requester].push(propertyId);

        emit RegistrationRequestApproved(requestId, propertyId, request.requester);
        emit PropertyRegistered(propertyId, request.location, request.totalValue, request.propertyType, request.requester);
    }

    /**
     * @dev 등록 요청 거부
     * @param requestId 요청 ID
     * @param reason 거부 사유
     */
    function rejectRegistrationRequest(
        uint256 requestId,
        string memory reason
    ) external onlyRole(REGISTRAR_ROLE) {
        RegistrationRequest storage request = registrationRequests[requestId];
        if (request.requestId == 0) {
            revert RegistrationRequestNotFound(requestId);
        }
        if (request.isApproved || request.isRejected) {
            revert RegistrationRequestAlreadyProcessed(requestId);
        }

        request.isRejected = true;
        request.rejectionReason = reason;
        request.processedAt = block.timestamp;

        // 등록 수수료 환불
        payable(request.requester).transfer(request.registrationFee);

        emit RegistrationRequestRejected(requestId, 0, request.requester, reason);
    }

    /**
     * @dev 문서 업로드 (기본 버전)
     * @param propertyId 부동산 ID
     * @param documentType 문서 유형
     * @param ipfsHash IPFS 해시
     * @param fileName 파일명
     * @param fileSize 파일 크기
     */
    function uploadDocument(
        uint256 propertyId,
        DocumentType documentType,
        string memory ipfsHash,
        string memory fileName,
        uint256 fileSize
    ) external {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (properties[propertyId].owner != msg.sender && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert UnauthorizedOperation(msg.sender, REGISTRAR_ROLE);
        }
        require(bytes(ipfsHash).length > 0, 'IPFS hash cannot be empty');
        require(bytes(fileName).length > 0, 'File name cannot be empty');
        require(fileSize > 0, 'File size must be greater than 0');

        _documentIds++;
        uint256 documentId = _documentIds;

        documents[documentId] = Document({
            documentId: documentId,
            propertyId: propertyId,
            documentType: documentType,
            ipfsHash: ipfsHash,
            fileName: fileName,
            fileSize: fileSize,
            uploadedAt: block.timestamp,
            uploadedBy: msg.sender,
            isVerified: false,
            verificationNote: '',
            version: 1,
            isEncrypted: false,
            encryptionKey: '',
            documentHash: '',
            verifiedAt: 0,
            verifiedBy: address(0),
            isActive: true
        });

        // 부동산별 문서 목록에 추가
        propertyDocuments[propertyId].push(documentId);

        emit DocumentUploaded(documentId, propertyId, documentType, ipfsHash, msg.sender);
    }

    /**
     * @dev 문서 업로드 (고급 버전)
     * @param propertyId 부동산 ID
     * @param documentType 문서 유형
     * @param ipfsHash IPFS 해시
     * @param fileName 파일명
     * @param fileSize 파일 크기
     * @param documentHash 문서 해시 (무결성 검증용)
     * @param isEncrypted 암호화 여부
     * @param encryptionKey 암호화 키 해시
     */
    function uploadDocumentAdvanced(
        uint256 propertyId,
        DocumentType documentType,
        string memory ipfsHash,
        string memory fileName,
        uint256 fileSize,
        string memory documentHash,
        bool isEncrypted,
        string memory encryptionKey
    ) external {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (properties[propertyId].owner != msg.sender && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert UnauthorizedOperation(msg.sender, REGISTRAR_ROLE);
        }
        require(bytes(ipfsHash).length > 0, 'IPFS hash cannot be empty');
        require(bytes(fileName).length > 0, 'File name cannot be empty');
        require(fileSize > 0, 'File size must be greater than 0');

        _documentIds++;
        uint256 documentId = _documentIds;

        documents[documentId] = Document({
            documentId: documentId,
            propertyId: propertyId,
            documentType: documentType,
            ipfsHash: ipfsHash,
            fileName: fileName,
            fileSize: fileSize,
            uploadedAt: block.timestamp,
            uploadedBy: msg.sender,
            isVerified: false,
            verificationNote: '',
            version: 1,
            isEncrypted: isEncrypted,
            encryptionKey: encryptionKey,
            documentHash: documentHash,
            verifiedAt: 0,
            verifiedBy: address(0),
            isActive: true
        });

        // 부동산별 문서 목록에 추가
        propertyDocuments[propertyId].push(documentId);

        emit DocumentUploaded(documentId, propertyId, documentType, ipfsHash, msg.sender);
        
        if (isEncrypted) {
            emit DocumentEncrypted(documentId, propertyId, isEncrypted, encryptionKey);
        }
    }

    /**
     * @dev 문서 검증
     * @param documentId 문서 ID
     * @param note 검증 노트
     */
    function verifyDocument(
        uint256 documentId,
        string memory note
    ) external onlyRole(VALIDATOR_ROLE) {
        Document storage document = documents[documentId];
        if (document.documentId == 0) {
            revert DocumentNotFound(documentId);
        }

        document.isVerified = true;
        document.verificationNote = note;
        document.verifiedAt = block.timestamp;
        document.verifiedBy = msg.sender;

        emit DocumentVerified(documentId, document.propertyId, msg.sender, note);
    }

    /**
     * @dev 문서 버전 업데이트
     * @param documentId 문서 ID
     * @param newIpfsHash 새로운 IPFS 해시
     * @param newDocumentHash 새로운 문서 해시
     */
    function updateDocumentVersion(
        uint256 documentId,
        string memory newIpfsHash,
        string memory newDocumentHash
    ) external {
        Document storage document = documents[documentId];
        if (document.documentId == 0) {
            revert DocumentNotFound(documentId);
        }
        if (document.uploadedBy != msg.sender && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert UnauthorizedOperation(msg.sender, REGISTRAR_ROLE);
        }
        require(bytes(newIpfsHash).length > 0, 'New IPFS hash cannot be empty');

        uint256 oldVersion = document.version;
        document.version = oldVersion + 1;
        document.ipfsHash = newIpfsHash;
        document.documentHash = newDocumentHash;
        document.uploadedAt = block.timestamp;
        document.isVerified = false;
        document.verificationNote = '';
        document.verifiedAt = 0;
        document.verifiedBy = address(0);

        emit DocumentVersionUpdated(documentId, document.propertyId, oldVersion, document.version);
    }

    /**
     * @dev 문서 암호화 설정
     * @param documentId 문서 ID
     * @param isEncrypted 암호화 여부
     * @param encryptionKey 암호화 키 해시
     */
    function setDocumentEncryption(
        uint256 documentId,
        bool isEncrypted,
        string memory encryptionKey
    ) external {
        Document storage document = documents[documentId];
        if (document.documentId == 0) {
            revert DocumentNotFound(documentId);
        }
        if (document.uploadedBy != msg.sender && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert UnauthorizedOperation(msg.sender, REGISTRAR_ROLE);
        }

        document.isEncrypted = isEncrypted;
        document.encryptionKey = encryptionKey;

        emit DocumentEncrypted(documentId, document.propertyId, isEncrypted, encryptionKey);
    }

    /**
     * @dev 문서 비활성화
     * @param documentId 문서 ID
     */
    function deactivateDocument(uint256 documentId) external {
        Document storage document = documents[documentId];
        if (document.documentId == 0) {
            revert DocumentNotFound(documentId);
        }
        if (document.uploadedBy != msg.sender && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert UnauthorizedOperation(msg.sender, REGISTRAR_ROLE);
        }

        document.isActive = false;

        emit DocumentDeactivated(documentId, document.propertyId, msg.sender);
    }

    /**
     * @dev 문서 무결성 검증
     * @param documentId 문서 ID
     * @param providedHash 제공된 문서 해시
     * @return 무결성 검증 결과
     */
    function verifyDocumentIntegrity(
        uint256 documentId,
        string memory providedHash
    ) external view returns (bool) {
        Document storage document = documents[documentId];
        if (document.documentId == 0) {
            revert DocumentNotFound(documentId);
        }

        return keccak256(bytes(document.documentHash)) == keccak256(bytes(providedHash));
    }

    /**
     * @dev 부동산 상태 업데이트 (기본 버전)
     * @param propertyId 부동산 ID
     * @param newStatus 새로운 상태
     */
    function updatePropertyStatus(
        uint256 propertyId,
        PropertyStatus newStatus
    ) external onlyRole(REGISTRAR_ROLE) {
        _updatePropertyStatus(propertyId, newStatus, '', false);
    }

    /**
     * @dev 부동산 상태 업데이트 (고급 버전)
     * @param propertyId 부동산 ID
     * @param newStatus 새로운 상태
     * @param reason 상태 변경 사유
     */
    function updatePropertyStatusWithReason(
        uint256 propertyId,
        PropertyStatus newStatus,
        string memory reason
    ) external onlyRole(REGISTRAR_ROLE) {
        _updatePropertyStatus(propertyId, newStatus, reason, false);
    }

    /**
     * @dev 부동산 상태 업데이트 내부 함수
     * @param propertyId 부동산 ID
     * @param newStatus 새로운 상태
     * @param reason 상태 변경 사유
     * @param isAutomatic 자동 변경 여부
     */
    function _updatePropertyStatus(
        uint256 propertyId,
        PropertyStatus newStatus,
        string memory reason,
        bool isAutomatic
    ) internal {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }

        PropertyStatus oldStatus = properties[propertyId].status;
        
        // 상태 전환 규칙 검증
        if (!_isValidStatusTransition(oldStatus, newStatus)) {
            revert InvalidPropertyType();
        }

        // 상태별 접근 권한 검증
        if (!_hasStatusChangePermission(msg.sender, oldStatus, newStatus)) {
            revert UnauthorizedOperation(msg.sender, REGISTRAR_ROLE);
        }

        // 상태 변경 히스토리 기록
        _recordStatusChange(propertyId, oldStatus, newStatus, reason, isAutomatic);

        // 부동산 상태 업데이트
        properties[propertyId].status = newStatus;
        properties[propertyId].updatedAt = block.timestamp;

        // 상태별 부동산 목록 업데이트
        _updatePropertiesByStatus(oldStatus, newStatus, propertyId);

        emit PropertyStatusUpdated(propertyId, oldStatus, newStatus);
        
        if (isAutomatic) {
            emit AutomaticStatusTransition(propertyId, oldStatus, newStatus, reason);
        }
    }

    /**
     * @dev 상태 전환 유효성 검증
     * @param oldStatus 이전 상태
     * @param newStatus 새로운 상태
     * @return 유효성 여부
     */
    function _isValidStatusTransition(
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    ) internal pure returns (bool) {
        // PENDING -> ACTIVE, SUSPENDED
        if (oldStatus == PropertyStatus.PENDING) {
            return newStatus == PropertyStatus.ACTIVE || newStatus == PropertyStatus.SUSPENDED;
        }
        // ACTIVE -> SOLD, SUSPENDED
        else if (oldStatus == PropertyStatus.ACTIVE) {
            return newStatus == PropertyStatus.SOLD || newStatus == PropertyStatus.SUSPENDED;
        }
        // SUSPENDED -> ACTIVE
        else if (oldStatus == PropertyStatus.SUSPENDED) {
            return newStatus == PropertyStatus.ACTIVE;
        }
        // SOLD -> (변경 불가)
        else if (oldStatus == PropertyStatus.SOLD) {
            return false;
        }
        
        return false;
    }

    /**
     * @dev 상태 변경 권한 검증
     * @param caller 호출자
     * @param oldStatus 이전 상태
     * @param newStatus 새로운 상태
     * @return 권한 여부
     */
    function _hasStatusChangePermission(
        address caller,
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    ) internal view returns (bool) {
        // REGISTRAR_ROLE은 모든 상태 변경 가능
        if (hasRole(REGISTRAR_ROLE, caller)) {
            return true;
        }

        // 소유자는 특정 상태 변경만 가능
        if (oldStatus == PropertyStatus.PENDING && newStatus == PropertyStatus.ACTIVE) {
            return true;
        }

        return false;
    }

    /**
     * @dev 상태 변경 히스토리 기록
     * @param propertyId 부동산 ID
     * @param oldStatus 이전 상태
     * @param newStatus 새로운 상태
     * @param reason 변경 사유
     * @param isAutomatic 자동 변경 여부
     */
    function _recordStatusChange(
        uint256 propertyId,
        PropertyStatus oldStatus,
        PropertyStatus newStatus,
        string memory reason,
        bool isAutomatic
    ) internal {
        _statusChangeHistoryIds++;
        uint256 historyId = _statusChangeHistoryIds;

        statusChangeHistories[historyId] = StatusChangeHistory({
            historyId: historyId,
            propertyId: propertyId,
            oldStatus: oldStatus,
            newStatus: newStatus,
            changedAt: block.timestamp,
            changedBy: msg.sender,
            reason: reason,
            isAutomatic: isAutomatic
        });

        // 부동산별 상태 변경 이력에 추가
        propertyStatusHistory[propertyId].push(historyId);

        emit StatusChangeHistoryRecorded(historyId, propertyId, oldStatus, newStatus, msg.sender, isAutomatic);
    }

    /**
     * @dev 상태별 부동산 목록 업데이트
     * @param oldStatus 이전 상태
     * @param newStatus 새로운 상태
     * @param propertyId 부동산 ID
     */
    function _updatePropertiesByStatus(
        PropertyStatus oldStatus,
        PropertyStatus newStatus,
        uint256 propertyId
    ) internal {
        // 이전 상태 목록에서 제거
        uint256[] storage oldStatusProps = propertiesByStatus[oldStatus];
        for (uint256 i = 0; i < oldStatusProps.length; i++) {
            if (oldStatusProps[i] == propertyId) {
                oldStatusProps[i] = oldStatusProps[oldStatusProps.length - 1];
                oldStatusProps.pop();
                break;
            }
        }

        // 새 상태 목록에 추가
        propertiesByStatus[newStatus].push(propertyId);
    }

    /**
     * @dev 부동산 토큰화
     * @param propertyId 부동산 ID
     * @param tokenContractId 토큰 컨트랙트 ID
     */
    function tokenizeProperty(
        uint256 propertyId,
        uint256 tokenContractId
    ) external onlyRole(REGISTRAR_ROLE) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (properties[propertyId].status != PropertyStatus.ACTIVE) {
            revert PropertyNotActive(propertyId);
        }
        if (properties[propertyId].isTokenized) {
            revert PropertyAlreadyTokenized(propertyId);
        }

        properties[propertyId].isTokenized = true;
        properties[propertyId].tokenContractId = tokenContractId;
        properties[propertyId].updatedAt = block.timestamp;

        emit PropertyTokenized(propertyId, tokenContractId, properties[propertyId].owner);
    }

    /**
     * @dev 소유권 이전 기록 (기본 버전)
     * @param propertyId 부동산 ID
     * @param previousOwner 이전 소유자
     * @param newOwner 새 소유자
     * @param transferAmount 이전 금액
     * @param transferReason 이전 사유
     * @param tokenAmount 토큰 수량
     */
    function recordOwnershipTransfer(
        uint256 propertyId,
        address previousOwner,
        address newOwner,
        uint256 transferAmount,
        string memory transferReason,
        uint256 tokenAmount
    ) external onlyRole(REGISTRAR_ROLE) {
        _recordOwnershipTransferAdvanced(
            propertyId,
            previousOwner,
            newOwner,
            transferAmount,
            transferReason,
            tokenAmount,
            0,
            ''
        );
    }

    /**
     * @dev 소유권 이전 기록 (고급 버전)
     * @param propertyId 부동산 ID
     * @param previousOwner 이전 소유자
     * @param newOwner 새 소유자
     * @param transferAmount 이전 금액
     * @param transferReason 이전 사유
     * @param tokenAmount 토큰 수량
     * @param ownershipPercentage 소유권 비율
     * @param transactionHash 트랜잭션 해시
     */
    function recordOwnershipTransferAdvanced(
        uint256 propertyId,
        address previousOwner,
        address newOwner,
        uint256 transferAmount,
        string memory transferReason,
        uint256 tokenAmount,
        uint256 ownershipPercentage,
        string memory transactionHash
    ) external onlyRole(REGISTRAR_ROLE) {
        _recordOwnershipTransferAdvanced(
            propertyId,
            previousOwner,
            newOwner,
            transferAmount,
            transferReason,
            tokenAmount,
            ownershipPercentage,
            transactionHash
        );
    }

    /**
     * @dev 소유권 이전 기록 내부 함수
     * @param propertyId 부동산 ID
     * @param previousOwner 이전 소유자
     * @param newOwner 새 소유자
     * @param transferAmount 이전 금액
     * @param transferReason 이전 사유
     * @param tokenAmount 토큰 수량
     * @param ownershipPercentage 소유권 비율
     * @param transactionHash 트랜잭션 해시
     */
    function _recordOwnershipTransferAdvanced(
        uint256 propertyId,
        address previousOwner,
        address newOwner,
        uint256 transferAmount,
        string memory transferReason,
        uint256 tokenAmount,
        uint256 ownershipPercentage,
        string memory transactionHash
    ) internal {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }

        _ownershipHistoryIds++;
        uint256 historyId = _ownershipHistoryIds;

        ownershipHistories[historyId] = OwnershipHistory({
            historyId: historyId,
            propertyId: propertyId,
            previousOwner: previousOwner,
            newOwner: newOwner,
            transferAmount: transferAmount,
            transferDate: block.timestamp,
            transferReason: transferReason,
            tokenAmount: tokenAmount,
            ownershipPercentage: ownershipPercentage,
            transactionHash: transactionHash
        });

        // 부동산별 소유권 이력에 추가
        propertyOwnershipHistory[propertyId].push(historyId);

        // 새 소유자 정보 업데이트
        properties[propertyId].owner = newOwner;
        properties[propertyId].updatedAt = block.timestamp;

        // 사용자별 부동산 목록 업데이트
        _updateUserProperties(previousOwner, newOwner, propertyId);

        // 소유권 현황 업데이트
        _updateOwnershipStatus(propertyId, newOwner, tokenAmount, ownershipPercentage);

        // 토큰 잔액 업데이트
        _updateTokenBalance(previousOwner, propertyId, tokenAmount, false);
        _updateTokenBalance(newOwner, propertyId, tokenAmount, true);

        emit OwnershipTransferred(propertyId, previousOwner, newOwner, transferAmount);
    }

    /**
     * @dev 사용자별 부동산 목록 업데이트 내부 함수
     * @param previousOwner 이전 소유자
     * @param newOwner 새 소유자
     * @param propertyId 부동산 ID
     */
    function _updateUserProperties(
        address previousOwner,
        address newOwner,
        uint256 propertyId
    ) internal {
        // 이전 소유자 목록에서 제거
        uint256[] storage prevOwnerProps = userProperties[previousOwner];
        for (uint256 i = 0; i < prevOwnerProps.length; i++) {
            if (prevOwnerProps[i] == propertyId) {
                prevOwnerProps[i] = prevOwnerProps[prevOwnerProps.length - 1];
                prevOwnerProps.pop();
                break;
            }
        }

        // 새 소유자 목록에 추가 (중복 방지)
        uint256[] storage newOwnerProps = userProperties[newOwner];
        bool exists = false;
        for (uint256 i = 0; i < newOwnerProps.length; i++) {
            if (newOwnerProps[i] == propertyId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            newOwnerProps.push(propertyId);
        }
    }

    /**
     * @dev 소유권 현황 업데이트
     * @param propertyId 부동산 ID
     * @param owner 소유자
     * @param totalTokens 총 토큰 수
     * @param ownershipPercentage 소유권 비율
     */
    function _updateOwnershipStatus(
        uint256 propertyId,
        address owner,
        uint256 totalTokens,
        uint256 ownershipPercentage
    ) internal {
        _ownershipStatusIds++;
        uint256 statusId = _ownershipStatusIds;

        ownershipStatuses[statusId] = OwnershipStatus({
            propertyId: propertyId,
            owner: owner,
            totalTokens: totalTokens,
            ownershipPercentage: ownershipPercentage,
            lastUpdated: block.timestamp,
            isActive: true
        });

        // 부동산별 소유권 현황 목록에 추가
        propertyOwnershipStatuses[propertyId].push(statusId);

        // 소유자별 부동산 목록 업데이트
        _updateOwnerProperties(owner, propertyId);

        emit OwnershipStatusUpdated(propertyId, owner, totalTokens, ownershipPercentage);
    }

    /**
     * @dev 소유자별 부동산 목록 업데이트
     * @param owner 소유자
     * @param propertyId 부동산 ID
     */
    function _updateOwnerProperties(address owner, uint256 propertyId) internal {
        uint256[] storage ownerProps = ownerProperties[owner];
        bool exists = false;
        for (uint256 i = 0; i < ownerProps.length; i++) {
            if (ownerProps[i] == propertyId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            ownerProps.push(propertyId);
        }
    }

    /**
     * @dev 토큰 잔액 업데이트
     * @param owner 소유자
     * @param propertyId 부동산 ID
     * @param amount 토큰 수량
     * @param isAdd 추가 여부 (true: 추가, false: 차감)
     */
    function _updateTokenBalance(
        address owner,
        uint256 propertyId,
        uint256 amount,
        bool isAdd
    ) internal {
        uint256 oldBalance = ownerTokenBalances[owner][propertyId];
        uint256 newBalance;

        if (isAdd) {
            newBalance = oldBalance + amount;
        } else {
            newBalance = oldBalance > amount ? oldBalance - amount : 0;
        }

        ownerTokenBalances[owner][propertyId] = newBalance;

        emit TokenBalanceUpdated(owner, propertyId, oldBalance, newBalance);
    }

    // 조회 함수들

    /**
     * @dev 부동산 정보 조회
     * @param propertyId 부동산 ID
     * @return Property 구조체
     */
    function getProperty(uint256 propertyId) external view returns (Property memory) {
        if (properties[propertyId].propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        return properties[propertyId];
    }

    /**
     * @dev 등록 요청 정보 조회
     * @param requestId 요청 ID
     * @return RegistrationRequest 구조체
     */
    function getRegistrationRequest(uint256 requestId) external view returns (RegistrationRequest memory) {
        if (registrationRequests[requestId].requestId == 0) {
            revert RegistrationRequestNotFound(requestId);
        }
        return registrationRequests[requestId];
    }

    /**
     * @dev 문서 정보 조회
     * @param documentId 문서 ID
     * @return Document 구조체
     */
    function getDocument(uint256 documentId) external view returns (Document memory) {
        if (documents[documentId].documentId == 0) {
            revert DocumentNotFound(documentId);
        }
        return documents[documentId];
    }

    /**
     * @dev 활성 문서 목록 조회
     * @param propertyId 부동산 ID
     * @return 활성 문서 ID 배열
     */
    function getActiveDocuments(uint256 propertyId) external view returns (uint256[] memory) {
        uint256[] storage allDocs = propertyDocuments[propertyId];
        uint256 activeCount = 0;
        
        // 활성 문서 수 계산
        for (uint256 i = 0; i < allDocs.length; i++) {
            if (documents[allDocs[i]].isActive) {
                activeCount++;
            }
        }
        
        // 활성 문서만 반환
        uint256[] memory activeDocs = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allDocs.length; i++) {
            if (documents[allDocs[i]].isActive) {
                activeDocs[index] = allDocs[i];
                index++;
            }
        }
        
        return activeDocs;
    }

    /**
     * @dev 검증된 문서 목록 조회
     * @param propertyId 부동산 ID
     * @return 검증된 문서 ID 배열
     */
    function getVerifiedDocuments(uint256 propertyId) external view returns (uint256[] memory) {
        uint256[] storage allDocs = propertyDocuments[propertyId];
        uint256 verifiedCount = 0;
        
        // 검증된 문서 수 계산
        for (uint256 i = 0; i < allDocs.length; i++) {
            if (documents[allDocs[i]].isVerified && documents[allDocs[i]].isActive) {
                verifiedCount++;
            }
        }
        
        // 검증된 문서만 반환
        uint256[] memory verifiedDocs = new uint256[](verifiedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allDocs.length; i++) {
            if (documents[allDocs[i]].isVerified && documents[allDocs[i]].isActive) {
                verifiedDocs[index] = allDocs[i];
                index++;
            }
        }
        
        return verifiedDocs;
    }

    /**
     * @dev 문서 유형별 문서 목록 조회
     * @param propertyId 부동산 ID
     * @param documentType 문서 유형
     * @return 문서 ID 배열
     */
    function getDocumentsByType(
        uint256 propertyId,
        DocumentType documentType
    ) external view returns (uint256[] memory) {
        uint256[] storage allDocs = propertyDocuments[propertyId];
        uint256 typeCount = 0;
        
        // 해당 유형의 문서 수 계산
        for (uint256 i = 0; i < allDocs.length; i++) {
            if (documents[allDocs[i]].documentType == documentType && documents[allDocs[i]].isActive) {
                typeCount++;
            }
        }
        
        // 해당 유형의 문서만 반환
        uint256[] memory typeDocs = new uint256[](typeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allDocs.length; i++) {
            if (documents[allDocs[i]].documentType == documentType && documents[allDocs[i]].isActive) {
                typeDocs[index] = allDocs[i];
                index++;
            }
        }
        
        return typeDocs;
    }

    /**
     * @dev 부동산별 문서 목록 조회
     * @param propertyId 부동산 ID
     * @return 문서 ID 배열
     */
    function getPropertyDocuments(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyDocuments[propertyId];
    }

    /**
     * @dev 부동산별 소유권 이력 조회
     * @param propertyId 부동산 ID
     * @return 이력 ID 배열
     */
    function getPropertyOwnershipHistory(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyOwnershipHistory[propertyId];
    }

    /**
     * @dev 부동산별 상태 변경 이력 조회
     * @param propertyId 부동산 ID
     * @return 이력 ID 배열
     */
    function getPropertyStatusHistory(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyStatusHistory[propertyId];
    }

    /**
     * @dev 상태별 부동산 목록 조회
     * @param status 부동산 상태
     * @return 부동산 ID 배열
     */
    function getPropertiesByStatus(PropertyStatus status) external view returns (uint256[] memory) {
        return propertiesByStatus[status];
    }

    /**
     * @dev 상태 변경 히스토리 정보 조회
     * @param historyId 이력 ID
     * @return StatusChangeHistory 구조체
     */
    function getStatusChangeHistory(uint256 historyId) external view returns (StatusChangeHistory memory) {
        return statusChangeHistories[historyId];
    }

    /**
     * @dev 상태 전환 유효성 확인
     * @param oldStatus 이전 상태
     * @param newStatus 새로운 상태
     * @return 유효성 여부
     */
    function isValidStatusTransition(
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    ) external pure returns (bool) {
        return _isValidStatusTransition(oldStatus, newStatus);
    }

    /**
     * @dev 상태 변경 권한 확인
     * @param caller 호출자
     * @param oldStatus 이전 상태
     * @param newStatus 새로운 상태
     * @return 권한 여부
     */
    function hasStatusChangePermission(
        address caller,
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    ) external view returns (bool) {
        return _hasStatusChangePermission(caller, oldStatus, newStatus);
    }

    /**
     * @dev 사용자별 부동산 목록 조회
     * @param user 사용자 주소
     * @return 부동산 ID 배열
     */
    function getUserProperties(address user) external view returns (uint256[] memory) {
        return userProperties[user];
    }

    /**
     * @dev 사용자별 등록 요청 목록 조회
     * @param user 사용자 주소
     * @return 요청 ID 배열
     */
    function getUserRegistrationRequests(address user) external view returns (uint256[] memory) {
        return userRegistrationRequests[user];
    }

    /**
     * @dev 소유권 이력 정보 조회
     * @param historyId 이력 ID
     * @return OwnershipHistory 구조체
     */
    function getOwnershipHistory(uint256 historyId) external view returns (OwnershipHistory memory) {
        return ownershipHistories[historyId];
    }

    /**
     * @dev 소유권 현황 정보 조회
     * @param statusId 현황 ID
     * @return OwnershipStatus 구조체
     */
    function getOwnershipStatus(uint256 statusId) external view returns (OwnershipStatus memory) {
        return ownershipStatuses[statusId];
    }

    /**
     * @dev 부동산별 소유권 현황 목록 조회
     * @param propertyId 부동산 ID
     * @return 현황 ID 배열
     */
    function getPropertyOwnershipStatuses(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyOwnershipStatuses[propertyId];
    }

    /**
     * @dev 소유자별 부동산 목록 조회
     * @param owner 소유자 주소
     * @return 부동산 ID 배열
     */
    function getOwnerProperties(address owner) external view returns (uint256[] memory) {
        return ownerProperties[owner];
    }

    /**
     * @dev 소유자별 토큰 잔액 조회
     * @param owner 소유자 주소
     * @param propertyId 부동산 ID
     * @return 토큰 잔액
     */
    function getOwnerTokenBalance(address owner, uint256 propertyId) external view returns (uint256) {
        return ownerTokenBalances[owner][propertyId];
    }

    /**
     * @dev 소유권 분산도 계산
     * @param propertyId 부동산 ID
     * @return 소유자 수
     */
    function getOwnershipDistribution(uint256 propertyId) external view returns (uint256) {
        uint256[] storage statuses = propertyOwnershipStatuses[propertyId];
        uint256 activeOwners = 0;
        
        for (uint256 i = 0; i < statuses.length; i++) {
            if (ownershipStatuses[statuses[i]].isActive) {
                activeOwners++;
            }
        }
        
        return activeOwners;
    }

    /**
     * @dev 거래 히스토리 페이지네이션 조회
     * @param propertyId 부동산 ID
     * @param offset 시작 인덱스
     * @param limit 조회할 개수
     * @return 이력 ID 배열
     */
    function getOwnershipHistoryPaginated(
        uint256 propertyId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage allHistory = propertyOwnershipHistory[propertyId];
        uint256 totalCount = allHistory.length;
        
        if (offset >= totalCount) {
            return new uint256[](0);
        }
        
        uint256 endIndex = offset + limit;
        if (endIndex > totalCount) {
            endIndex = totalCount;
        }
        
        uint256 resultCount = endIndex - offset;
        uint256[] memory result = new uint256[](resultCount);
        
        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = allHistory[offset + i];
        }
        
        return result;
    }

    /**
     * @dev 소유자별 보유 토큰 현황 조회
     * @param owner 소유자 주소
     * @return propertyIds 부동산 ID 배열
     * @return balances 토큰 잔액 배열
     */
    function getOwnerTokenBalances(address owner) external view returns (uint256[] memory propertyIds, uint256[] memory balances) {
        uint256[] storage ownerProps = ownerProperties[owner];
        uint256 count = ownerProps.length;
        
        propertyIds = new uint256[](count);
        balances = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 propertyId = ownerProps[i];
            propertyIds[i] = propertyId;
            balances[i] = ownerTokenBalances[owner][propertyId];
        }
        
        return (propertyIds, balances);
    }

    /**
     * @dev 총 부동산 수 조회
     * @return 총 부동산 수
     */
    function getTotalProperties() external view returns (uint256) {
        return _propertyIds;
    }

    /**
     * @dev 총 문서 수 조회
     * @return 총 문서 수
     */
    function getTotalDocuments() external view returns (uint256) {
        return _documentIds;
    }

    /**
     * @dev 총 등록 요청 수 조회
     * @return 총 등록 요청 수
     */
    function getTotalRegistrationRequests() external view returns (uint256) {
        return _registrationRequestIds;
    }

    /**
     * @dev 컨트랙트 일시 중지
     */
    function pause() external onlyRole(REGISTRAR_ROLE) {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 중지 해제
     */
    function unpause() external onlyRole(REGISTRAR_ROLE) {
        _unpause();
    }

    /**
     * @dev ERC165 표준 지원
     */
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev 컨트랙트에서 ETH 출금
     * @param amount 출금할 금액
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, 'Insufficient balance');
        payable(owner()).transfer(amount);
    }

    /**
     * @dev 컨트랙트 잔액 조회
     * @return 컨트랙트 ETH 잔액
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ============ ERC-1400 토큰화 시스템 ============

    // 토큰화 설정
    uint256 public constant TOKEN_DECIMALS = 18;
    uint256 public constant MIN_TOKEN_AMOUNT = 1 * 10**18; // 1 토큰
    uint256 public constant MAX_TOKEN_AMOUNT = 1000000000 * 10**18; // 1B 토큰
    uint256 public constant DEFAULT_TOKEN_PRICE = 1 * 10**18; // 1 ETH per token

    // 토큰화 정보 구조체
    struct TokenizationInfo {
        uint256 propertyId;
        uint256 totalTokens;
        uint256 tokenPrice;
        uint256 issuedTokens;
        uint256 availableTokens;
        uint256 tokenizationDate;
        address tokenContract;
        bool isActive;
        uint256 minInvestment;
        uint256 maxInvestment;
        uint256 lockupPeriod;
        uint256 dividendRate;
        string tokenMetadata;
    }

    // 투자자 정보 구조체
    struct InvestorInfo {
        address investor;
        uint256 propertyId;
        uint256 tokenAmount;
        uint256 investmentAmount;
        uint256 investmentDate;
        uint256 lockupEndDate;
        bool isActive;
        uint256 dividendEarned;
        uint256 lastDividendClaim;
    }

    // 토큰화 관련 매핑
    mapping(uint256 => TokenizationInfo) public tokenizationInfos;
    mapping(address => mapping(uint256 => InvestorInfo)) public investorInfos;
    mapping(uint256 => address[]) public propertyInvestors;
    mapping(address => uint256[]) public investorProperties;

    // 토큰화 이벤트
    event PropertyTokenized(
        uint256 indexed propertyId,
        uint256 totalTokens,
        uint256 tokenPrice,
        address indexed tokenContract
    );

    event TokensIssued(
        uint256 indexed propertyId,
        address indexed investor,
        uint256 tokenAmount,
        uint256 investmentAmount
    );

    event TokensRedeemed(
        uint256 indexed propertyId,
        address indexed investor,
        uint256 tokenAmount,
        uint256 redemptionAmount
    );

    event DividendDistributed(
        uint256 indexed propertyId,
        uint256 totalAmount,
        uint256 timestamp
    );

    event DividendClaimed(
        uint256 indexed propertyId,
        address indexed investor,
        uint256 amount
    );

    /**
     * @dev 부동산 토큰화 실행
     * @param propertyId 부동산 ID
     * @param totalTokens 총 발행 토큰 수
     * @param tokenPrice 토큰 가격 (wei)
     * @param minInvestment 최소 투자 금액
     * @param maxInvestment 최대 투자 금액
     * @param lockupPeriod 락업 기간 (초)
     * @param dividendRate 배당률 (basis points)
     * @param tokenMetadata 토큰 메타데이터
     */
    function tokenizeProperty(
        uint256 propertyId,
        uint256 totalTokens,
        uint256 tokenPrice,
        uint256 minInvestment,
        uint256 maxInvestment,
        uint256 lockupPeriod,
        uint256 dividendRate,
        string memory tokenMetadata
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant {
        Property storage property = properties[propertyId];
        if (property.propertyId == 0) {
            revert PropertyNotFound(propertyId);
        }
        if (property.status != PropertyStatus.ACTIVE) {
            revert PropertyNotActive(propertyId);
        }
        if (property.isTokenized) {
            revert PropertyAlreadyTokenized(propertyId);
        }

        require(totalTokens >= MIN_TOKEN_AMOUNT, 'Total tokens too low');
        require(totalTokens <= MAX_TOKEN_AMOUNT, 'Total tokens too high');
        require(tokenPrice > 0, 'Token price must be greater than 0');
        require(minInvestment > 0, 'Min investment must be greater than 0');
        require(maxInvestment >= minInvestment, 'Max investment must be >= min investment');
        require(dividendRate <= BASIS_POINTS, 'Dividend rate cannot exceed 100%');

        // 토큰화 정보 생성
        tokenizationInfos[propertyId] = TokenizationInfo({
            propertyId: propertyId,
            totalTokens: totalTokens,
            tokenPrice: tokenPrice,
            issuedTokens: 0,
            availableTokens: totalTokens,
            tokenizationDate: block.timestamp,
            tokenContract: address(propertyToken),
            isActive: true,
            minInvestment: minInvestment,
            maxInvestment: maxInvestment,
            lockupPeriod: lockupPeriod,
            dividendRate: dividendRate,
            tokenMetadata: tokenMetadata
        });

        // 부동산 상태 업데이트
        property.isTokenized = true;
        property.tokenContractId = propertyId;

        // PropertyToken에 토큰 발행
        bytes memory data = abi.encode(propertyId, tokenMetadata);
        propertyToken.issueTokens(address(this), totalTokens, data);

        emit PropertyTokenized(propertyId, totalTokens, tokenPrice, address(propertyToken));
    }

    /**
     * @dev 토큰 구매 (투자)
     * @param propertyId 부동산 ID
     * @param tokenAmount 구매할 토큰 수량
     */
    function investInProperty(uint256 propertyId, uint256 tokenAmount) external payable nonReentrant {
        TokenizationInfo storage tokenInfo = tokenizationInfos[propertyId];
        if (!tokenInfo.isActive) {
            revert PropertyNotActive(propertyId);
        }

        uint256 requiredAmount = tokenAmount * tokenInfo.tokenPrice / 10**TOKEN_DECIMALS;
        require(msg.value >= requiredAmount, 'Insufficient investment amount');
        require(tokenAmount >= tokenInfo.minInvestment / tokenInfo.tokenPrice * 10**TOKEN_DECIMALS, 'Below minimum investment');
        require(tokenAmount <= tokenInfo.maxInvestment / tokenInfo.tokenPrice * 10**TOKEN_DECIMALS, 'Exceeds maximum investment');
        require(tokenAmount <= tokenInfo.availableTokens, 'Insufficient available tokens');

        // 투자자 정보 생성/업데이트
        InvestorInfo storage investor = investorInfos[msg.sender][propertyId];
        if (investor.investor == address(0)) {
            investor.investor = msg.sender;
            investor.propertyId = propertyId;
            investor.investmentDate = block.timestamp;
            investor.lockupEndDate = block.timestamp + tokenInfo.lockupPeriod;
            investor.isActive = true;
            
            propertyInvestors[propertyId].push(msg.sender);
            investorProperties[msg.sender].push(propertyId);
        }

        investor.tokenAmount += tokenAmount;
        investor.investmentAmount += requiredAmount;

        // 토큰 전송
        bytes memory data = abi.encode(propertyId, "investment");
        propertyToken.transferWithData(msg.sender, tokenAmount, data);

        // 토큰화 정보 업데이트
        tokenInfo.issuedTokens += tokenAmount;
        tokenInfo.availableTokens -= tokenAmount;

        // 소유권 현황 업데이트
        ownerTokenBalances[msg.sender][propertyId] += tokenAmount;

        emit TokensIssued(propertyId, msg.sender, tokenAmount, requiredAmount);
    }

    /**
     * @dev 토큰 환매 (소각)
     * @param propertyId 부동산 ID
     * @param tokenAmount 환매할 토큰 수량
     */
    function redeemTokens(uint256 propertyId, uint256 tokenAmount) external nonReentrant {
        TokenizationInfo storage tokenInfo = tokenizationInfos[propertyId];
        if (!tokenInfo.isActive) {
            revert PropertyNotActive(propertyId);
        }

        InvestorInfo storage investor = investorInfos[msg.sender][propertyId];
        require(investor.investor != address(0), 'No investment found');
        require(investor.tokenAmount >= tokenAmount, 'Insufficient token balance');
        require(block.timestamp >= investor.lockupEndDate, 'Lockup period not ended');

        uint256 redemptionAmount = tokenAmount * tokenInfo.tokenPrice / 10**TOKEN_DECIMALS;

        // 토큰 소각
        bytes memory data = abi.encode(propertyId, "redemption");
        propertyToken.redeemTokens(tokenAmount, data);

        // 투자자 정보 업데이트
        investor.tokenAmount -= tokenAmount;
        investor.investmentAmount -= redemptionAmount;

        if (investor.tokenAmount == 0) {
            investor.isActive = false;
        }

        // 토큰화 정보 업데이트
        tokenInfo.issuedTokens -= tokenAmount;
        tokenInfo.availableTokens += tokenAmount;

        // 소유권 현황 업데이트
        ownerTokenBalances[msg.sender][propertyId] -= tokenAmount;

        // 환매 금액 전송
        payable(msg.sender).transfer(redemptionAmount);

        emit TokensRedeemed(propertyId, msg.sender, tokenAmount, redemptionAmount);
    }

    /**
     * @dev 배당금 분배
     * @param propertyId 부동산 ID
     */
    function distributeDividend(uint256 propertyId) external onlyRole(REGISTRAR_ROLE) nonReentrant {
        TokenizationInfo storage tokenInfo = tokenizationInfos[propertyId];
        require(tokenInfo.isActive, 'Property not tokenized');

        uint256 totalDividend = address(this).balance;
        require(totalDividend > 0, 'No dividend to distribute');

        address[] storage investors = propertyInvestors[propertyId];
        uint256 totalIssuedTokens = tokenInfo.issuedTokens;

        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            InvestorInfo storage investorInfo = investorInfos[investor][propertyId];
            
            if (investorInfo.isActive && investorInfo.tokenAmount > 0) {
                uint256 dividendShare = (totalDividend * investorInfo.tokenAmount) / totalIssuedTokens;
                investorInfo.dividendEarned += dividendShare;
            }
        }

        emit DividendDistributed(propertyId, totalDividend, block.timestamp);
    }

    /**
     * @dev 배당금 수령
     * @param propertyId 부동산 ID
     */
    function claimDividend(uint256 propertyId) external nonReentrant {
        InvestorInfo storage investor = investorInfos[msg.sender][propertyId];
        require(investor.investor != address(0), 'No investment found');

        uint256 claimableAmount = investor.dividendEarned - investor.lastDividendClaim;
        require(claimableAmount > 0, 'No dividend to claim');

        investor.lastDividendClaim = investor.dividendEarned;

        payable(msg.sender).transfer(claimableAmount);

        emit DividendClaimed(propertyId, msg.sender, claimableAmount);
    }

    /**
     * @dev 토큰화 정보 조회
     * @param propertyId 부동산 ID
     * @return 토큰화 정보
     */
    function getTokenizationInfo(uint256 propertyId) external view returns (TokenizationInfo memory) {
        return tokenizationInfos[propertyId];
    }

    /**
     * @dev 투자자 정보 조회
     * @param investor 투자자 주소
     * @param propertyId 부동산 ID
     * @return 투자자 정보
     */
    function getInvestorInfo(address investor, uint256 propertyId) external view returns (InvestorInfo memory) {
        return investorInfos[investor][propertyId];
    }

    /**
     * @dev 부동산 투자자 목록 조회
     * @param propertyId 부동산 ID
     * @return 투자자 주소 배열
     */
    function getPropertyInvestors(uint256 propertyId) external view returns (address[] memory) {
        return propertyInvestors[propertyId];
    }

    /**
     * @dev 투자자별 부동산 목록 조회
     * @param investor 투자자 주소
     * @return 부동산 ID 배열
     */
    function getInvestorProperties(address investor) external view returns (uint256[] memory) {
        return investorProperties[investor];
    }
} 