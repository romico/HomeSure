import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Web3State } from '../types';
import web3Service from '../services/web3';
import { useUser } from './UserContext';

interface Web3ContextType {
  web3State: Web3State;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
  error: string | null;
  clearError: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const [web3State, setWeb3State] = useState<Web3State>({
    isConnected: false,
    account: null,
    chainId: null,
    networkName: null,
    balance: null,
    provider: null,
    signer: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UserContext 사용
  const { setWalletAddress, setBalance, resetUser } = useUser();

  // 초기 연결 상태 확인
  useEffect(() => {
    checkConnectionState();
  }, []);

  // 네트워크 변경 감지
  useEffect(() => {
    web3Service.onNetworkChange((chainId) => {
      setWeb3State(prev => ({
        ...prev,
        chainId,
      }));
    });

    // 계정 변경 감지
    web3Service.onAccountChange((accounts) => {
      if (accounts.length === 0) {
        // 계정이 연결 해제됨
        disconnectWallet();
      } else {
        // 계정이 변경됨
        const newAccount = accounts[0];
        setWeb3State(prev => ({
          ...prev,
          account: newAccount,
        }));
        setWalletAddress(newAccount);
      }
    });
  }, []); // setWalletAddress는 이미 메모이제이션됨

  const checkConnectionState = async () => {
    try {
      const state = await web3Service.getConnectionState();
      setWeb3State(state);
      
      // 사용자 상태 업데이트
      if (state.isConnected && state.account) {
        setWalletAddress(state.account);
        setBalance(state.balance);
      }
    } catch (err) {
      console.error('Failed to check connection state:', err);
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const state = await web3Service.connectWallet();
      setWeb3State(state);

      // 사용자 상태 업데이트
      if (state.account) {
        setWalletAddress(state.account);
        setBalance(state.balance);
      }

      // 연결 성공 메시지
      console.log('Wallet connected successfully:', state.account);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '지갑 연결에 실패했습니다.';
      setError(errorMessage);
      console.error('Failed to connect wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    web3Service.disconnectWallet();
    setWeb3State({
      isConnected: false,
      account: null,
      chainId: null,
      networkName: null,
      balance: null,
      provider: null,
      signer: null,
    });
    
    // 사용자 상태 초기화
    resetUser();
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const value: Web3ContextType = {
    web3State,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error,
    clearError,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}; 