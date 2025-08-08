// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title PropertyOracle
 * @dev 부동산 시세 정보 및 외부 검증 데이터를 위한 오라클 인터페이스
 * 외부 데이터 소스와 연동하여 부동산 평가 및 검증 데이터를 제공합니다.
 */
contract PropertyOracle is Ownable, AccessControl, Pausable, ReentrancyGuard {
    // 역할 정의
    bytes32 public constant ORACLE_ROLE = keccak256('ORACLE_ROLE');
    bytes32 public constant VALIDATOR_ROLE = keccak256('VALIDATOR_ROLE');
    bytes32 public constant CONSUMER_ROLE = keccak256('CONSUMER_ROLE');

    // 데이터 유형 열거형
    enum DataType {
        PROPERTY_PRICE,      // 0: 부동산 가격
        MARKET_TREND,        // 1: 시장 동향
        RENTAL_RATE,         // 2: 임대료율
        INTEREST_RATE,       // 3: 금리
        ECONOMIC_INDICATOR,  // 4: 경제 지표
        REGULATORY_INFO,     // 5: 규제 정보
        WEATHER_DATA,        // 6: 날씨 데이터
        CRIME_RATE,          // 7: 범죄율
        INFRASTRUCTURE,      // 8: 인프라 정보
        OTHER                // 9: 기타
    }

    // 데이터 소스 유형 열거형
    enum SourceType {
        CHAINLINK,           // 0: Chainlink
        API3,               // 1: API3
        BAND_PROTOCOL,      // 2: Band Protocol
        NEST_PROTOCOL,      // 3: Nest Protocol
        CUSTOM_API,         // 4: 커스텀 API
        MANUAL_ENTRY,       // 5: 수동 입력
        GOVERNMENT_DATA,    // 6: 정부 데이터
        REAL_ESTATE_AGENCY, // 7: 부동산 중개업소
        APPRAISAL_FIRM,     // 8: 감정평가법인
        OTHER_SOURCE        // 9: 기타 소스
    }

    // 데이터 신뢰도 열거형
    enum ReliabilityLevel {
        LOW,                // 0: 낮음
        MEDIUM,             // 1: 보통
        HIGH,               // 2: 높음
        VERY_HIGH           // 3: 매우 높음
    }

    // 오라클 데이터 구조체
    struct OracleData {
        uint256 dataId;
        uint256 propertyId;
        DataType dataType;
        SourceType sourceType;
        string dataSource;
        uint256 value;
        uint256 timestamp;
        uint256 blockNumber;
        address oracleAddress;
        ReliabilityLevel reliability;
        bool isVerified;
        string metadata;
        uint256 confidence;
        uint256 updateFrequency;
        uint256 lastUpdated;
    }

    // 데이터 요청 구조체
    struct DataRequest {
        uint256 requestId;
        uint256 propertyId;
        DataType dataType;
        address requester;
        uint256 requestFee;
        uint256 timestamp;
        bool isFulfilled;
        uint256 fulfilledDataId;
        string callbackUrl;
    }

    // 오라클 소스 정보 구조체
    struct OracleSource {
        address sourceAddress;
        string sourceName;
        SourceType sourceType;
        ReliabilityLevel reliability;
        uint256 successRate;
        uint256 totalRequests;
        uint256 totalFulfilled;
        bool isActive;
        uint256 lastUsed;
        uint256 fee;
    }

    // 상태 변수
    uint256 private _dataIds;
    uint256 private _requestIds;
    uint256 private _sourceIds;
    
    // 기본 설정
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_REQUEST_FEE = 0.001 ether;
    uint256 public constant MAX_REQUEST_FEE = 0.1 ether;
    uint256 public constant DEFAULT_REQUEST_FEE = 0.01 ether;
    uint256 public constant MIN_CONFIDENCE = 0;
    uint256 public constant MAX_CONFIDENCE = 100;
    uint256 public constant DEFAULT_CONFIDENCE = 80;
    
    // 매핑
    mapping(uint256 => OracleData) public oracleData;
    mapping(uint256 => DataRequest) public dataRequests;
    mapping(uint256 => OracleSource) public oracleSources;
    mapping(uint256 => uint256[]) public propertyOracleData; // 부동산별 오라클 데이터
    mapping(uint256 => uint256[]) public propertyDataRequests; // 부동산별 데이터 요청
    mapping(address => uint256[]) public requesterDataRequests; // 요청자별 데이터 요청
    mapping(DataType => uint256[]) public dataByType; // 데이터 유형별 데이터
    mapping(address => uint256) public oracleSourceIds; // 오라클 주소별 소스 ID
    mapping(bytes32 => uint256) public dataHashes; // 데이터 해시별 데이터 ID

    // 이벤트 정의
    event OracleDataUpdated(
        uint256 indexed dataId,
        uint256 indexed propertyId,
        DataType dataType,
        uint256 value,
        address indexed oracleAddress
    );

    event DataRequestCreated(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        DataType dataType,
        address indexed requester,
        uint256 requestFee
    );

    event DataRequestFulfilled(
        uint256 indexed requestId,
        uint256 indexed dataId,
        address indexed oracleAddress
    );

    event OracleSourceRegistered(
        uint256 indexed sourceId,
        address indexed sourceAddress,
        string sourceName,
        SourceType sourceType
    );

    event OracleSourceUpdated(
        uint256 indexed sourceId,
        address indexed sourceAddress,
        ReliabilityLevel reliability,
        uint256 successRate
    );

    event DataVerified(
        uint256 indexed dataId,
        uint256 indexed propertyId,
        address indexed validator,
        bool isVerified
    );

    // 에러 정의
    error DataNotFound(uint256 dataId);
    error RequestNotFound(uint256 requestId);
    error SourceNotFound(uint256 sourceId);
    error InvalidDataType();
    error InvalidSourceType();
    error InvalidReliabilityLevel();
    error InsufficientRequestFee(uint256 provided, uint256 required);
    error DataAlreadyExists(uint256 dataId);
    error RequestAlreadyFulfilled(uint256 requestId);
    error UnauthorizedOperation(address caller, bytes32 role);
    error InvalidConfidence(uint256 confidence);
    error InvalidValue(uint256 value);

    /**
     * @dev 생성자
     */
    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
        _grantRole(CONSUMER_ROLE, msg.sender);
    }

    /**
     * @dev 오라클 데이터 업데이트
     * @param propertyId 부동산 ID
     * @param dataType 데이터 유형
     * @param sourceType 소스 유형
     * @param dataSource 데이터 소스
     * @param value 데이터 값
     * @param reliability 신뢰도
     * @param metadata 메타데이터
     * @param confidence 신뢰도 점수
     * @param updateFrequency 업데이트 빈도
     */
    function updateOracleData(
        uint256 propertyId,
        DataType dataType,
        SourceType sourceType,
        string memory dataSource,
        uint256 value,
        ReliabilityLevel reliability,
        string memory metadata,
        uint256 confidence,
        uint256 updateFrequency
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        require(confidence >= MIN_CONFIDENCE && confidence <= MAX_CONFIDENCE, 'Invalid confidence level');
        require(bytes(dataSource).length > 0, 'Data source cannot be empty');

        _dataIds++;
        uint256 dataId = _dataIds;

        oracleData[dataId] = OracleData({
            dataId: dataId,
            propertyId: propertyId,
            dataType: dataType,
            sourceType: sourceType,
            dataSource: dataSource,
            value: value,
            timestamp: block.timestamp,
            blockNumber: block.number,
            oracleAddress: msg.sender,
            reliability: reliability,
            isVerified: false,
            metadata: metadata,
            confidence: confidence,
            updateFrequency: updateFrequency,
            lastUpdated: block.timestamp
        });

        // 부동산별 오라클 데이터에 추가
        propertyOracleData[propertyId].push(dataId);

        // 데이터 유형별 데이터에 추가
        dataByType[dataType].push(dataId);

        // 데이터 해시 저장
        bytes32 dataHash = keccak256(abi.encodePacked(propertyId, dataType, value, block.timestamp));
        dataHashes[dataHash] = dataId;

        emit OracleDataUpdated(dataId, propertyId, dataType, value, msg.sender);
    }

    /**
     * @dev 데이터 요청 생성
     * @param propertyId 부동산 ID
     * @param dataType 데이터 유형
     * @param callbackUrl 콜백 URL
     * @return requestId 요청 ID
     */
    function createDataRequest(
        uint256 propertyId,
        DataType dataType,
        string memory callbackUrl
    ) external payable nonReentrant returns (uint256 requestId) {
        require(msg.value >= DEFAULT_REQUEST_FEE, 'Insufficient request fee');

        _requestIds++;
        requestId = _requestIds;

        dataRequests[requestId] = DataRequest({
            requestId: requestId,
            propertyId: propertyId,
            dataType: dataType,
            requester: msg.sender,
            requestFee: msg.value,
            timestamp: block.timestamp,
            isFulfilled: false,
            fulfilledDataId: 0,
            callbackUrl: callbackUrl
        });

        // 부동산별 데이터 요청에 추가
        propertyDataRequests[propertyId].push(requestId);

        // 요청자별 데이터 요청에 추가
        requesterDataRequests[msg.sender].push(requestId);

        emit DataRequestCreated(requestId, propertyId, dataType, msg.sender, msg.value);
    }

    /**
     * @dev 데이터 요청 처리
     * @param requestId 요청 ID
     * @param dataId 데이터 ID
     */
    function fulfillDataRequest(
        uint256 requestId,
        uint256 dataId
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        DataRequest storage request = dataRequests[requestId];
        if (request.requestId == 0) {
            revert RequestNotFound(requestId);
        }
        if (request.isFulfilled) {
            revert RequestAlreadyFulfilled(requestId);
        }

        OracleData storage data = oracleData[dataId];
        if (data.dataId == 0) {
            revert DataNotFound(dataId);
        }

        request.isFulfilled = true;
        request.fulfilledDataId = dataId;

        // 요청 수수료를 오라클에게 지급
        payable(msg.sender).transfer(request.requestFee);

        emit DataRequestFulfilled(requestId, dataId, msg.sender);
    }

    /**
     * @dev 오라클 소스 등록
     * @param sourceAddress 소스 주소
     * @param sourceName 소스 이름
     * @param sourceType 소스 유형
     * @param reliability 신뢰도
     * @param fee 수수료
     */
    function registerOracleSource(
        address sourceAddress,
        string memory sourceName,
        SourceType sourceType,
        ReliabilityLevel reliability,
        uint256 fee
    ) external onlyRole(ORACLE_ROLE) {
        require(sourceAddress != address(0), 'Invalid source address');
        require(bytes(sourceName).length > 0, 'Source name cannot be empty');

        _sourceIds++;
        uint256 sourceId = _sourceIds;

        oracleSources[sourceId] = OracleSource({
            sourceAddress: sourceAddress,
            sourceName: sourceName,
            sourceType: sourceType,
            reliability: reliability,
            successRate: 100, // 초기 성공률 100%
            totalRequests: 0,
            totalFulfilled: 0,
            isActive: true,
            lastUsed: block.timestamp,
            fee: fee
        });

        oracleSourceIds[sourceAddress] = sourceId;

        emit OracleSourceRegistered(sourceId, sourceAddress, sourceName, sourceType);
    }

    /**
     * @dev 오라클 소스 업데이트
     * @param sourceId 소스 ID
     * @param reliability 신뢰도
     * @param isActive 활성 상태
     * @param fee 수수료
     */
    function updateOracleSource(
        uint256 sourceId,
        ReliabilityLevel reliability,
        bool isActive,
        uint256 fee
    ) external onlyRole(ORACLE_ROLE) {
        OracleSource storage source = oracleSources[sourceId];
        if (source.sourceAddress == address(0)) {
            revert SourceNotFound(sourceId);
        }

        source.reliability = reliability;
        source.isActive = isActive;
        source.fee = fee;
        source.lastUsed = block.timestamp;

        // 성공률 계산
        if (source.totalRequests > 0) {
            source.successRate = (source.totalFulfilled * 100) / source.totalRequests;
        }

        emit OracleSourceUpdated(sourceId, source.sourceAddress, reliability, source.successRate);
    }

    /**
     * @dev 데이터 검증
     * @param dataId 데이터 ID
     * @param isVerified 검증 여부
     */
    function verifyData(
        uint256 dataId,
        bool isVerified
    ) external onlyRole(VALIDATOR_ROLE) {
        OracleData storage data = oracleData[dataId];
        if (data.dataId == 0) {
            revert DataNotFound(dataId);
        }

        data.isVerified = isVerified;

        emit DataVerified(dataId, data.propertyId, msg.sender, isVerified);
    }

    /**
     * @dev 데이터 무결성 검증
     * @param dataId 데이터 ID
     * @param expectedHash 예상 해시
     * @return 무결성 검증 결과
     */
    function verifyDataIntegrity(
        uint256 dataId,
        bytes32 expectedHash
    ) external view returns (bool) {
        OracleData storage data = oracleData[dataId];
        if (data.dataId == 0) {
            revert DataNotFound(dataId);
        }

        bytes32 actualHash = keccak256(abi.encodePacked(
            data.propertyId,
            data.dataType,
            data.value,
            data.timestamp
        ));

        return actualHash == expectedHash;
    }

    // 조회 함수들

    /**
     * @dev 오라클 데이터 조회
     * @param dataId 데이터 ID
     * @return OracleData 구조체
     */
    function getOracleData(uint256 dataId) external view returns (OracleData memory) {
        if (oracleData[dataId].dataId == 0) {
            revert DataNotFound(dataId);
        }
        return oracleData[dataId];
    }

    /**
     * @dev 데이터 요청 조회
     * @param requestId 요청 ID
     * @return DataRequest 구조체
     */
    function getDataRequest(uint256 requestId) external view returns (DataRequest memory) {
        if (dataRequests[requestId].requestId == 0) {
            revert RequestNotFound(requestId);
        }
        return dataRequests[requestId];
    }

    /**
     * @dev 오라클 소스 조회
     * @param sourceId 소스 ID
     * @return OracleSource 구조체
     */
    function getOracleSource(uint256 sourceId) external view returns (OracleSource memory) {
        if (oracleSources[sourceId].sourceAddress == address(0)) {
            revert SourceNotFound(sourceId);
        }
        return oracleSources[sourceId];
    }

    /**
     * @dev 부동산별 오라클 데이터 조회
     * @param propertyId 부동산 ID
     * @return 데이터 ID 배열
     */
    function getPropertyOracleData(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyOracleData[propertyId];
    }

    /**
     * @dev 부동산별 데이터 요청 조회
     * @param propertyId 부동산 ID
     * @return 요청 ID 배열
     */
    function getPropertyDataRequests(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyDataRequests[propertyId];
    }

    /**
     * @dev 요청자별 데이터 요청 조회
     * @param requester 요청자 주소
     * @return 요청 ID 배열
     */
    function getRequesterDataRequests(address requester) external view returns (uint256[] memory) {
        return requesterDataRequests[requester];
    }

    /**
     * @dev 데이터 유형별 데이터 조회
     * @param dataType 데이터 유형
     * @return 데이터 ID 배열
     */
    function getDataByType(DataType dataType) external view returns (uint256[] memory) {
        return dataByType[dataType];
    }

    /**
     * @dev 최신 데이터 조회
     * @param propertyId 부동산 ID
     * @param dataType 데이터 유형
     * @return 최신 데이터 ID
     */
    function getLatestData(
        uint256 propertyId,
        DataType dataType
    ) external view returns (uint256) {
        uint256[] storage dataList = propertyOracleData[propertyId];
        uint256 latestDataId = 0;
        uint256 latestTimestamp = 0;

        for (uint256 i = 0; i < dataList.length; i++) {
            OracleData storage data = oracleData[dataList[i]];
            if (data.dataType == dataType && data.timestamp > latestTimestamp) {
                latestTimestamp = data.timestamp;
                latestDataId = data.dataId;
            }
        }

        return latestDataId;
    }

    /**
     * @dev 검증된 데이터 조회
     * @param propertyId 부동산 ID
     * @param dataType 데이터 유형
     * @return 검증된 데이터 ID 배열
     */
    function getVerifiedData(
        uint256 propertyId,
        DataType dataType
    ) external view returns (uint256[] memory) {
        uint256[] storage dataList = propertyOracleData[propertyId];
        uint256 verifiedCount = 0;

        // 검증된 데이터 수 계산
        for (uint256 i = 0; i < dataList.length; i++) {
            OracleData storage data = oracleData[dataList[i]];
            if (data.dataType == dataType && data.isVerified) {
                verifiedCount++;
            }
        }

        // 검증된 데이터만 반환
        uint256[] memory verifiedData = new uint256[](verifiedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < dataList.length; i++) {
            OracleData storage data = oracleData[dataList[i]];
            if (data.dataType == dataType && data.isVerified) {
                verifiedData[index] = data.dataId;
                index++;
            }
        }

        return verifiedData;
    }

    /**
     * @dev 총 데이터 수 조회
     * @return 총 데이터 수
     */
    function getTotalData() external view returns (uint256) {
        return _dataIds;
    }

    /**
     * @dev 총 요청 수 조회
     * @return 총 요청 수
     */
    function getTotalRequests() external view returns (uint256) {
        return _requestIds;
    }

    /**
     * @dev 총 소스 수 조회
     * @return 총 소스 수
     */
    function getTotalSources() external view returns (uint256) {
        return _sourceIds;
    }

    /**
     * @dev 컨트랙트 일시 중지
     */
    function pause() external onlyRole(ORACLE_ROLE) {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 중지 해제
     */
    function unpause() external onlyRole(ORACLE_ROLE) {
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
} 