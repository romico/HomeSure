import { useToast } from '../components/common/ToastContainer';

export interface WebSocketMessage {
  type: 'price_update' | 'portfolio_update' | 'transaction_update' | 'notification' | 'pong' | 'subscribe_prices' | 'subscribe_portfolio' | 'subscribe_transactions';
  data: any;
  timestamp: number;
}

export interface PriceData {
  propertyId: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface PortfolioUpdate {
  totalValue: number;
  change: number;
  changePercent: number;
  assets: Array<{
    id: string;
    name: string;
    value: number;
    percentage: number;
  }>;
  timestamp: number;
}

export interface TransactionUpdate {
  id: string;
  type: 'buy' | 'sell' | 'transfer';
  amount: number;
  propertyId: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: WebSocketMessage[] = [];
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private showToast: any = null;
  private fallbackMode = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Toast 함수는 나중에 설정
  }

  setToastFunction(toastFunction: any) {
    this.showToast = toastFunction;
  }

  connect(url?: string): Promise<void> {
    const wsUrl = url || process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
    
    console.log('WebSocket 연결 시도:', wsUrl);
    console.log('환경 변수 REACT_APP_WEBSOCKET_URL:', process.env.REACT_APP_WEBSOCKET_URL);
    console.log('현재 환경:', process.env.NODE_ENV);
    
    return new Promise((resolve, reject) => {
      // WebSocket 지원 확인
      if (typeof WebSocket === 'undefined') {
        const error = new Error('WebSocket이 지원되지 않는 브라우저입니다.');
        console.error('WebSocket 지원 확인 실패:', error);
        reject(error);
        return;
      }
      try {
        // WebSocket 연결 전에 URL 유효성 검사
        if (!wsUrl || wsUrl === 'undefined') {
          const error = new Error('WebSocket URL이 설정되지 않았습니다.');
          console.error('WebSocket URL 오류:', error);
          reject(error);
          return;
        }
        
        // WebSocket 연결 생성
        console.log('WebSocket 연결 생성 중...');
        this.ws = new WebSocket(wsUrl);

        // 연결 타임아웃 설정
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.error('WebSocket 연결 타임아웃');
            this.ws.close();
            
            // 타임아웃 시 HTTP 폴링 모드로 전환
            console.warn('WebSocket 연결 타임아웃, HTTP 폴링 모드로 전환');
            this.startPolling();
            resolve();
          }
        }, 10000); // 10초 타임아웃

        this.ws.onopen = () => {
          console.log('WebSocket 연결됨:', wsUrl);
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('WebSocket 메시지 파싱 오류:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket 연결 종료:', event.code, event.reason);
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          this.stopHeartbeat();
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 오류:', error);
          console.error('WebSocket URL:', wsUrl);
          console.error('WebSocket 상태:', this.ws?.readyState);
          console.error('브라우저 정보:', {
            userAgent: navigator.userAgent,
            location: window.location.href,
            protocol: window.location.protocol
          });
          clearTimeout(connectionTimeout);
          
          // WebSocket 연결 실패 시 HTTP 폴링 모드로 전환
          console.warn('WebSocket 연결 실패, HTTP 폴링 모드로 전환');
          this.startPolling();
          
          // 오류를 reject하지 않고 resolve (폴링 모드로 계속 진행)
          resolve();
        };

      } catch (error) {
        console.error('WebSocket 연결 실패:', error);
        reject(error);
      }
    });
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`${delay}ms 후 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000); // 30초마다 heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(message: WebSocketMessage) {
    // 메시지 타입별 처리
    switch (message.type) {
      case 'price_update':
        this.notifyListeners('price_update', message.data);
        break;
      case 'portfolio_update':
        this.notifyListeners('portfolio_update', message.data);
        break;
      case 'transaction_update':
        this.notifyListeners('transaction_update', message.data);
        if (this.showToast) {
          this.showToast.showInfo('새로운 거래가 완료되었습니다.');
        }
        break;
      case 'notification':
        this.notifyListeners('notification', message.data);
        if (this.showToast) {
          this.showToast.showInfo(message.data.message);
        }
        break;
      case 'pong':
        // Heartbeat 응답
        break;
      default:
        console.warn('알 수 없는 메시지 타입:', message.type);
    }
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      // 연결이 끊어진 경우 메시지를 큐에 저장
      this.messageQueue.push(message);
      return false;
    }
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // 구독 해제 함수 반환
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  private notifyListeners(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('WebSocket 리스너 오류:', error);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, '사용자 요청');
      this.ws = null;
    }
    this.stopHeartbeat();
    this.stopPolling();
    this.isConnected = false;
    this.fallbackMode = false;
    this.listeners.clear();
    this.messageQueue = [];
  }

  private startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.fallbackMode = true;
    console.log('HTTP 폴링 모드로 전환');
    
    this.pollingInterval = setInterval(async () => {
      try {
        // WebSocket 통계 확인
        const response = await fetch('http://localhost:3001/api/websocket/stats');
        const stats = await response.json();
        
        // 가격 데이터 시뮬레이션
        if (stats.enabled) {
          this.simulatePriceUpdates();
        }
      } catch (error) {
        console.warn('HTTP 폴링 오류:', error);
      }
    }, 5000); // 5초마다 폴링
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private simulatePriceUpdates() {
    // 가격 업데이트 시뮬레이션
    const mockPriceData: WebSocketMessage = {
      type: 'price_update',
      data: {
        propertyId: '1',
        price: Math.random() * 1000000 + 500000,
        change: (Math.random() - 0.5) * 10000,
        changePercent: (Math.random() - 0.5) * 2,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
    
    this.handleMessage(mockPriceData);
  }

  isConnectedState(): boolean {
    return (this.isConnected && this.ws?.readyState === WebSocket.OPEN) || this.fallbackMode;
  }

  // 특정 부동산 가격 업데이트 요청
  subscribeToPriceUpdates(propertyIds: string[]) {
    this.send({
      type: 'subscribe_prices',
      data: { propertyIds },
      timestamp: Date.now()
    });
  }

  // 포트폴리오 업데이트 요청
  subscribeToPortfolioUpdates(userId: string) {
    this.send({
      type: 'subscribe_portfolio',
      data: { userId },
      timestamp: Date.now()
    });
  }

  // 거래 업데이트 요청
  subscribeToTransactionUpdates(userId: string) {
    this.send({
      type: 'subscribe_transactions',
      data: { userId },
      timestamp: Date.now()
    });
  }
}

// 싱글톤 인스턴스
const webSocketService = new WebSocketService();

export default webSocketService; 