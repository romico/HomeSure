// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './PropertyOracle.sol';

/**
 * @title PropertyValuation
 * @dev 부동산 평가 및 검증 로직
 * 오라클 데이터를 활용하여 부동산 평가액의 정확성을 검증하고 전문가 검증 프로세스를 제공합니다.
 */
contract PropertyValuation is Ownable, AccessControl, Pausable, ReentrancyGuard {
    // 역할 정의
    bytes32 public constant VALUATOR_ROLE = keccak256('VALUATOR_ROLE');
    bytes32 public constant EXPERT_ROLE = keccak256('EXPERT_ROLE');
    bytes32 public constant APPEALER_ROLE = keccak256('APPEALER_ROLE');

    // 평가 상태 열거형
    enum ValuationStatus {
        PENDING,        // 0: 평가 대기
        IN_PROGRESS,    // 1: 평가 진행 중
        COMPLETED,      // 2: 평가 완료
        DISPUTED,       // 3: 이의제기
        RE_EVALUATING,  // 4: 재평가 중
        FINALIZED       // 5: 최종 확정
    }

    // 평가 기준 열거형
    enum ValuationCriteriaType {
        LOCATION,       // 0: 위치
        AREA,           // 1: 면적
        AGE,            // 2: 연식
        CONDITION,      // 3: 상태
        INFRASTRUCTURE, // 4: 인프라
        MARKET_TREND,   // 5: 시장 동향
        COMPARABLE,     // 6: 비교 대상
        INCOME_POTENTIAL, // 7: 수익 잠재력
        RISK_FACTOR,    // 8: 위험 요소
        OTHER           // 9: 기타
    }

    // 평가 방법 열거형
    enum ValuationMethod {
        COMPARABLE_SALES,   // 0: 비교 매매법
        INCOME_CAPITALIZATION, // 1: 수익 환원법
        COST_APPROACH,      // 2: 원가법
        DISCOUNTED_CASH_FLOW, // 3: 할인현금흐름법
        AUTOMATED_MODEL,    // 4: 자동화 모델
        EXPERT_OPINION      // 5: 전문가 의견
    }

    // 평가 정보 구조체
    struct Valuation {
        uint256 valuationId;
        uint256 propertyId;
        uint256 originalValue;
        uint256 evaluatedValue;
        uint256 marketValue;
        uint256 confidenceScore;
        ValuationStatus status;
        ValuationMethod method;
        address valuator;
        uint256 createdAt;
        uint256 completedAt;
        string reportHash;
        string notes;
        bool isDisputed;
        uint256 disputeId;
    }

    // 평가 기준 구조체
    struct ValuationCriteria {
        ValuationCriteriaType criteriaType;
        uint256 weight;
        uint256 score;
        string description;
        uint256 timestamp;
    }

    // 이의제기 구조체
    struct Dispute {
        uint256 disputeId;
        uint256 valuationId;
        uint256 propertyId;
        address appellant;
        uint256 proposedValue;
        string reason;
        uint256 createdAt;
        bool isResolved;
        uint256 resolvedAt;
        address resolver;
        string resolution;
    }

    // 전문가 검증 구조체
    struct ExpertReview {
        uint256 reviewId;
        uint256 valuationId;
        uint256 propertyId;
        address expert;
        bool isApproved;
        uint256 confidenceScore;
        string comments;
        uint256 reviewedAt;
        uint256 fee;
    }

    // 재평가 요청 구조체
    struct RevaluationRequest {
        uint256 requestId;
        uint256 propertyId;
        uint256 originalValuationId;
        address requester;
        string reason;
        uint256 requestFee;
        uint256 createdAt;
        bool isApproved;
        bool isCompleted;
        uint256 newValuationId;
    }

    // 상태 변수
    uint256 private _valuationIds;
    uint256 private _disputeIds;
    uint256 private _reviewIds;
    uint256 private _revaluationRequestIds;
    
    // 기본 설정
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_CONFIDENCE_SCORE = 0;
    uint256 public constant MAX_CONFIDENCE_SCORE = 100;
    uint256 public constant DEFAULT_CONFIDENCE_SCORE = 80;
    uint256 public constant MIN_VALUATION_FEE = 0.01 ether;
    uint256 public constant MAX_VALUATION_FEE = 1 ether;
    uint256 public constant DEFAULT_VALUATION_FEE = 0.1 ether;
    uint256 public constant MIN_DISPUTE_FEE = 0.005 ether;
    uint256 public constant MAX_DISPUTE_FEE = 0.5 ether;
    uint256 public constant DEFAULT_DISPUTE_FEE = 0.05 ether;
    uint256 public constant MAX_DEVIATION_PERCENTAGE = 20; // 20% 편차 허용
    
    // 매핑
    mapping(uint256 => Valuation) public valuations;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => ExpertReview) public expertReviews;
    mapping(uint256 => RevaluationRequest) public revaluationRequests;
    mapping(uint256 => uint256[]) public propertyValuations; // 부동산별 평가 목록
    mapping(uint256 => uint256[]) public propertyDisputes; // 부동산별 이의제기 목록
    mapping(uint256 => uint256[]) public propertyExpertReviews; // 부동산별 전문가 검증 목록
    mapping(address => uint256[]) public valuatorValuations; // 평가자별 평가 목록
    mapping(address => uint256[]) public expertReviewIds; // 전문가별 검증 목록
    mapping(uint256 => ValuationCriteria[]) public valuationCriteria; // 평가별 기준 목록

    // PropertyOracle 컨트랙트 참조
    PropertyOracle public propertyOracle;

    // 이벤트 정의
    event ValuationCreated(
        uint256 indexed valuationId,
        uint256 indexed propertyId,
        uint256 originalValue,
        address indexed valuator
    );

    event ValuationCompleted(
        uint256 indexed valuationId,
        uint256 indexed propertyId,
        uint256 evaluatedValue,
        uint256 confidenceScore
    );

    event ValuationDisputed(
        uint256 indexed disputeId,
        uint256 indexed valuationId,
        uint256 indexed propertyId,
        address appellant,
        uint256 proposedValue
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed valuationId,
        address indexed resolver,
        string resolution
    );

    event ExpertReviewSubmitted(
        uint256 indexed reviewId,
        uint256 indexed valuationId,
        address indexed expert,
        bool isApproved
    );

    event RevaluationRequested(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        address indexed requester,
        string reason
    );

    event RevaluationCompleted(
        uint256 indexed requestId,
        uint256 indexed propertyId,
        uint256 newValuationId
    );

    // 에러 정의
    error ValuationNotFound(uint256 valuationId);
    error DisputeNotFound(uint256 disputeId);
    error ReviewNotFound(uint256 reviewId);
    error RequestNotFound(uint256 requestId);
    error InvalidValuationMethod();
    error InvalidConfidenceScore(uint256 score);
    error InsufficientValuationFee(uint256 provided, uint256 required);
    error InsufficientDisputeFee(uint256 provided, uint256 required);
    error ValuationAlreadyCompleted(uint256 valuationId);
    error DisputeAlreadyResolved(uint256 disputeId);
    error RequestAlreadyApproved(uint256 requestId);
    error UnauthorizedOperation(address caller, bytes32 role);
    error InvalidDeviationPercentage(uint256 deviation);

    /**
     * @dev 생성자
     * @param _propertyOracle PropertyOracle 컨트랙트 주소
     */
    constructor(address _propertyOracle) Ownable(msg.sender) {
        require(_propertyOracle != address(0), 'Invalid PropertyOracle address');
        
        propertyOracle = PropertyOracle(_propertyOracle);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VALUATOR_ROLE, msg.sender);
        _grantRole(EXPERT_ROLE, msg.sender);
        _grantRole(APPEALER_ROLE, msg.sender);
    }

    /**
     * @dev 평가 생성
     * @param propertyId 부동산 ID
     * @param originalValue 원래 가치
     * @param method 평가 방법
     * @param reportHash 보고서 해시
     * @param notes 평가 노트
     * @return valuationId 평가 ID
     */
    function createValuation(
        uint256 propertyId,
        uint256 originalValue,
        ValuationMethod method,
        string memory reportHash,
        string memory notes
    ) external onlyRole(VALUATOR_ROLE) nonReentrant returns (uint256 valuationId) {
        require(originalValue > 0, 'Original value must be greater than 0');
        require(bytes(reportHash).length > 0, 'Report hash cannot be empty');

        _valuationIds++;
        valuationId = _valuationIds;

        valuations[valuationId] = Valuation({
            valuationId: valuationId,
            propertyId: propertyId,
            originalValue: originalValue,
            evaluatedValue: 0,
            marketValue: 0,
            confidenceScore: 0,
            status: ValuationStatus.PENDING,
            method: method,
            valuator: msg.sender,
            createdAt: block.timestamp,
            completedAt: 0,
            reportHash: reportHash,
            notes: notes,
            isDisputed: false,
            disputeId: 0
        });

        // 부동산별 평가 목록에 추가
        propertyValuations[propertyId].push(valuationId);

        // 평가자별 평가 목록에 추가
        valuatorValuations[msg.sender].push(valuationId);

        emit ValuationCreated(valuationId, propertyId, originalValue, msg.sender);
    }

    /**
     * @dev 평가 완료
     * @param valuationId 평가 ID
     * @param evaluatedValue 평가된 가치
     * @param marketValue 시장 가치
     * @param confidenceScore 신뢰도 점수
     * @param notes 완료 노트
     */
    function completeValuation(
        uint256 valuationId,
        uint256 evaluatedValue,
        uint256 marketValue,
        uint256 confidenceScore,
        string memory notes
    ) external onlyRole(VALUATOR_ROLE) nonReentrant {
        Valuation storage valuation = valuations[valuationId];
        if (valuation.valuationId == 0) {
            revert ValuationNotFound(valuationId);
        }
        if (valuation.status == ValuationStatus.COMPLETED) {
            revert ValuationAlreadyCompleted(valuationId);
        }
        if (confidenceScore < MIN_CONFIDENCE_SCORE || confidenceScore > MAX_CONFIDENCE_SCORE) {
            revert InvalidConfidenceScore(confidenceScore);
        }

        // 시장가 대비 편차 계산
        uint256 deviation = _calculateDeviation(evaluatedValue, marketValue);
        if (deviation > MAX_DEVIATION_PERCENTAGE) {
            revert InvalidDeviationPercentage(deviation);
        }

        valuation.evaluatedValue = evaluatedValue;
        valuation.marketValue = marketValue;
        valuation.confidenceScore = confidenceScore;
        valuation.status = ValuationStatus.COMPLETED;
        valuation.completedAt = block.timestamp;
        valuation.notes = notes;

        emit ValuationCompleted(valuationId, valuation.propertyId, evaluatedValue, confidenceScore);
    }

    /**
     * @dev 이의제기 생성
     * @param valuationId 평가 ID
     * @param proposedValue 제안 가치
     * @param reason 이의제기 사유
     * @return disputeId 이의제기 ID
     */
    function createDispute(
        uint256 valuationId,
        uint256 proposedValue,
        string memory reason
    ) external payable nonReentrant returns (uint256 disputeId) {
        require(msg.value >= DEFAULT_DISPUTE_FEE, 'Insufficient dispute fee');
        require(bytes(reason).length > 0, 'Reason cannot be empty');

        Valuation storage valuation = valuations[valuationId];
        if (valuation.valuationId == 0) {
            revert ValuationNotFound(valuationId);
        }
        if (valuation.status != ValuationStatus.COMPLETED) {
            revert ValuationNotFound(valuationId);
        }

        _disputeIds++;
        disputeId = _disputeIds;

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            valuationId: valuationId,
            propertyId: valuation.propertyId,
            appellant: msg.sender,
            proposedValue: proposedValue,
            reason: reason,
            createdAt: block.timestamp,
            isResolved: false,
            resolvedAt: 0,
            resolver: address(0),
            resolution: ''
        });

        // 부동산별 이의제기 목록에 추가
        propertyDisputes[valuation.propertyId].push(disputeId);

        // 평가 상태 업데이트
        valuation.isDisputed = true;
        valuation.disputeId = disputeId;
        valuation.status = ValuationStatus.DISPUTED;

        emit ValuationDisputed(disputeId, valuationId, valuation.propertyId, msg.sender, proposedValue);
    }

    /**
     * @dev 이의제기 해결
     * @param disputeId 이의제기 ID
     * @param resolution 해결 방안
     * @param newValuationId 새로운 평가 ID (필요시)
     */
    function resolveDispute(
        uint256 disputeId,
        string memory resolution,
        uint256 newValuationId
    ) external onlyRole(VALUATOR_ROLE) nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.disputeId == 0) {
            revert DisputeNotFound(disputeId);
        }
        if (dispute.isResolved) {
            revert DisputeAlreadyResolved(disputeId);
        }

        dispute.isResolved = true;
        dispute.resolvedAt = block.timestamp;
        dispute.resolver = msg.sender;
        dispute.resolution = resolution;

        // 평가 상태 업데이트
        Valuation storage valuation = valuations[dispute.valuationId];
        if (newValuationId > 0) {
            valuation.status = ValuationStatus.RE_EVALUATING;
        } else {
            valuation.status = ValuationStatus.FINALIZED;
        }

        emit DisputeResolved(disputeId, dispute.valuationId, msg.sender, resolution);
    }

    /**
     * @dev 전문가 검증 제출
     * @param valuationId 평가 ID
     * @param isApproved 승인 여부
     * @param confidenceScore 신뢰도 점수
     * @param comments 검토 의견
     * @return reviewId 검토 ID
     */
    function submitExpertReview(
        uint256 valuationId,
        bool isApproved,
        uint256 confidenceScore,
        string memory comments
    ) external onlyRole(EXPERT_ROLE) nonReentrant returns (uint256 reviewId) {
        Valuation storage valuation = valuations[valuationId];
        if (valuation.valuationId == 0) {
            revert ValuationNotFound(valuationId);
        }
        if (confidenceScore < MIN_CONFIDENCE_SCORE || confidenceScore > MAX_CONFIDENCE_SCORE) {
            revert InvalidConfidenceScore(confidenceScore);
        }

        _reviewIds++;
        reviewId = _reviewIds;

        expertReviews[reviewId] = ExpertReview({
            reviewId: reviewId,
            valuationId: valuationId,
            propertyId: valuation.propertyId,
            expert: msg.sender,
            isApproved: isApproved,
            confidenceScore: confidenceScore,
            comments: comments,
            reviewedAt: block.timestamp,
            fee: 0 // 전문가 수수료는 별도 관리
        });

        // 부동산별 전문가 검증 목록에 추가
        propertyExpertReviews[valuation.propertyId].push(reviewId);

        // 전문가별 검증 목록에 추가
        expertReviewIds[msg.sender].push(reviewId);

        emit ExpertReviewSubmitted(reviewId, valuationId, msg.sender, isApproved);
    }

    /**
     * @dev 재평가 요청
     * @param propertyId 부동산 ID
     * @param originalValuationId 원래 평가 ID
     * @param reason 재평가 사유
     * @return requestId 요청 ID
     */
    function requestRevaluation(
        uint256 propertyId,
        uint256 originalValuationId,
        string memory reason
    ) external payable nonReentrant returns (uint256 requestId) {
        require(msg.value >= DEFAULT_VALUATION_FEE, 'Insufficient valuation fee');
        require(bytes(reason).length > 0, 'Reason cannot be empty');

        _revaluationRequestIds++;
        requestId = _revaluationRequestIds;

        revaluationRequests[requestId] = RevaluationRequest({
            requestId: requestId,
            propertyId: propertyId,
            originalValuationId: originalValuationId,
            requester: msg.sender,
            reason: reason,
            requestFee: msg.value,
            createdAt: block.timestamp,
            isApproved: false,
            isCompleted: false,
            newValuationId: 0
        });

        emit RevaluationRequested(requestId, propertyId, msg.sender, reason);
    }

    /**
     * @dev 재평가 요청 승인
     * @param requestId 요청 ID
     */
    function approveRevaluationRequest(uint256 requestId) external onlyRole(VALUATOR_ROLE) {
        RevaluationRequest storage request = revaluationRequests[requestId];
        if (request.requestId == 0) {
            revert RequestNotFound(requestId);
        }
        if (request.isApproved) {
            revert RequestAlreadyApproved(requestId);
        }

        request.isApproved = true;
    }

    /**
     * @dev 재평가 완료
     * @param requestId 요청 ID
     * @param newValuationId 새로운 평가 ID
     */
    function completeRevaluation(uint256 requestId, uint256 newValuationId) external onlyRole(VALUATOR_ROLE) {
        RevaluationRequest storage request = revaluationRequests[requestId];
        if (request.requestId == 0) {
            revert RequestNotFound(requestId);
        }
        if (!request.isApproved) {
            revert RequestNotFound(requestId);
        }

        request.isCompleted = true;
        request.newValuationId = newValuationId;

        emit RevaluationCompleted(requestId, request.propertyId, newValuationId);
    }

    /**
     * @dev 편차 계산
     * @param evaluatedValue 평가 가치
     * @param marketValue 시장 가치
     * @return 편차 백분율
     */
    function _calculateDeviation(
        uint256 evaluatedValue,
        uint256 marketValue
    ) internal pure returns (uint256) {
        if (marketValue == 0) return 0;
        
        uint256 difference = evaluatedValue > marketValue ? 
            evaluatedValue - marketValue : marketValue - evaluatedValue;
        
        return (difference * 100) / marketValue;
    }

    // 조회 함수들

    /**
     * @dev 평가 정보 조회
     * @param valuationId 평가 ID
     * @return Valuation 구조체
     */
    function getValuation(uint256 valuationId) external view returns (Valuation memory) {
        if (valuations[valuationId].valuationId == 0) {
            revert ValuationNotFound(valuationId);
        }
        return valuations[valuationId];
    }

    /**
     * @dev 이의제기 정보 조회
     * @param disputeId 이의제기 ID
     * @return Dispute 구조체
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        if (disputes[disputeId].disputeId == 0) {
            revert DisputeNotFound(disputeId);
        }
        return disputes[disputeId];
    }

    /**
     * @dev 전문가 검증 정보 조회
     * @param reviewId 검토 ID
     * @return ExpertReview 구조체
     */
    function getExpertReview(uint256 reviewId) external view returns (ExpertReview memory) {
        if (expertReviews[reviewId].reviewId == 0) {
            revert ReviewNotFound(reviewId);
        }
        return expertReviews[reviewId];
    }

    /**
     * @dev 재평가 요청 정보 조회
     * @param requestId 요청 ID
     * @return RevaluationRequest 구조체
     */
    function getRevaluationRequest(uint256 requestId) external view returns (RevaluationRequest memory) {
        if (revaluationRequests[requestId].requestId == 0) {
            revert RequestNotFound(requestId);
        }
        return revaluationRequests[requestId];
    }

    /**
     * @dev 부동산별 평가 목록 조회
     * @param propertyId 부동산 ID
     * @return 평가 ID 배열
     */
    function getPropertyValuations(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyValuations[propertyId];
    }

    /**
     * @dev 부동산별 이의제기 목록 조회
     * @param propertyId 부동산 ID
     * @return 이의제기 ID 배열
     */
    function getPropertyDisputes(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyDisputes[propertyId];
    }

    /**
     * @dev 부동산별 전문가 검증 목록 조회
     * @param propertyId 부동산 ID
     * @return 검토 ID 배열
     */
    function getPropertyExpertReviews(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyExpertReviews[propertyId];
    }

    /**
     * @dev 평가자별 평가 목록 조회
     * @param valuator 평가자 주소
     * @return 평가 ID 배열
     */
    function getValuatorValuations(address valuator) external view returns (uint256[] memory) {
        return valuatorValuations[valuator];
    }

    /**
     * @dev 전문가별 검증 목록 조회
     * @param expert 전문가 주소
     * @return 검토 ID 배열
     */
    function getExpertReviews(address expert) external view returns (uint256[] memory) {
        return expertReviewIds[expert];
    }

    /**
     * @dev 총 평가 수 조회
     * @return 총 평가 수
     */
    function getTotalValuations() external view returns (uint256) {
        return _valuationIds;
    }

    /**
     * @dev 총 이의제기 수 조회
     * @return 총 이의제기 수
     */
    function getTotalDisputes() external view returns (uint256) {
        return _disputeIds;
    }

    /**
     * @dev 총 전문가 검증 수 조회
     * @return 총 전문가 검증 수
     */
    function getTotalExpertReviews() external view returns (uint256) {
        return _reviewIds;
    }

    /**
     * @dev 총 재평가 요청 수 조회
     * @return 총 재평가 요청 수
     */
    function getTotalRevaluationRequests() external view returns (uint256) {
        return _revaluationRequestIds;
    }

    /**
     * @dev 컨트랙트 일시 중지
     */
    function pause() external onlyRole(VALUATOR_ROLE) {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 중지 해제
     */
    function unpause() external onlyRole(VALUATOR_ROLE) {
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