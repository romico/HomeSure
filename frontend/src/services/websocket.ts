// WebSocket 서비스 클래스
export interface WebSocketMessage {
  type:
    | 'price_update'
    | 'portfolio_update'
    | 'transaction_update'
    | 'notification'
    | 'pong'
    | 'subscribe_prices'
    | 'subscribe_portfolio'
    | 'subscribe_transactions'
    | 'unsubscribe_prices'
    | 'unsubscribe_portfolio'
    | 'unsubscribe_transactions'
    | 'client_identification'
    | 'client_identified'
    | 'connection_established'
    | 'error';
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
  private maxQueueSize = 50; // 메시지 큐 최대 크기 제한
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private showToast: any = null;
  private fallbackMode = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null; // 연결 중복 방지
  private subscriptions: Set<string> = new Set(); // 구독 추적
  private maxSubscriptions = 100; // 최대 구독 수 제한
  private clientId: string; // 고정 클라이언트 ID
  private lastConnectionTime: number = 0; // 마지막 연결 시간
  private connectionReuseThreshold = 30000; // 30초 내 재연결 시 기존 연결 재사용

  constructor() {
    // 고정 클라이언트 ID 생성 (브라우저 세션 동안 유지)
    this.clientId = this.generateClientId();
    console.log('WebSocket 클라이언트 ID 생성:', this.clientId);
  }

  setToastFunction(toastFunction: any) {
    this.showToast = toastFunction;
  }

  connect(url?: string): Promise<void> {
    // 이미 연결 중이면 기존 Promise 반환
    if (this.connectionPromise) {
      console.log('이미 연결 중입니다. 기존 연결을 기다립니다.');
      return this.connectionPromise;
    }

    // 기존 연결이 있고 30초 내에 재연결 시도하는 경우 기존 연결 재사용
    const now = Date.now();
    if (
      this.ws &&
      this.isConnected &&
      now - this.lastConnectionTime < this.connectionReuseThreshold
    ) {
      console.log('기존 WebSocket 연결을 재사용합니다. 클라이언트 ID:', this.clientId);
      return Promise.resolve();
    }

    const wsUrl = url || process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';

    console.log('WebSocket 연결 시도:', wsUrl);
    console.log('클라이언트 ID:', this.clientId);
    console.log('환경 변수 REACT_APP_WEBSOCKET_URL:', process.env.REACT_APP_WEBSOCKET_URL);
    console.log('현재 환경:', process.env.NODE_ENV);

    this.connectionPromise = new Promise((resolve, reject) => {
      // WebSocket 지원 확인
      if (typeof WebSocket === 'undefined') {
        const error = new Error('WebSocket이 지원되지 않는 브라우저입니다.');
        console.error('WebSocket 지원 확인 실패:', error);
        this.connectionPromise = null;
        reject(error);
        return;
      }

      // 기존 연결이 있으면 정리
      if (this.ws) {
        console.log('기존 WebSocket 연결 정리 중...');
        try {
          // WebSocket 상태 확인 후 안전하게 종료
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, '새로운 연결을 위해 정리');
          } else if (this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close(1000, '연결 취소');
          } else {
            console.log('기존 WebSocket이 이미 종료된 상태입니다.');
          }
        } catch (error) {
          console.error('기존 WebSocket 정리 중 오류:', error);
        } finally {
          this.ws = null;
          this.isConnected = false;
        }
      }

      try {
        // WebSocket 연결 전에 URL 유효성 검사
        if (!wsUrl || wsUrl === 'undefined') {
          const error = new Error('WebSocket URL이 설정되지 않았습니다.');
          console.error('WebSocket URL 오류:', error);
          this.connectionPromise = null;
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
            try {
              this.ws.close(1000, 'Connection timeout');
            } catch (error) {
              console.error('타임아웃 시 WebSocket 종료 중 오류:', error);
            }
            this.ws = null;
            this.connectionPromise = null;

            // 타임아웃 시 HTTP 폴링 모드로 전환
            console.warn('WebSocket 연결 타임아웃, HTTP 폴링 모드로 전환');
            this.startPolling();
            resolve();
          }
        }, 5000); // 5초 타임아웃으로 단축

        this.ws.onopen = () => {
          console.log('WebSocket 연결됨:', wsUrl);
          console.log('클라이언트 ID:', this.clientId);
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.lastConnectionTime = Date.now();
          this.reconnectAttempts = 0;
          this.stopPolling(); // 폴링 모드 중지
          this.startHeartbeat();
          this.processMessageQueue();
          this.connectionPromise = null;

          // 클라이언트 ID를 서버에 전송
          this.send({
            type: 'client_identification',
            data: { clientId: this.clientId },
            timestamp: Date.now(),
          });

          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('WebSocket 메시지 파싱 오류:', error);
          }
        };

        this.ws.onclose = event => {
          console.log('WebSocket 연결 종료:', event.code, event.reason);
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          this.stopHeartbeat();
          this.connectionPromise = null;

          // 연결이 정상적으로 종료되지 않은 경우에만 재연결 시도
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`재연결 시도 ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
            this.scheduleReconnect();
          } else if (event.wasClean) {
            console.log('WebSocket 연결이 정상적으로 종료되었습니다.');
          } else {
            console.log('최대 재연결 시도 횟수에 도달했습니다. HTTP 폴링 모드로 전환');
            this.startPolling();
          }
        };

        this.ws.onerror = error => {
          console.error('WebSocket 오류:', error);
          console.error('WebSocket URL:', wsUrl);
          console.error('WebSocket 상태:', this.ws?.readyState);
          console.error('브라우저 정보:', {
            userAgent: navigator.userAgent,
            location: window.location.href,
            protocol: window.location.protocol,
          });
          clearTimeout(connectionTimeout);
          this.connectionPromise = null;

          // WebSocket 연결 실패 시 즉시 폴백 모드로 전환하고 재연결 중지
          console.warn('WebSocket 연결 실패, HTTP 폴링 모드로 전환하고 재연결 중지');
          this.reconnectAttempts = this.maxReconnectAttempts; // 재연결 시도 중지
          this.startPolling();

          // 오류를 reject하지 않고 resolve (폴백 모드로 계속 진행)
          resolve();
        };
      } catch (error) {
        console.error('WebSocket 연결 실패:', error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`${delay}ms 후 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    // 최대 재연결 시도 횟수에 도달하면 폴백 모드로 전환
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('최대 재연결 시도 횟수에 도달했습니다. HTTP 폴링 모드로 전환');
      this.startPolling();
      return;
    }

    setTimeout(() => {
      // 재연결 시도 전에 현재 상태 확인
      if (this.isConnected || this.ws?.readyState === WebSocket.OPEN) {
        console.log('이미 연결되어 있습니다. 재연결을 건너뜁니다.');
        return;
      }

      // 재연결 시도
      this.connect().catch(error => {
        console.error('재연결 실패:', error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('최대 재연결 시도 횟수에 도달했습니다. HTTP 폴링 모드로 전환');
          this.startPolling();
        }
      });
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
    console.log('WebSocket 메시지 수신:', message.type, message.data);

    switch (message.type) {
      case 'client_identified':
        console.log('클라이언트 ID 확인됨:', {
          serverClientId: message.data.serverClientId,
          customClientId: message.data.customClientId,
        });
        break;

      case 'connection_established':
        console.log('WebSocket 연결 확인됨:', message.data);
        break;

      case 'price_update':
        this.notifyListeners('price_update', message.data);
        break;

      case 'portfolio_update':
        this.notifyListeners('portfolio_update', message.data);
        break;

      case 'transaction_update':
        this.notifyListeners('transaction_update', message.data);
        break;

      case 'notification':
        this.notifyListeners('notification', message.data);
        if (this.showToast) {
          this.showToast(message.data.message || '새로운 알림이 있습니다.', 'info');
        }
        break;

      case 'pong':
        console.log('Heartbeat 응답 수신');
        break;

      case 'error':
        console.error('WebSocket 서버 오류:', message.data);
        if (this.showToast) {
          this.showToast(`서버 오류: ${message.data.message}`, 'error');
        }
        break;

      default:
        console.warn('알 수 없는 WebSocket 메시지 타입:', message.type);
    }
  }

  private processMessageQueue() {
    if (this.messageQueue.length === 0 || !this.isConnected) return;

    const messagesToProcess = this.messageQueue.splice(0, Math.min(10, this.messageQueue.length));

    messagesToProcess.forEach(message => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message));
        } else {
          // 연결이 끊어진 경우 메시지를 다시 큐에 추가
          this.messageQueue.unshift(message);
          if (this.messageQueue.length > this.maxQueueSize) {
            this.messageQueue.pop(); // 가장 오래된 메시지 제거
          }
        }
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        // 전송 실패 시 메시지를 다시 큐에 추가
        this.messageQueue.unshift(message);
        if (this.messageQueue.length > this.maxQueueSize) {
          this.messageQueue.pop();
        }
      }
    });

    // 큐에 남은 메시지가 있으면 다음 틱에서 처리
    if (this.messageQueue.length > 0) {
      setTimeout(() => this.processMessageQueue(), 0);
    }
  }

  send(message: WebSocketMessage): boolean {
    // 메시지 큐 크기 제한 확인
    if (this.messageQueue.length >= this.maxQueueSize) {
      console.warn('메시지 큐가 가득 찼습니다. 가장 오래된 메시지를 제거합니다.');
      this.messageQueue.shift(); // 가장 오래된 메시지 제거
    }

    // 중복 메시지 방지 (타입과 데이터가 동일한 메시지는 제외)
    const isDuplicate = this.messageQueue.some(
      queuedMessage =>
        queuedMessage.type === message.type &&
        JSON.stringify(queuedMessage.data) === JSON.stringify(message.data)
    );

    if (isDuplicate) {
      console.log('중복 메시지 감지, 큐에 추가하지 않음:', message.type);
      return false;
    }

    // 메시지를 큐에 추가
    this.messageQueue.push(message);

    // 연결된 상태에서만 즉시 처리 시도
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      setTimeout(() => this.processMessageQueue(), 0);
    }

    return true;
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

  disconnect(): void {
    console.log('WebSocket 연결 해제 시작');

    // 재연결 타이머 정리
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // 폴링 타이머 정리
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // 메시지 큐 정리
    this.messageQueue = [];

    // 연결 Promise 정리
    this.connectionPromise = null;

    // 구독 정보 정리
    this.clearSubscriptions();

    // WebSocket 연결 해제
    if (this.ws) {
      try {
        // WebSocket 상태 확인 후 안전하게 종료
        if (this.ws.readyState === WebSocket.OPEN) {
          // 정상 종료 코드 1000 사용
          this.ws.close(1000, 'Normal closure');
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          // 연결 중인 경우 강제 종료
          this.ws.close(1000, 'Connection cancelled');
        } else {
          // 이미 종료된 상태
          console.log('WebSocket이 이미 종료된 상태입니다.');
        }
      } catch (error) {
        console.error('WebSocket 종료 중 오류:', error);
        // 오류가 발생해도 WebSocket 참조는 정리
      } finally {
        // WebSocket 이벤트 리스너 제거
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws = null;
      }
    }

    // 상태 초기화
    this.isConnected = false;
    this.fallbackMode = false;
    this.reconnectAttempts = 0;

    console.log('WebSocket 연결 해제 완료');
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
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const stats = await response.json();

        // 가격 데이터 시뮬레이션
        if (stats.enabled) {
          this.simulatePriceUpdates();
        }
      } catch (error) {
        console.warn('HTTP 폴링 오류:', error);
        // 폴링 실패 시에도 기본 데이터 시뮬레이션
        this.simulatePriceUpdates();
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
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.handleMessage(mockPriceData);
  }

  isConnectedState(): boolean {
    const wsConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
    const fallbackActive = this.fallbackMode;

    console.log('WebSocket 연결 상태 확인:', {
      wsConnected,
      fallbackActive,
      readyState: this.ws?.readyState,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    });

    // WebSocket이 연결되어 있거나 폴백 모드가 활성화되어 있으면 연결된 것으로 간주
    return wsConnected || fallbackActive;
  }

  // 특정 부동산 가격 업데이트 요청
  subscribeToPriceUpdates(propertyIds: string[]) {
    if (propertyIds.length === 0) {
      console.warn('빈 propertyIds로 가격 구독 요청됨');
      return;
    }

    // 구독 제한 확인
    const availableSlots = this.maxSubscriptions - this.subscriptions.size;
    if (availableSlots < propertyIds.length) {
      console.warn(
        `구독 제한으로 인해 일부 propertyIds만 구독합니다. (가능: ${availableSlots}, 요청: ${propertyIds.length})`
      );
      propertyIds = propertyIds.slice(0, availableSlots);
    }

    console.log('가격 구독 요청:', propertyIds);

    propertyIds.forEach(propertyId => {
      if (this.addSubscription('price', propertyId)) {
        this.send({
          type: 'subscribe_prices',
          data: { propertyIds: [propertyId] },
          timestamp: Date.now(),
        });
      }
    });
  }

  // 포트폴리오 업데이트 요청
  subscribeToPortfolioUpdates(userId: string) {
    if (!userId) {
      console.warn('빈 userId로 포트폴리오 구독 요청됨');
      return;
    }

    if (this.addSubscription('portfolio', userId)) {
      console.log('포트폴리오 구독 요청:', userId);
      this.send({
        type: 'subscribe_portfolio',
        data: { userId },
        timestamp: Date.now(),
      });
    }
  }

  // 거래 업데이트 요청
  subscribeToTransactionUpdates(userId: string) {
    if (!userId) {
      console.warn('빈 userId로 거래 구독 요청됨');
      return;
    }

    if (this.addSubscription('transaction', userId)) {
      console.log('거래 구독 요청:', userId);
      this.send({
        type: 'subscribe_transactions',
        data: { userId },
        timestamp: Date.now(),
      });
    }
  }

  // 구독 해제 메서드들
  unsubscribeFromPriceUpdates(propertyIds: string[]) {
    propertyIds.forEach(propertyId => {
      this.removeSubscription('price', propertyId);
      this.send({
        type: 'unsubscribe_prices',
        data: { propertyIds: [propertyId] },
        timestamp: Date.now(),
      });
    });
  }

  unsubscribeFromPortfolioUpdates(userId: string) {
    if (this.removeSubscription('portfolio', userId)) {
      this.send({
        type: 'unsubscribe_portfolio',
        data: { userId },
        timestamp: Date.now(),
      });
    }
  }

  unsubscribeFromTransactionUpdates(userId: string) {
    if (this.removeSubscription('transaction', userId)) {
      this.send({
        type: 'unsubscribe_transactions',
        data: { userId },
        timestamp: Date.now(),
      });
    }
  }

  // 구독 관리 메서드들
  private addSubscription(type: string, id: string): boolean {
    const subscriptionKey = `${type}:${id}`;

    if (this.subscriptions.size >= this.maxSubscriptions) {
      console.warn(
        `최대 구독 수(${this.maxSubscriptions})에 도달했습니다. 구독을 건너뜁니다: ${subscriptionKey}`
      );
      return false;
    }

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`이미 구독 중입니다: ${subscriptionKey}`);
      return false;
    }

    this.subscriptions.add(subscriptionKey);
    console.log(
      `구독 추가: ${subscriptionKey} (총 ${this.subscriptions.size}/${this.maxSubscriptions})`
    );
    return true;
  }

  private removeSubscription(type: string, id: string): boolean {
    const subscriptionKey = `${type}:${id}`;
    const removed = this.subscriptions.delete(subscriptionKey);

    if (removed) {
      console.log(
        `구독 제거: ${subscriptionKey} (총 ${this.subscriptions.size}/${this.maxSubscriptions})`
      );
    }

    return removed;
  }

  private clearSubscriptions(): void {
    console.log(`모든 구독 정리: ${this.subscriptions.size}개 구독 제거`);
    this.subscriptions.clear();
  }

  // 구독 통계 반환
  getSubscriptionStats(): { total: number; max: number; subscriptions: string[] } {
    return {
      total: this.subscriptions.size,
      max: this.maxSubscriptions,
      subscriptions: Array.from(this.subscriptions),
    };
  }

  private generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }
}

// 싱글톤 인스턴스
const webSocketService = new WebSocketService();

export default webSocketService;
