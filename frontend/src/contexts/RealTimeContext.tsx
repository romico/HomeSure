import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import webSocketService, { PriceData, PortfolioUpdate, TransactionUpdate } from '../services/websocket';
import cacheService from '../services/cache';
import { useToast } from '../components/common/ToastContainer';
import { useWeb3 } from './Web3Context';
import { debounce, throttle } from '../utils/performance';

interface RealTimeState {
  isConnected: boolean;
  lastUpdate: Date | null;
  priceData: Map<string, PriceData>;
  portfolioData: PortfolioUpdate | null;
  recentTransactions: TransactionUpdate[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
}

interface RealTimeContextType {
  state: RealTimeState;
  subscribeToPrices: (propertyIds: string[]) => void;
  subscribeToPortfolio: () => void;
  subscribeToTransactions: () => void;
  unsubscribeFromPrices: (propertyIds: string[]) => void;
  unsubscribeFromPortfolio: () => void;
  unsubscribeFromTransactions: () => void;
  refreshData: () => void;
  clearCache: () => void;
  getSubscriptionStats: () => { total: number; max: number; subscriptions: string[] };
}

const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

export const useRealTime = (): RealTimeContextType => {
  const context = React.useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
};

interface RealTimeProviderProps {
  children: React.ReactNode;
}

export const RealTimeProvider: React.FC<RealTimeProviderProps> = ({ children }) => {
  const { web3State } = useWeb3();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [state, setState] = useState<RealTimeState>({
    isConnected: false,
    lastUpdate: null,
    priceData: new Map(),
    portfolioData: null,
    recentTransactions: [],
    connectionStatus: 'disconnected',
    reconnectAttempts: 0,
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Toast 함수 설정 - useCallback으로 메모이제이션
  const toastFunctions = useCallback(() => ({
    showSuccess,
    showError,
    showInfo
  }), [showSuccess, showError, showInfo]);

  useEffect(() => {
    webSocketService.setToastFunction(toastFunctions());
  }, [toastFunctions]);

  // WebSocket 연결 관리
  const connectWebSocket = useCallback(async () => {
    if (state.connectionStatus === 'connecting') {
      console.log('이미 연결 중입니다. 중복 연결을 건너뜁니다.');
      return;
    }

    if (state.isConnected) {
      console.log('이미 연결되어 있습니다. 중복 연결을 건너뜁니다.');
      return;
    }

    // 최대 재연결 시도 횟수에 도달하면 폴백 모드로 전환
    if (state.reconnectAttempts >= 5) {
      console.log('최대 재연결 시도 횟수에 도달했습니다. 폴백 모드로 전환');
      setState(prev => ({ 
        ...prev, 
        connectionStatus: 'connected',
        isConnected: true // 폴백 모드에서도 연결된 것으로 표시
      }));
      showInfo('실시간 연결에 실패했지만 폴백 모드로 작동 중입니다.');
      return;
    }

    console.log('WebSocket 연결 시도 중...');
    console.log('환경 변수 확인:', {
      REACT_APP_WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL,
      NODE_ENV: process.env.NODE_ENV
    });

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }));

    try {
      // 환경 변수가 로드되지 않은 경우 기본값 사용
      const wsUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
      console.log('사용할 WebSocket URL:', wsUrl);
      
      await webSocketService.connect(wsUrl);
      
      // 연결 성공 여부 확인
      if (webSocketService.isConnectedState()) {
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          connectionStatus: 'connected',
          reconnectAttempts: 0
        }));
        
        showSuccess('실시간 연결이 설정되었습니다.');
      } else {
        // WebSocket 연결 실패했지만 폴백 모드로 작동 중
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'connected',
          reconnectAttempts: 0,
          isConnected: true // 폴백 모드에서도 연결된 것으로 표시
        }));
        
        showInfo('실시간 연결에 실패했지만 폴백 모드로 작동 중입니다.');
      }
    } catch (error) {
      console.error('WebSocket 연결 실패:', error);
      setState(prev => ({ 
        ...prev, 
        connectionStatus: 'error',
        isConnected: false
      }));
      
      showError('실시간 연결에 실패했습니다.', '폴백 모드로 전환됩니다.');
      
      // 재연결 시도 (지수 백오프)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      const retryDelay = Math.min(5000 * Math.pow(2, state.reconnectAttempts || 0), 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, reconnectAttempts: (prev.reconnectAttempts || 0) + 1 }));
        connectWebSocket();
      }, retryDelay);
    }
  }, [state.connectionStatus, state.isConnected, state.reconnectAttempts, showSuccess, showError, showInfo]);

  // WebSocket 연결 해제
  const disconnectWebSocket = useCallback(() => {
    console.log('RealTimeContext: WebSocket 연결 해제 시작');
    
    try {
      // WebSocket 서비스 연결 해제
      webSocketService.disconnect();
      
      // 상태 초기화
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'disconnected',
        reconnectAttempts: 0
      }));
      
      console.log('RealTimeContext: WebSocket 연결 해제 완료');
    } catch (error) {
      console.error('RealTimeContext: WebSocket 연결 해제 중 오류:', error);
      // 오류가 발생해도 상태는 초기화
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'error',
        reconnectAttempts: 0
      }));
    }
  }, []);

  // 가격 데이터 업데이트 (throttled)
  const updatePriceData = useCallback(
    throttle((priceData: PriceData) => {
      setState(prev => {
        const newPriceData = new Map(prev.priceData);
        newPriceData.set(priceData.propertyId, priceData);
        
        // 캐시에 저장
        cacheService.set(`price_${priceData.propertyId}`, priceData, 30000); // 30초
        
        return {
          ...prev,
          priceData: newPriceData,
          lastUpdate: new Date(),
        };
      });
    }, 1000), // 1초마다 업데이트
    []
  );

  // 포트폴리오 데이터 업데이트 (debounced)
  const updatePortfolioData = useCallback(
    debounce((portfolioData: PortfolioUpdate) => {
      setState(prev => {
        // 캐시에 저장
        cacheService.set('portfolio_data', portfolioData, 60000); // 1분
        
        return {
          ...prev,
          portfolioData,
          lastUpdate: new Date(),
        };
      });
    }, 2000), // 2초 지연
    []
  );

  // 거래 데이터 업데이트
  const updateTransactionData = useCallback((transaction: TransactionUpdate) => {
    setState(prev => {
      const newTransactions = [transaction, ...prev.recentTransactions.slice(0, 9)];
      
      // 캐시에 저장
      cacheService.set('recent_transactions', newTransactions, 300000); // 5분
      
      return {
        ...prev,
        recentTransactions: newTransactions,
        lastUpdate: new Date(),
      };
    });
  }, []);

  // WebSocket 이벤트 구독 - 메모이제이션된 함수들 사용
  useEffect(() => {
    if (!state.isConnected) return;

    const unsubscribePrice = webSocketService.subscribe('price_update', updatePriceData);
    const unsubscribePortfolio = webSocketService.subscribe('portfolio_update', updatePortfolioData);
    const unsubscribeTransaction = webSocketService.subscribe('transaction_update', updateTransactionData);

    return () => {
      unsubscribePrice();
      unsubscribePortfolio();
      unsubscribeTransaction();
    };
  }, [state.isConnected]); // updatePriceData, updatePortfolioData, updateTransactionData는 이미 useCallback으로 메모이제이션됨

  // 지갑 연결 상태에 따른 WebSocket 연결 관리
  useEffect(() => {
    const connectIfNeeded = async () => {
      if (web3State.isConnected && web3State.account) {
        // 지갑이 연결되어 있고 계정이 있을 때만 WebSocket 연결
        console.log('지갑 연결됨, WebSocket 연결 시도:', web3State.account);
        try {
          await connectWebSocket();
          // 연결 성공 후 구독 설정 (폴백 모드에서도 작동)
          setTimeout(() => {
            if (state.isConnected && web3State.account) {
              console.log('연결 후 구독 설정');
              webSocketService.subscribeToPortfolioUpdates(web3State.account);
              webSocketService.subscribeToTransactionUpdates(web3State.account);
            }
          }, 1000); // 연결 후 1초 대기 후 구독
        } catch (error) {
          console.error('WebSocket 연결 실패:', error);
          // 연결 실패 시에도 폴백 모드로 구독 시도
          if (web3State.account) {
            console.log('폴백 모드에서 구독 시도');
            webSocketService.subscribeToPortfolioUpdates(web3State.account);
            webSocketService.subscribeToTransactionUpdates(web3State.account);
          }
        }
      } else {
        // 지갑이 연결되지 않았으면 WebSocket 연결 해제
        console.log('지갑 연결 해제됨, WebSocket 연결 해제');
        disconnectWebSocket();
      }
    };

    connectIfNeeded();

    return () => {
      disconnectWebSocket();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [web3State.isConnected, web3State.account]); // connectWebSocket, disconnectWebSocket, state.isConnected는 이미 useCallback으로 메모이제이션됨

  // 캐시된 데이터 복원
  useEffect(() => {
    if (web3State.isConnected) {
      // 포트폴리오 데이터 복원
      const cachedPortfolio = cacheService.get<PortfolioUpdate>('portfolio_data');
      if (cachedPortfolio) {
        setState(prev => ({ ...prev, portfolioData: cachedPortfolio }));
      }

      // 최근 거래 내역 복원
      const cachedTransactions = cacheService.get<TransactionUpdate[]>('recent_transactions');
      if (cachedTransactions) {
        setState(prev => ({ ...prev, recentTransactions: cachedTransactions }));
      }

      // 가격 데이터 복원
      const cachedPrices = new Map<string, PriceData>();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_price_')) {
          const priceData = cacheService.get<PriceData>(key.replace('cache_', ''));
          if (priceData) {
            cachedPrices.set(priceData.propertyId, priceData);
          }
        }
      }
      if (cachedPrices.size > 0) {
        setState(prev => ({ ...prev, priceData: cachedPrices }));
      }
    }
  }, [web3State.isConnected]);

  // 네트워크 상태 모니터링
  useEffect(() => {
    const handleOnline = () => {
      showInfo('네트워크 연결이 복구되었습니다.');
      if (web3State.isConnected) {
        connectWebSocket();
      }
    };

    const handleOffline = () => {
      showInfo('오프라인 모드로 전환되었습니다. 캐시된 데이터를 사용합니다.');
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [web3State.isConnected]); // connectWebSocket, showInfo는 이미 useCallback으로 메모이제이션됨

  // 가격 구독 함수
  const subscribeToPrices = useCallback((propertyIds: string[]) => {
    if (state.isConnected && propertyIds.length > 0) {
      console.log('가격 구독 요청:', propertyIds);
      
      // 구독 통계 확인
      const stats = webSocketService.getSubscriptionStats();
      console.log('현재 구독 상태:', stats);
      
      webSocketService.subscribeToPriceUpdates(propertyIds);
    } else {
      console.log('가격 구독 건너뜀 - 연결되지 않음 또는 빈 propertyIds');
    }
  }, [state.isConnected]);

  // 포트폴리오 구독 함수
  const subscribeToPortfolio = useCallback(() => {
    if (state.isConnected && web3State.account) {
      console.log('포트폴리오 구독 요청:', web3State.account);
      
      // 구독 통계 확인
      const stats = webSocketService.getSubscriptionStats();
      console.log('현재 구독 상태:', stats);
      
      webSocketService.subscribeToPortfolioUpdates(web3State.account);
    } else {
      console.log('포트폴리오 구독 건너뜀 - 연결되지 않음 또는 계정 없음');
    }
  }, [state.isConnected, web3State.account]);

  // 거래 구독 함수
  const subscribeToTransactions = useCallback(() => {
    if (state.isConnected && web3State.account) {
      console.log('거래 구독 요청:', web3State.account);
      
      // 구독 통계 확인
      const stats = webSocketService.getSubscriptionStats();
      console.log('현재 구독 상태:', stats);
      
      webSocketService.subscribeToTransactionUpdates(web3State.account);
    } else {
      console.log('거래 구독 건너뜀 - 연결되지 않음 또는 계정 없음');
    }
  }, [state.isConnected, web3State.account]);

  // 구독 해제 함수들
  const unsubscribeFromPrices = useCallback((propertyIds: string[]) => {
    if (propertyIds.length > 0) {
      console.log('가격 구독 해제:', propertyIds);
      webSocketService.unsubscribeFromPriceUpdates(propertyIds);
    }
  }, []);

  const unsubscribeFromPortfolio = useCallback(() => {
    if (web3State.account) {
      console.log('포트폴리오 구독 해제:', web3State.account);
      webSocketService.unsubscribeFromPortfolioUpdates(web3State.account);
    }
  }, [web3State.account]);

  const unsubscribeFromTransactions = useCallback(() => {
    if (web3State.account) {
      console.log('거래 구독 해제:', web3State.account);
      webSocketService.unsubscribeFromTransactionUpdates(web3State.account);
    }
  }, [web3State.account]);

  // 데이터 새로고침
  const refreshData = useCallback(() => {
    if (state.isConnected) {
      subscribeToPortfolio();
      subscribeToTransactions();
      showInfo('데이터를 새로고침했습니다.');
    }
  }, [state.isConnected, subscribeToPortfolio, subscribeToTransactions, showInfo]);

  // 캐시 정리
  const clearCache = useCallback(() => {
    cacheService.clear();
    setState(prev => ({
      ...prev,
      priceData: new Map(),
      portfolioData: null,
      recentTransactions: [],
    }));
    showInfo('캐시가 정리되었습니다.');
  }, [showInfo]);

  const contextValue: RealTimeContextType = {
    state,
    subscribeToPrices,
    subscribeToPortfolio,
    subscribeToTransactions,
    unsubscribeFromPrices,
    unsubscribeFromPortfolio,
    unsubscribeFromTransactions,
    refreshData,
    clearCache,
    getSubscriptionStats: webSocketService.getSubscriptionStats,
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
}; 