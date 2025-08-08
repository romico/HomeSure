export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface ContractAddresses {
  propertyToken: string;
  propertyRegistry: string;
  propertyOracle: string;
  propertyValuation: string;
  tradingContract: string;
  kycVerification: string;
}

// 지원하는 네트워크 설정
export const NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  5: {
    chainId: 5,
    name: 'Goerli Testnet',
    rpcUrl: 'https://goerli.infura.io/v3/YOUR_INFURA_KEY',
    explorerUrl: 'https://goerli.etherscan.io',
    nativeCurrency: {
      name: 'Goerli Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  1337: {
    chainId: 1337,
    name: 'Localhost',
    rpcUrl: 'http://localhost:8545',
    explorerUrl: '',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

// 배포된 컨트랙트 주소 (Hardhat Localhost)
export const CONTRACT_ADDRESSES: ContractAddresses = {
  propertyToken: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
  propertyRegistry: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
  propertyOracle: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  propertyValuation: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
  tradingContract: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
  kycVerification: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
};

// 지원하는 네트워크 체인 ID 목록
export const SUPPORTED_CHAIN_IDS = Object.keys(NETWORKS).map(Number);

// 기본 네트워크 (개발 환경)
export const DEFAULT_NETWORK_ID = 1337;

// 네트워크가 지원되는지 확인
export const isNetworkSupported = (chainId: number): boolean => {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
};

// 네트워크 설정 가져오기
export const getNetworkConfig = (chainId: number): NetworkConfig | null => {
  return NETWORKS[chainId] || null;
};

// 컨트랙트 주소가 설정되었는지 확인
export const areContractsConfigured = (): boolean => {
  return Object.values(CONTRACT_ADDRESSES).every(address => address !== '');
}; 