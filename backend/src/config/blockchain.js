const { ethers } = require('ethers');
const logger = require('../utils/logger');

class BlockchainConfig {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.network = null;
  }

  /**
   * 블록체인 연결 초기화
   */
  async initialize() {
    try {
      const rpcUrl = process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';
      const privateKey = process.env.PRIVATE_KEY;

      if (!privateKey) {
        throw new Error('PRIVATE_KEY environment variable is required');
      }

      // 프로바이더 설정
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // 네트워크 정보 조회
      this.network = await this.provider.getNetwork();

      // 서명자 설정
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // 스마트 컨트랙트 주소들
      const contractAddresses = {
        propertyToken: process.env.PROPERTY_TOKEN_ADDRESS,
        propertyRegistry: process.env.PROPERTY_REGISTRY_ADDRESS,
        propertyOracle: process.env.PROPERTY_ORACLE_ADDRESS,
        propertyValuation: process.env.PROPERTY_VALUATION_ADDRESS,
        tradingContract: process.env.TRADING_CONTRACT_ADDRESS,
        kycVerification: process.env.KYC_VERIFICATION_ADDRESS,
      };

      // 컨트랙트 인스턴스 생성
      await this.initializeContracts(contractAddresses);

      logger.info(
        `✅ Blockchain connected to network: ${this.network.name} (chainId: ${this.network.chainId})`
      );
      logger.info(`📝 Connected address: ${this.signer.address}`);

      return true;
    } catch (error) {
      logger.error('❌ Blockchain initialization failed:', error);
      throw error;
    }
  }

  /**
   * 스마트 컨트랙트 초기화
   */
  async initializeContracts(addresses) {
    try {
      // PropertyToken 컨트랙트 ABI (간소화된 버전)
      const propertyTokenABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function transferFrom(address from, address to, uint256 amount) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function totalSupply() view returns (uint256)',
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function issueTokens(address to, uint256 amount, string memory metadata) returns (bool)',
        'function burnTokens(address from, uint256 amount) returns (bool)',
        'function pause() external',
        'function unpause() external',
        'function paused() view returns (bool)',
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event Approval(address indexed owner, address indexed spender, uint256 value)',
        'event TokensIssued(address indexed to, uint256 amount, string metadata)',
        'event TokensBurned(address indexed from, uint256 amount)',
      ];

      // PropertyRegistry 컨트랙트 ABI
      const propertyRegistryABI = [
        'function registerProperty(string memory title, string memory location, uint256 value, string memory metadata) returns (uint256)',
        'function getProperty(uint256 propertyId) view returns (string memory title, string memory location, uint256 value, address owner, bool isActive)',
        'function updatePropertyStatus(uint256 propertyId, bool isActive) returns (bool)',
        'function transferPropertyOwnership(uint256 propertyId, address newOwner) returns (bool)',
        'function getPropertyCount() view returns (uint256)',
        'event PropertyRegistered(uint256 indexed propertyId, string title, address indexed owner, uint256 value)',
        'event PropertyStatusUpdated(uint256 indexed propertyId, bool isActive)',
        'event PropertyOwnershipTransferred(uint256 indexed propertyId, address indexed previousOwner, address indexed newOwner)',
      ];

      // PropertyOracle 컨트랙트 ABI
      const propertyOracleABI = [
        'function updateData(uint256 propertyId, string memory dataType, uint256 value, uint256 confidence) returns (bool)',
        'function getData(uint256 propertyId, string memory dataType) view returns (uint256 value, uint256 confidence, uint256 timestamp)',
        'function requestData(uint256 propertyId, string memory dataType) returns (uint256 requestId)',
        'function fulfillDataRequest(uint256 requestId, uint256 value, uint256 confidence) returns (bool)',
        'event DataUpdated(uint256 indexed propertyId, string dataType, uint256 value, uint256 confidence)',
        'event DataRequested(uint256 indexed requestId, uint256 indexed propertyId, string dataType)',
      ];

      // TradingContract 컨트랙트 ABI
      const tradingContractABI = [
        'function createOrder(uint256 propertyId, uint8 orderType, uint256 price, uint256 quantity, uint256 expiryTime) external payable returns (uint256 orderId)',
        'function matchOrders(uint256 buyOrderId, uint256 sellOrderId, uint256 quantity) external returns (uint256 tradeId)',
        'function cancelOrder(uint256 orderId) external',
        'function createEscrow(uint256 tradeId, uint256 amount, string memory conditions) external returns (uint256 escrowId)',
        'function releaseEscrow(uint256 escrowId) external',
        'function refundEscrow(uint256 escrowId) external',
        'function getOrder(uint256 orderId) external view returns (uint256 orderId, uint256 propertyId, address trader, uint8 orderType, uint256 price, uint256 quantity, uint256 filledQuantity, uint256 remainingQuantity, uint256 expiryTime, uint8 status, uint256 createdAt, uint256 updatedAt, bool isActive)',
        'function getTrade(uint256 tradeId) external view returns (uint256 tradeId, uint256 buyOrderId, uint256 sellOrderId, address buyer, address seller, uint256 propertyId, uint256 price, uint256 quantity, uint256 tradeAmount, uint256 platformFee, uint256 buyerFee, uint256 sellerFee, uint256 executedAt, string memory tradeHash)',
        'function getEscrow(uint256 escrowId) external view returns (uint256 escrowId, uint256 tradeId, address buyer, address seller, uint256 amount, uint256 releaseTime, uint8 status, uint256 createdAt, address createdBy, string memory conditions)',
        'function getPropertyOrders(uint256 propertyId) external view returns (uint256[] memory)',
        'function getTraderOrders(address trader) external view returns (uint256[] memory)',
        'function getTraderTrades(address trader) external view returns (uint256[] memory)',
        'function getPropertyTrades(uint256 propertyId) external view returns (uint256[] memory)',
        'function getTraderHistory(address trader) external view returns (uint256[] memory)',
        'function getPropertyHistory(uint256 propertyId) external view returns (uint256[] memory)',
        'function platformFeeRate() external view returns (uint256)',
        'function escrowDuration() external view returns (uint256)',
        'function getContractBalance() external view returns (uint256)',
        'event OrderCreated(uint256 indexed orderId, uint256 indexed propertyId, address indexed trader, uint8 orderType, uint256 price, uint256 quantity, uint256 expiryTime)',
        'event OrderMatched(uint256 indexed tradeId, uint256 indexed buyOrderId, uint256 indexed sellOrderId, address buyer, address seller, uint256 propertyId, uint256 price, uint256 quantity)',
        'event OrderCancelled(uint256 indexed orderId, address indexed trader, uint256 refundAmount)',
        'event OrderExpired(uint256 indexed orderId, address indexed trader)',
        'event EscrowCreated(uint256 indexed escrowId, uint256 indexed tradeId, address indexed buyer, uint256 amount)',
        'event EscrowReleased(uint256 indexed escrowId, address indexed seller, uint256 amount)',
        'event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount)',
        'event TradeExecuted(uint256 indexed tradeId, uint256 indexed propertyId, address indexed buyer, address seller, uint256 price, uint256 quantity, uint256 totalAmount)',
        'event PlatformFeeCollected(uint256 indexed tradeId, uint256 amount)',
      ];

      // KYCVerification 컨트랙트 ABI
      const kycVerificationABI = [
        'function verifyKYC(address user, uint8 kycLevel, uint256 expiryDate, uint256 dailyLimit, uint256 monthlyLimit, string memory documentHash, string memory referenceId) external returns (bool)',
        'function revokeKYC(address user) external returns (bool)',
        'function isKYCVerified(address user) external view returns (bool)',
        'function getKYCLevel(address user) external view returns (uint8)',
        'function isBlacklisted(address user) external view returns (bool)',
        'function blacklistUser(address user, string memory reason) external returns (bool)',
        'function removeFromBlacklist(address user) external returns (bool)',
        'function getKYCExpiryDate(address user) external view returns (uint256)',
        'function getDailyLimit(address user) external view returns (uint256)',
        'function getMonthlyLimit(address user) external view returns (uint256)',
        'event KYCVerified(address indexed user, uint8 kycLevel, uint256 expiryDate, string indexed referenceId)',
        'event KYCRevoked(address indexed user, string reason)',
        'event UserBlacklisted(address indexed user, string reason)',
        'event UserRemovedFromBlacklist(address indexed user)',
        'event DataRequestFulfilled(uint256 indexed requestId, uint256 value, uint256 confidence)',
      ];

      // PropertyValuation 컨트랙트 ABI
      const propertyValuationABI = [
        'function createValuation(uint256 propertyId, uint256 originalValue, string memory method, string memory reportHash) returns (uint256 valuationId)',
        'function completeValuation(uint256 valuationId, uint256 evaluatedValue, uint256 confidenceScore) returns (bool)',
        'function getValuation(uint256 valuationId) view returns (uint256 propertyId, uint256 originalValue, uint256 evaluatedValue, uint256 confidenceScore, string memory method, bool isCompleted)',
        'function createDispute(uint256 valuationId, uint256 proposedValue, string memory reason) returns (uint256 disputeId)',
        'function resolveDispute(uint256 disputeId, bool approved, string memory resolution) returns (bool)',
        'event ValuationCreated(uint256 indexed valuationId, uint256 indexed propertyId, uint256 originalValue, string method)',
        'event ValuationCompleted(uint256 indexed valuationId, uint256 evaluatedValue, uint256 confidenceScore)',
        'event DisputeCreated(uint256 indexed disputeId, uint256 indexed valuationId, uint256 proposedValue)',
        'event DisputeResolved(uint256 indexed disputeId, bool approved, string resolution)',
      ];

      // 컨트랙트 인스턴스 생성
      if (addresses.propertyToken) {
        this.contracts.propertyToken = new ethers.Contract(
          addresses.propertyToken,
          propertyTokenABI,
          this.signer
        );
        logger.info(`📄 PropertyToken contract initialized at: ${addresses.propertyToken}`);
      }

      if (addresses.propertyRegistry) {
        this.contracts.propertyRegistry = new ethers.Contract(
          addresses.propertyRegistry,
          propertyRegistryABI,
          this.signer
        );
        logger.info(`📄 PropertyRegistry contract initialized at: ${addresses.propertyRegistry}`);
      }

      if (addresses.propertyOracle) {
        this.contracts.propertyOracle = new ethers.Contract(
          addresses.propertyOracle,
          propertyOracleABI,
          this.signer
        );
        logger.info(`📄 PropertyOracle contract initialized at: ${addresses.propertyOracle}`);
      }

      if (addresses.propertyValuation) {
        this.contracts.propertyValuation = new ethers.Contract(
          addresses.propertyValuation,
          propertyValuationABI,
          this.signer
        );
        logger.info(`📄 PropertyValuation contract initialized at: ${addresses.propertyValuation}`);
      }

      if (addresses.tradingContract) {
        this.contracts.tradingContract = new ethers.Contract(
          addresses.tradingContract,
          tradingContractABI,
          this.signer
        );
        logger.info(`📄 TradingContract initialized at: ${addresses.tradingContract}`);
      }

      if (addresses.kycVerification) {
        this.contracts.kycVerification = new ethers.Contract(
          addresses.kycVerification,
          kycVerificationABI,
          this.signer
        );
        logger.info(`📄 KYCVerification contract initialized at: ${addresses.kycVerification}`);
      }
    } catch (error) {
      logger.error('Failed to initialize contracts:', error);
      throw error;
    }
  }

  /**
   * 네트워크 상태 확인
   */
  async checkNetworkStatus() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getFeeData();
      const balance = await this.signer.getBalance();

      return {
        network: this.network.name,
        chainId: this.network.chainId,
        blockNumber: blockNumber.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0',
        balance: ethers.formatEther(balance),
        address: this.signer.address,
      };
    } catch (error) {
      logger.error('Failed to check network status:', error);
      throw error;
    }
  }

  /**
   * 가스비 추정
   */
  async estimateGas(contract, method, ...args) {
    try {
      const gasEstimate = await contract[method].estimateGas(...args);
      const feeData = await this.provider.getFeeData();

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: feeData.gasPrice?.toString() || '0',
        maxFeePerGas: feeData.maxFeePerGas?.toString() || '0',
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '0',
      };
    } catch (error) {
      logger.error(`Failed to estimate gas for ${method}:`, error);
      throw error;
    }
  }

  /**
   * 트랜잭션 전송
   */
  async sendTransaction(contract, method, args = [], options = {}) {
    try {
      // 가스비 추정
      const gasEstimate = await this.estimateGas(contract, method, ...args);

      // 트랜잭션 옵션 설정
      const txOptions = {
        gasLimit: gasEstimate.gasLimit,
        ...options,
      };

      // EIP-1559 지원 확인
      if (gasEstimate.maxFeePerGas && gasEstimate.maxPriorityFeePerGas) {
        txOptions.maxFeePerGas = gasEstimate.maxFeePerGas;
        txOptions.maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;
      } else {
        txOptions.gasPrice = gasEstimate.gasPrice;
      }

      logger.info(`🚀 Sending transaction: ${method} with gas limit: ${gasEstimate.gasLimit}`);

      // 트랜잭션 전송
      const tx = await contract[method](...args, txOptions);

      logger.info(`📝 Transaction sent: ${tx.hash}`);

      // 트랜잭션 영수증 대기
      const receipt = await tx.wait();

      logger.info(`✅ Transaction confirmed: ${tx.hash} (block: ${receipt.blockNumber})`);

      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
      };
    } catch (error) {
      logger.error(`Failed to send transaction ${method}:`, error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    try {
      // PropertyToken 이벤트
      if (this.contracts.propertyToken) {
        this.contracts.propertyToken.on('Transfer', (from, to, value, event) => {
          logger.info(`🔄 Token Transfer: ${from} -> ${to} (${ethers.formatEther(value)} tokens)`);
        });

        this.contracts.propertyToken.on('TokensIssued', (to, amount, metadata, event) => {
          logger.info(`🆕 Tokens Issued: ${to} (${ethers.formatEther(amount)} tokens)`);
        });

        this.contracts.propertyToken.on('TokensBurned', (from, amount, event) => {
          logger.info(`🔥 Tokens Burned: ${from} (${ethers.formatEther(amount)} tokens)`);
        });
      }

      // PropertyRegistry 이벤트
      if (this.contracts.propertyRegistry) {
        this.contracts.propertyRegistry.on(
          'PropertyRegistered',
          (propertyId, title, owner, value, event) => {
            logger.info(
              `🏠 Property Registered: ID ${propertyId}, Title: ${title}, Owner: ${owner}, Value: ${ethers.formatEther(value)} ETH`
            );
          }
        );

        this.contracts.propertyRegistry.on(
          'PropertyOwnershipTransferred',
          (propertyId, previousOwner, newOwner, event) => {
            logger.info(
              `🔄 Property Ownership Transferred: ID ${propertyId}, ${previousOwner} -> ${newOwner}`
            );
          }
        );
      }

      logger.info('🎧 Event listeners set up successfully');
    } catch (error) {
      logger.error('Failed to setup event listeners:', error);
    }
  }

  /**
   * 연결 해제
   */
  async disconnect() {
    try {
      // 이벤트 리스너 제거
      if (this.contracts.propertyToken) {
        this.contracts.propertyToken.removeAllListeners();
      }
      if (this.contracts.propertyRegistry) {
        this.contracts.propertyRegistry.removeAllListeners();
      }
      if (this.contracts.propertyOracle) {
        this.contracts.propertyOracle.removeAllListeners();
      }
      if (this.contracts.propertyValuation) {
        this.contracts.propertyValuation.removeAllListeners();
      }

      logger.info('🔌 Blockchain connection closed');
    } catch (error) {
      logger.error('Failed to disconnect blockchain:', error);
    }
  }
}

// 싱글톤 인스턴스
const blockchainConfig = new BlockchainConfig();

module.exports = blockchainConfig;
