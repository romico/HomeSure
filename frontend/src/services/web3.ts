import { ethers } from 'ethers';
import { Web3State, ContractState } from '../types';

class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contracts: ContractState = {
    propertyToken: null,
    propertyRegistry: null,
    propertyOracle: null,
    propertyValuation: null,
  };

  // PropertyToken ABI (간소화된 버전)
  private propertyTokenABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function issueTokens(address to, uint256 amount, string memory metadata) returns (bool)",
    "function burnTokens(address from, uint256 amount) returns (bool)",
    "function pause() external",
    "function unpause() external",
    "function paused() view returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    "event TokensIssued(address indexed to, uint256 amount, string metadata)",
    "event TokensBurned(address indexed from, uint256 amount)"
  ];

  // PropertyRegistry ABI
  private propertyRegistryABI = [
    "function registerProperty(string memory title, string memory location, uint256 value, string memory metadata) returns (uint256)",
    "function getProperty(uint256 propertyId) view returns (string memory title, string memory location, uint256 value, address owner, bool isActive)",
    "function updatePropertyStatus(uint256 propertyId, bool isActive) returns (bool)",
    "function transferPropertyOwnership(uint256 propertyId, address newOwner) returns (bool)",
    "function getPropertyCount() view returns (uint256)",
    "event PropertyRegistered(uint256 indexed propertyId, string title, address indexed owner, uint256 value)",
    "event PropertyStatusUpdated(uint256 indexed propertyId, bool isActive)",
    "event PropertyOwnershipTransferred(uint256 indexed propertyId, address indexed previousOwner, address indexed newOwner)"
  ];

  // PropertyOracle ABI
  private propertyOracleABI = [
    "function updateData(uint256 propertyId, string memory dataType, uint256 value, uint256 confidence) returns (bool)",
    "function getData(uint256 propertyId, string memory dataType) view returns (uint256 value, uint256 confidence, uint256 timestamp)",
    "function requestData(uint256 propertyId, string memory dataType) returns (uint256 requestId)",
    "function fulfillDataRequest(uint256 requestId, uint256 value, uint256 confidence) returns (bool)",
    "event DataUpdated(uint256 indexed propertyId, string dataType, uint256 value, uint256 confidence)",
    "event DataRequested(uint256 indexed requestId, uint256 indexed propertyId, string dataType)",
    "event DataRequestFulfilled(uint256 indexed requestId, uint256 value, uint256 confidence)"
  ];

  // PropertyValuation ABI
  private propertyValuationABI = [
    "function createValuation(uint256 propertyId, uint256 originalValue, string memory method, string memory reportHash) returns (uint256 valuationId)",
    "function completeValuation(uint256 valuationId, uint256 evaluatedValue, uint256 confidenceScore) returns (bool)",
    "function getValuation(uint256 valuationId) view returns (uint256 propertyId, uint256 originalValue, uint256 evaluatedValue, uint256 confidenceScore, string memory method, bool isCompleted)",
    "function createDispute(uint256 valuationId, uint256 proposedValue, string memory reason) returns (uint256 disputeId)",
    "function resolveDispute(uint256 disputeId, bool approved, string memory resolution) returns (bool)",
    "event ValuationCreated(uint256 indexed valuationId, uint256 indexed propertyId, uint256 originalValue, string method)",
    "event ValuationCompleted(uint256 indexed valuationId, uint256 evaluatedValue, uint256 confidenceScore)",
    "event DisputeCreated(uint256 indexed disputeId, uint256 indexed valuationId, uint256 proposedValue)",
    "event DisputeResolved(uint256 indexed disputeId, bool approved, string resolution)"
  ];

  /**
   * MetaMask 연결
   */
  async connectWallet(): Promise<Web3State> {
    try {
      // MetaMask가 설치되어 있는지 확인
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      // 계정 연결 요청
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const account = accounts[0];

      // Provider 생성
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      // 네트워크 정보 가져오기
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(account);

      // 컨트랙트 인스턴스 초기화
      await this.initializeContracts();

      return {
        isConnected: true,
        account,
        chainId: Number(network.chainId),
        networkName: network.name,
        balance: ethers.formatEther(balance),
        provider: this.provider,
        signer: this.signer,
      };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  /**
   * 컨트랙트 인스턴스 초기화
   */
  private async initializeContracts(): Promise<void> {
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    const propertyTokenAddress = process.env.REACT_APP_PROPERTY_TOKEN_ADDRESS;
    const propertyRegistryAddress = process.env.REACT_APP_PROPERTY_REGISTRY_ADDRESS;
    const propertyOracleAddress = process.env.REACT_APP_PROPERTY_ORACLE_ADDRESS;
    const propertyValuationAddress = process.env.REACT_APP_PROPERTY_VALUATION_ADDRESS;

    if (propertyTokenAddress) {
      this.contracts.propertyToken = new ethers.Contract(
        propertyTokenAddress,
        this.propertyTokenABI,
        this.signer
      );
    }

    if (propertyRegistryAddress) {
      this.contracts.propertyRegistry = new ethers.Contract(
        propertyRegistryAddress,
        this.propertyRegistryABI,
        this.signer
      );
    }

    if (propertyOracleAddress) {
      this.contracts.propertyOracle = new ethers.Contract(
        propertyOracleAddress,
        this.propertyOracleABI,
        this.signer
      );
    }

    if (propertyValuationAddress) {
      this.contracts.propertyValuation = new ethers.Contract(
        propertyValuationAddress,
        this.propertyValuationABI,
        this.signer
      );
    }
  }

  /**
   * 지갑 연결 해제
   */
  disconnectWallet(): void {
    this.provider = null;
    this.signer = null;
    this.contracts = {
      propertyToken: null,
      propertyRegistry: null,
      propertyOracle: null,
      propertyValuation: null,
    };
  }

  /**
   * 현재 연결 상태 가져오기
   */
  async getConnectionState(): Promise<Web3State> {
    if (!this.provider || !this.signer) {
      return {
        isConnected: false,
        account: null,
        chainId: null,
        networkName: null,
        balance: null,
        provider: null,
        signer: null,
      };
    }

    try {
      const account = await this.signer.getAddress();
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(account);

      return {
        isConnected: true,
        account,
        chainId: Number(network.chainId),
        networkName: network.name,
        balance: ethers.formatEther(balance),
        provider: this.provider,
        signer: this.signer,
      };
    } catch (error) {
      console.error('Failed to get connection state:', error);
      return {
        isConnected: false,
        account: null,
        chainId: null,
        networkName: null,
        balance: null,
        provider: null,
        signer: null,
      };
    }
  }

  /**
   * 토큰 잔액 조회
   */
  async getTokenBalance(address: string): Promise<string> {
    if (!this.contracts.propertyToken) {
      throw new Error('PropertyToken contract not initialized');
    }

    try {
      const balance = await this.contracts.propertyToken.balanceOf(address);
      const decimals = await this.contracts.propertyToken.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Failed to get token balance:', error);
      throw error;
    }
  }

  /**
   * 토큰 전송
   */
  async transferTokens(to: string, amount: string): Promise<any> {
    if (!this.contracts.propertyToken) {
      throw new Error('PropertyToken contract not initialized');
    }

    try {
      const decimals = await this.contracts.propertyToken.decimals();
      const tokenAmount = ethers.parseUnits(amount, decimals);

      const tx = await this.contracts.propertyToken.transfer(to, tokenAmount);
      const receipt = await tx.wait();

      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
      };
    } catch (error) {
      console.error('Failed to transfer tokens:', error);
      throw error;
    }
  }

  /**
   * 부동산 등록
   */
  async registerProperty(title: string, location: string, value: string, metadata: string): Promise<any> {
    if (!this.contracts.propertyRegistry) {
      throw new Error('PropertyRegistry contract not initialized');
    }

    try {
      const valueInWei = ethers.parseEther(value);

      const tx = await this.contracts.propertyRegistry.registerProperty(
        title,
        location,
        valueInWei,
        metadata
      );
      const receipt = await tx.wait();

      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
      };
    } catch (error) {
      console.error('Failed to register property:', error);
      throw error;
    }
  }

  /**
   * 부동산 정보 조회
   */
  async getProperty(propertyId: number): Promise<any> {
    if (!this.contracts.propertyRegistry) {
      throw new Error('PropertyRegistry contract not initialized');
    }

    try {
      const property = await this.contracts.propertyRegistry.getProperty(propertyId);
      
      return {
        propertyId,
        title: property[0],
        location: property[1],
        value: ethers.formatEther(property[2]),
        owner: property[3],
        isActive: property[4],
      };
    } catch (error) {
      console.error('Failed to get property:', error);
      throw error;
    }
  }

  /**
   * 네트워크 변경 감지
   */
  onNetworkChange(callback: (chainId: number) => void): void {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId: string) => {
        callback(parseInt(chainId, 16));
      });
    }
  }

  /**
   * 계정 변경 감지
   */
  onAccountChange(callback: (accounts: string[]) => void): void {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  /**
   * 가스비 추정
   */
  async estimateGas(contractName: keyof ContractState, method: string, ...args: any[]): Promise<any> {
    const contract = this.contracts[contractName];
    if (!contract) {
      throw new Error(`${contractName} contract not initialized`);
    }

    try {
      const gasEstimate = await contract[method].estimateGas(...args);
      const feeData = await this.provider!.getFeeData();

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: feeData.gasPrice?.toString() || '0',
        maxFeePerGas: feeData.maxFeePerGas?.toString() || '0',
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '0',
      };
    } catch (error) {
      console.error(`Failed to estimate gas for ${method}:`, error);
      throw error;
    }
  }

  /**
   * 컨트랙트 인스턴스 가져오기
   */
  getContracts(): ContractState {
    return this.contracts;
  }

  /**
   * Provider 가져오기
   */
  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  /**
   * Signer 가져오기
   */
  getSigner(): ethers.JsonRpcSigner | null {
    return this.signer;
  }
}

// Singleton instance
const web3Service = new Web3Service();

export default web3Service; 