// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './PropertyToken.sol';
import './PropertyRegistry.sol';
import './KYCVerification.sol';

/**
 * @title TradingContract
 * @dev 부동산 토큰 거래 시스템
 * ERC-1400 기반 부동산 토큰의 자동화된 거래, 에스크로 서비스, 조건부 실행 기능 제공
 */
contract TradingContract is Ownable, AccessControl, Pausable, ReentrancyGuard {

    // 역할 정의
    bytes32 public constant TRADER_ROLE = keccak256('TRADER_ROLE');
    bytes32 public constant MATCHER_ROLE = keccak256('MATCHER_ROLE');
    bytes32 public constant ESCROW_MANAGER_ROLE = keccak256('ESCROW_MANAGER_ROLE');

    // 주문 타입 열거형
    enum OrderType {
        BUY,    // 0: 매수
        SELL    // 1: 매도
    }

    // 주문 상태 열거형
    enum OrderStatus {
        OPEN,       // 0: 주문 대기
        PARTIAL,    // 1: 부분 체결
        FILLED,     // 2: 완전 체결
        CANCELLED,  // 3: 취소됨
        EXPIRED     // 4: 만료됨
    }

    // 에스크로 상태 열거형
    enum EscrowStatus {
        PENDING,    // 0: 대기 중
        RELEASED,   // 1: 해제됨
        REFUNDED    // 2: 환불됨
    }

    // 주문 구조체
    struct Order {
        uint256 orderId;
        uint256 propertyId;
        address trader;
        OrderType orderType;
        uint256 price;           // 토큰당 가격 (wei)
        uint256 quantity;        // 주문 수량
        uint256 filledQuantity;  // 체결된 수량
        uint256 remainingQuantity; // 잔여 수량
        uint256 expiryTime;      // 만료 시간
        OrderStatus status;
        uint256 createdAt;
        uint256 updatedAt;
        bool isActive;
    }

    // 거래 구조체
    struct Trade {
        uint256 tradeId;
        uint256 buyOrderId;
        uint256 sellOrderId;
        address buyer;
        address seller;
        uint256 propertyId;
        uint256 price;
        uint256 quantity;
        uint256 tradeAmount;     // 총 거래 금액
        uint256 platformFee;     // 플랫폼 수수료
        uint256 buyerFee;        // 구매자 수수료
        uint256 sellerFee;       // 판매자 수수료
        uint256 executedAt;
        string tradeHash;        // 거래 해시
    }

    // 에스크로 구조체
    struct Escrow {
        uint256 escrowId;
        uint256 tradeId;
        address buyer;
        address seller;
        uint256 amount;          // 에스크로 금액
        uint256 releaseTime;     // 해제 시간
        EscrowStatus status;
        uint256 createdAt;
        address createdBy;
        string conditions;       // 해제 조건
    }

    // 거래 히스토리 구조체
    struct TradeHistory {
        uint256 historyId;
        uint256 propertyId;
        address trader;
        OrderType orderType;
        uint256 price;
        uint256 quantity;
        uint256 totalAmount;
        uint256 timestamp;
        string transactionHash;
    }

    // 상태 변수
    uint256 private _orderIds;
    uint256 private _tradeIds;
    uint256 private _escrowIds;
    uint256 private _historyIds;

    // 기본 설정
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_ORDER_AMOUNT = 0.001 ether;    // 0.001 ETH
    uint256 public constant MAX_ORDER_AMOUNT = 1000 ether;     // 1000 ETH
    uint256 public constant DEFAULT_PLATFORM_FEE = 25;         // 0.25% (25 basis points)
    uint256 public constant DEFAULT_ESCROW_DURATION = 24 hours; // 24시간
    uint256 public constant MAX_ORDER_DURATION = 7 days;       // 7일

    // 매핑
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Trade) public trades;
    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => TradeHistory) public tradeHistories;
    mapping(uint256 => uint256[]) public propertyOrders;      // 부동산별 주문 목록
    mapping(address => uint256[]) public traderOrders;        // 거래자별 주문 목록
    mapping(uint256 => uint256[]) public orderTrades;         // 주문별 거래 목록
    mapping(address => uint256[]) public traderTrades;        // 거래자별 거래 목록
    mapping(uint256 => uint256[]) public propertyTrades;      // 부동산별 거래 목록
    mapping(address => uint256[]) public traderHistory;       // 거래자별 히스토리
    mapping(uint256 => uint256[]) public propertyHistory;     // 부동산별 히스토리

    // 컨트랙트 참조
    PropertyToken public propertyToken;
    PropertyRegistry public propertyRegistry;
    KYCVerification public kycVerification;

    // 수수료 설정
    uint256 public platformFeeRate = DEFAULT_PLATFORM_FEE;
    uint256 public escrowDuration = DEFAULT_ESCROW_DURATION;

    // 이벤트 정의
    event OrderCreated(
        uint256 indexed orderId,
        uint256 indexed propertyId,
        address indexed trader,
        OrderType orderType,
        uint256 price,
        uint256 quantity,
        uint256 expiryTime
    );

    event OrderMatched(
        uint256 indexed tradeId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        address buyer,
        address seller,
        uint256 propertyId,
        uint256 price,
        uint256 quantity
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed trader,
        uint256 refundAmount
    );

    event OrderExpired(
        uint256 indexed orderId,
        address indexed trader
    );

    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed tradeId,
        address indexed buyer,
        uint256 amount
    );

    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 amount
    );

    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount
    );

    event TradeExecuted(
        uint256 indexed tradeId,
        uint256 indexed propertyId,
        address indexed buyer,
        address seller,
        uint256 price,
        uint256 quantity,
        uint256 totalAmount
    );

    event PlatformFeeCollected(
        uint256 indexed tradeId,
        uint256 amount
    );

    // 에러 정의
    error OrderNotFound(uint256 orderId);
    error OrderAlreadyFilled(uint256 orderId);
    error InsufficientBalance(address trader, uint256 required, uint256 available);
    error InvalidOrderType();
    error InvalidPrice(uint256 price);
    error InvalidQuantity(uint256 quantity);
    error InvalidExpiryTime(uint256 expiryTime);
    error OrderNotMatchable(uint256 buyOrderId, uint256 sellOrderId);
    error EscrowNotFound(uint256 escrowId);
    error EscrowNotReleasable(uint256 escrowId);
    error UnauthorizedOperation(address caller, bytes32 role);

    /**
     * @dev 생성자
     * @param _propertyToken PropertyToken 컨트랙트 주소
     * @param _propertyRegistry PropertyRegistry 컨트랙트 주소
     * @param _kycVerification KYCVerification 컨트랙트 주소
     */
    constructor(
        address _propertyToken,
        address _propertyRegistry,
        address _kycVerification
    ) Ownable(msg.sender) {
        require(_propertyToken != address(0), 'Invalid PropertyToken address');
        require(_propertyRegistry != address(0), 'Invalid PropertyRegistry address');
        require(_kycVerification != address(0), 'Invalid KYCVerification address');

        propertyToken = PropertyToken(_propertyToken);
        propertyRegistry = PropertyRegistry(_propertyRegistry);
        kycVerification = KYCVerification(_kycVerification);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TRADER_ROLE, msg.sender);
        _grantRole(MATCHER_ROLE, msg.sender);
        _grantRole(ESCROW_MANAGER_ROLE, msg.sender);
    }

    /**
     * @dev 주문 생성
     * @param propertyId 부동산 ID
     * @param orderType 주문 타입 (BUY/SELL)
     * @param price 토큰당 가격 (wei)
     * @param quantity 주문 수량
     * @param expiryTime 만료 시간
     * @return orderId 생성된 주문 ID
     */
    function createOrder(
        uint256 propertyId,
        OrderType orderType,
        uint256 price,
        uint256 quantity,
        uint256 expiryTime
    ) external payable nonReentrant whenNotPaused returns (uint256 orderId) {
        require(hasRole(TRADER_ROLE, msg.sender) || msg.sender == owner(), 'Not authorized trader');
        require(kycVerification.isKYCVerified(msg.sender), 'KYC not verified');
        require(!kycVerification.isBlacklisted(msg.sender), 'Address blacklisted');
        require(price > 0, 'Price must be greater than 0');
        require(quantity > 0, 'Quantity must be greater than 0');
        require(expiryTime > block.timestamp, 'Expiry time must be in the future');
        require(expiryTime <= block.timestamp + MAX_ORDER_DURATION, 'Expiry time too far');

        uint256 totalAmount = price * quantity;
        require(totalAmount >= MIN_ORDER_AMOUNT, 'Order amount too low');
        require(totalAmount <= MAX_ORDER_AMOUNT, 'Order amount too high');

        if (orderType == OrderType.BUY) {
            require(msg.value >= totalAmount, 'Insufficient ETH for buy order');
        } else if (orderType == OrderType.SELL) {
            require(propertyToken.balanceOf(msg.sender) >= quantity, 'Insufficient token balance');
            require(propertyToken.allowance(msg.sender, address(this)) >= quantity, 'Insufficient token allowance');
        } else {
            revert InvalidOrderType();
        }

        _orderIds++;
        orderId = _orderIds;

        orders[orderId] = Order({
            orderId: orderId,
            propertyId: propertyId,
            trader: msg.sender,
            orderType: orderType,
            price: price,
            quantity: quantity,
            filledQuantity: 0,
            remainingQuantity: quantity,
            expiryTime: expiryTime,
            status: OrderStatus.OPEN,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });

        // 매핑 업데이트
        propertyOrders[propertyId].push(orderId);
        traderOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, propertyId, msg.sender, orderType, price, quantity, expiryTime);
    }

    /**
     * @dev 주문 매칭 및 실행
     * @param buyOrderId 매수 주문 ID
     * @param sellOrderId 매도 주문 ID
     * @param quantity 매칭할 수량
     * @return tradeId 생성된 거래 ID
     */
    function matchOrders(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint256 quantity
    ) external onlyRole(MATCHER_ROLE) nonReentrant whenNotPaused returns (uint256 tradeId) {
        Order storage buyOrder = orders[buyOrderId];
        Order storage sellOrder = orders[sellOrderId];

        if (buyOrder.orderId == 0) revert OrderNotFound(buyOrderId);
        if (sellOrder.orderId == 0) revert OrderNotFound(sellOrderId);
        if (buyOrder.status != OrderStatus.OPEN && buyOrder.status != OrderStatus.PARTIAL) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (sellOrder.status != OrderStatus.OPEN && sellOrder.status != OrderStatus.PARTIAL) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (buyOrder.orderType != OrderType.BUY) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (sellOrder.orderType != OrderType.SELL) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (buyOrder.propertyId != sellOrder.propertyId) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (buyOrder.price < sellOrder.price) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (buyOrder.remainingQuantity < quantity) revert OrderNotMatchable(buyOrderId, sellOrderId);
        if (sellOrder.remainingQuantity < quantity) revert OrderNotMatchable(buyOrderId, sellOrderId);

        uint256 tradePrice = sellOrder.price; // 매도가 기준
        uint256 tradeAmount = tradePrice * quantity;
        uint256 platformFee = tradeAmount * platformFeeRate / BASIS_POINTS;
        uint256 buyerFee = platformFee / 2;
        uint256 sellerFee = platformFee - buyerFee;

        _tradeIds++;
        tradeId = _tradeIds;

        trades[tradeId] = Trade({
            tradeId: tradeId,
            buyOrderId: buyOrderId,
            sellOrderId: sellOrderId,
            buyer: buyOrder.trader,
            seller: sellOrder.trader,
            propertyId: buyOrder.propertyId,
            price: tradePrice,
            quantity: quantity,
            tradeAmount: tradeAmount,
            platformFee: platformFee,
            buyerFee: buyerFee,
            sellerFee: sellerFee,
            executedAt: block.timestamp,
            tradeHash: ''
        });

        // 주문 상태 업데이트
        _updateOrderStatus(buyOrder, quantity);
        _updateOrderStatus(sellOrder, quantity);

        // 토큰 전송
        bytes memory data = abi.encode(buyOrder.propertyId, "trade");
        propertyToken.transferFromWithData(sellOrder.trader, buyOrder.trader, quantity, data);

        // ETH 전송
        uint256 sellerAmount = tradeAmount - sellerFee;
        payable(sellOrder.trader).transfer(sellerAmount);

        // 매핑 업데이트
        orderTrades[buyOrderId].push(tradeId);
        orderTrades[sellOrderId].push(tradeId);
        traderTrades[buyOrder.trader].push(tradeId);
        traderTrades[sellOrder.trader].push(tradeId);
        propertyTrades[buyOrder.propertyId].push(tradeId);

        // 거래 히스토리 생성
        _createTradeHistory(buyOrder.trader, buyOrder.propertyId, OrderType.BUY, tradePrice, quantity, tradeAmount);
        _createTradeHistory(sellOrder.trader, sellOrder.propertyId, OrderType.SELL, tradePrice, quantity, tradeAmount);

        emit OrderMatched(tradeId, buyOrderId, sellOrderId, buyOrder.trader, sellOrder.trader, buyOrder.propertyId, tradePrice, quantity);
        emit TradeExecuted(tradeId, buyOrder.propertyId, buyOrder.trader, sellOrder.trader, tradePrice, quantity, tradeAmount);
        emit PlatformFeeCollected(tradeId, platformFee);
    }

    /**
     * @dev 주문 취소
     * @param orderId 취소할 주문 ID
     */
    function cancelOrder(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.orderId == 0) revert OrderNotFound(orderId);
        require(order.trader == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), 'Not order owner or admin');
        require(order.status == OrderStatus.OPEN || order.status == OrderStatus.PARTIAL, 'Order cannot be cancelled');

        order.status = OrderStatus.CANCELLED;
        order.isActive = false;
        order.updatedAt = block.timestamp;

        // 환불 처리
        if (order.orderType == OrderType.BUY) {
            uint256 refundAmount = order.price * order.remainingQuantity;
            if (refundAmount > 0) {
                payable(order.trader).transfer(refundAmount);
            }
        }

        emit OrderCancelled(orderId, order.trader, order.price * order.remainingQuantity);
    }

    /**
     * @dev 에스크로 생성
     * @param tradeId 거래 ID
     * @param amount 에스크로 금액
     * @param conditions 해제 조건
     * @return escrowId 생성된 에스크로 ID
     */
    function createEscrow(
        uint256 tradeId,
        uint256 amount,
        string memory conditions
    ) external onlyRole(ESCROW_MANAGER_ROLE) nonReentrant whenNotPaused returns (uint256 escrowId) {
        Trade storage trade = trades[tradeId];
        require(trade.tradeId != 0, 'Trade not found');

        _escrowIds++;
        escrowId = _escrowIds;

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            tradeId: tradeId,
            buyer: trade.buyer,
            seller: trade.seller,
            amount: amount,
            releaseTime: block.timestamp + escrowDuration,
            status: EscrowStatus.PENDING,
            createdAt: block.timestamp,
            createdBy: msg.sender,
            conditions: conditions
        });

        emit EscrowCreated(escrowId, tradeId, trade.buyer, amount);
    }

    /**
     * @dev 에스크로 해제
     * @param escrowId 에스크로 ID
     */
    function releaseEscrow(uint256 escrowId) external onlyRole(ESCROW_MANAGER_ROLE) nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.PENDING) revert EscrowNotReleasable(escrowId);
        require(block.timestamp >= escrow.releaseTime, 'Escrow not yet releasable');

        escrow.status = EscrowStatus.RELEASED;
        payable(escrow.seller).transfer(escrow.amount);

        emit EscrowReleased(escrowId, escrow.seller, escrow.amount);
    }

    /**
     * @dev 에스크로 환불
     * @param escrowId 에스크로 ID
     */
    function refundEscrow(uint256 escrowId) external onlyRole(ESCROW_MANAGER_ROLE) nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.PENDING) revert EscrowNotReleasable(escrowId);

        escrow.status = EscrowStatus.REFUNDED;
        payable(escrow.buyer).transfer(escrow.amount);

        emit EscrowRefunded(escrowId, escrow.buyer, escrow.amount);
    }

    /**
     * @dev 만료된 주문 정리
     * @param orderIds 정리할 주문 ID 배열
     */
    function cleanupExpiredOrders(uint256[] memory orderIds) external onlyRole(MATCHER_ROLE) {
        for (uint256 i = 0; i < orderIds.length; i++) {
            Order storage order = orders[orderIds[i]];
            if (order.orderId != 0 && order.status == OrderStatus.OPEN && block.timestamp > order.expiryTime) {
                order.status = OrderStatus.EXPIRED;
                order.isActive = false;
                order.updatedAt = block.timestamp;

                        if (order.orderType == OrderType.BUY) {
            uint256 refundAmount = order.price * order.remainingQuantity;
            if (refundAmount > 0) {
                payable(order.trader).transfer(refundAmount);
            }
        }

                emit OrderExpired(orderIds[i], order.trader);
            }
        }
    }

    // 내부 함수들

    /**
     * @dev 주문 상태 업데이트
     * @param order 주문 구조체
     * @param quantity 체결된 수량
     */
    function _updateOrderStatus(Order storage order, uint256 quantity) internal {
        order.filledQuantity = order.filledQuantity + quantity;
        order.remainingQuantity = order.remainingQuantity - quantity;
        order.updatedAt = block.timestamp;

        if (order.remainingQuantity == 0) {
            order.status = OrderStatus.FILLED;
            order.isActive = false;
        } else {
            order.status = OrderStatus.PARTIAL;
        }
    }

    /**
     * @dev 거래 히스토리 생성
     * @param trader 거래자 주소
     * @param propertyId 부동산 ID
     * @param orderType 주문 타입
     * @param price 가격
     * @param quantity 수량
     * @param totalAmount 총 거래 금액
     */
    function _createTradeHistory(
        address trader,
        uint256 propertyId,
        OrderType orderType,
        uint256 price,
        uint256 quantity,
        uint256 totalAmount
    ) internal {
        _historyIds++;
        uint256 historyId = _historyIds;

        tradeHistories[historyId] = TradeHistory({
            historyId: historyId,
            propertyId: propertyId,
            trader: trader,
            orderType: orderType,
            price: price,
            quantity: quantity,
            totalAmount: totalAmount,
            timestamp: block.timestamp,
            transactionHash: ''
        });

        traderHistory[trader].push(historyId);
        propertyHistory[propertyId].push(historyId);
    }

    // 조회 함수들

    /**
     * @dev 주문 정보 조회
     * @param orderId 주문 ID
     * @return 주문 정보
     */
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /**
     * @dev 거래 정보 조회
     * @param tradeId 거래 ID
     * @return 거래 정보
     */
    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }

    /**
     * @dev 에스크로 정보 조회
     * @param escrowId 에스크로 ID
     * @return 에스크로 정보
     */
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    /**
     * @dev 부동산별 주문 목록 조회
     * @param propertyId 부동산 ID
     * @return 주문 ID 배열
     */
    function getPropertyOrders(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyOrders[propertyId];
    }

    /**
     * @dev 거래자별 주문 목록 조회
     * @param trader 거래자 주소
     * @return 주문 ID 배열
     */
    function getTraderOrders(address trader) external view returns (uint256[] memory) {
        return traderOrders[trader];
    }

    /**
     * @dev 거래자별 거래 목록 조회
     * @param trader 거래자 주소
     * @return 거래 ID 배열
     */
    function getTraderTrades(address trader) external view returns (uint256[] memory) {
        return traderTrades[trader];
    }

    /**
     * @dev 부동산별 거래 목록 조회
     * @param propertyId 부동산 ID
     * @return 거래 ID 배열
     */
    function getPropertyTrades(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyTrades[propertyId];
    }

    /**
     * @dev 거래자별 히스토리 조회
     * @param trader 거래자 주소
     * @return 히스토리 ID 배열
     */
    function getTraderHistory(address trader) external view returns (uint256[] memory) {
        return traderHistory[trader];
    }

    /**
     * @dev 부동산별 히스토리 조회
     * @param propertyId 부동산 ID
     * @return 히스토리 ID 배열
     */
    function getPropertyHistory(uint256 propertyId) external view returns (uint256[] memory) {
        return propertyHistory[propertyId];
    }

    // 관리자 함수들

    /**
     * @dev 플랫폼 수수료율 설정
     * @param newFeeRate 새로운 수수료율 (basis points)
     */
    function setPlatformFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 1000, 'Fee rate too high'); // 최대 10%
        platformFeeRate = newFeeRate;
    }

    /**
     * @dev 에스크로 기간 설정
     * @param newDuration 새로운 에스크로 기간 (초)
     */
    function setEscrowDuration(uint256 newDuration) external onlyOwner {
        require(newDuration <= 7 days, 'Duration too long');
        escrowDuration = newDuration;
    }

    /**
     * @dev 컨트랙트 일시 중지
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 중지 해제
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 플랫폼 수수료 출금
     * @param amount 출금할 금액
     */
    function withdrawPlatformFees(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, 'Insufficient balance');
        payable(owner()).transfer(amount);
    }

    /**
     * @dev ERC165 표준 지원
     */
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev 컨트랙트 잔액 조회
     * @return 컨트랙트 ETH 잔액
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
} 