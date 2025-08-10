# WebSocket 연결 오류 해결 가이드

이 문서는 HomeSure 프로젝트에서 발생하는 WebSocket 연결 오류를 해결하는 방법을 설명합니다.

## 🚨 일반적인 오류

### 1. "WebSocket is closed before the connection is established"

**증상:**

```
WebSocket connection to 'ws://localhost:3001/' failed: WebSocket is closed before the connection is established.
```

**원인:**

- 중복 연결 시도
- 서버 응답 지연
- 네트워크 불안정
- 브라우저 탭 전환/새로고침

**해결 방법:**

#### A. 클라이언트 측 개선사항

```typescript
// 기존 연결 정리 후 새 연결
if (this.ws) {
  this.ws.close(1000, '새로운 연결을 위해 정리');
  this.ws = null;
  this.isConnected = false;
}

// 연결 상태 확인
if (state.connectionStatus === 'connecting') {
  console.log('이미 연결 중입니다. 중복 연결을 건너뜁니다.');
  return;
}
```

#### B. 서버 상태 확인

```bash
# 서버 상태 확인
curl -H "Accept: application/json" http://localhost:3001/health

# WebSocket 통계 확인
curl -H "Accept: application/json" http://localhost:3001/api/websocket/stats
```

#### C. 브라우저 개발자 도구 확인

1. **Network 탭**에서 WebSocket 연결 상태 확인
2. **Console 탭**에서 오류 메시지 확인
3. **Application 탭**에서 WebSocket 연결 상태 확인

### 2. "WebSocket connection failed"

**증상:**

```
WebSocket connection to 'ws://localhost:3001/' failed
```

**원인:**

- 서버가 실행되지 않음
- 포트 충돌
- CORS 설정 오류
- 방화벽 차단

**해결 방법:**

#### A. 서버 실행 확인

```bash
# 백엔드 서버 시작
cd backend && npm start

# 또는 전체 프로젝트 시작
./scripts/start-project.sh
```

#### B. 포트 확인

```bash
# 포트 사용 확인
lsof -i :3001

# 포트 충돌 해결
pkill -f "node.*3001"
```

#### C. CORS 설정 확인

```javascript
// backend/src/server.js
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
```

### 3. "Connection timeout"

**증상:**

```
WebSocket connection timeout
```

**원인:**

- 서버 응답 지연
- 네트워크 지연
- 서버 과부하

**해결 방법:**

#### A. 타임아웃 설정 조정

```typescript
// frontend/src/services/websocket.ts
const connectionTimeout = setTimeout(() => {
  if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
    console.error('WebSocket 연결 타임아웃');
    this.ws.close();
    this.ws = null;
    this.startPolling(); // 폴백 모드로 전환
  }
}, 15000); // 15초로 증가
```

#### B. 서버 성능 확인

```bash
# 서버 로그 확인
tail -f logs/backend.log

# 메모리 사용량 확인
ps aux | grep node
```

### 4. 메시지 큐 과부하 및 앱 다운

**증상:**

```
- 구독 포트폴리오
- 구독 트랜젝션
- 메시지 큐가 계속 쌓임
- 브라우저 탭이 느려지거나 다운됨
```

**원인:**

- 중복 구독 요청
- 연결 지연으로 인한 메시지 큐 누적
- 메모리 누수
- 무한 재연결 루프

**해결 방법:**

#### A. 메시지 큐 크기 제한

```typescript
class WebSocketService {
  private maxQueueSize = 50; // 메시지 큐 최대 크기 제한

  send(message: WebSocketMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 연결된 경우 즉시 전송
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      // 연결이 끊어진 경우 메시지를 큐에 저장
      if (this.messageQueue.length >= this.maxQueueSize) {
        console.warn(
          `메시지 큐가 가득 찼습니다 (${this.maxQueueSize}). 오래된 메시지를 제거합니다.`
        );
        this.messageQueue.shift(); // 가장 오래된 메시지 제거
      }

      // 중복 메시지 방지
      const isDuplicate = this.messageQueue.some(
        queuedMessage => queuedMessage.type === message.type
      );

      if (!isDuplicate) {
        this.messageQueue.push(message);
      }

      return false;
    }
  }
}
```

#### B. 중복 구독 방지

```typescript
// RealTimeContext.tsx
const subscribeToPortfolio = useCallback(() => {
  if (state.isConnected && web3State.account) {
    console.log('포트폴리오 구독 요청:', web3State.account);
    webSocketService.subscribeToPortfolioUpdates(web3State.account);
  } else {
    console.log('포트폴리오 구독 건너뜀 - 연결되지 않음 또는 계정 없음');
  }
}, [state.isConnected, web3State.account]);

// Portfolio.tsx
useEffect(() => {
  if (web3State.isConnected && web3State.account && realTimeState.isConnected) {
    console.log('포트폴리오 컴포넌트: 실시간 구독 설정');
    // 구독 전에 약간의 지연을 두어 연결이 안정화되도록 함
    const subscriptionTimer = setTimeout(() => {
      subscribeToPortfolio();
      subscribeToTransactions();
    }, 500);

    return () => {
      clearTimeout(subscriptionTimer);
    };
  }
}, [web3State.isConnected, web3State.account, realTimeState.isConnected]);
```

#### C. 연결 중복 방지

```typescript
class WebSocketService {
  private connectionPromise: Promise<void> | null = null;

  connect(url?: string): Promise<void> {
    // 이미 연결 중이면 기존 Promise 반환
    if (this.connectionPromise) {
      console.log('이미 연결 중입니다. 기존 연결을 기다립니다.');
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // 연결 로직...
    });

    return this.connectionPromise;
  }
}
```

#### D. 메모리 누수 방지

```typescript
disconnect() {
  console.log('WebSocket 연결 해제 중...');

  // 재연결 시도 중지
  this.reconnectAttempts = this.maxReconnectAttempts;

  // 연결 Promise 정리
  this.connectionPromise = null;

  if (this.ws) {
    this.ws.close(1000, '사용자 요청');
    this.ws = null;
  }

  this.stopHeartbeat();
  this.stopPolling();
  this.isConnected = false;
  this.fallbackMode = false;

  // 메시지 큐 정리
  console.log(`메시지 큐 정리 (${this.messageQueue.length}개 메시지 제거)`);
  this.messageQueue = [];

  // 이벤트 리스너 정리
  this.listeners.clear();
}
```

### 5. Toast 무한 렌더링 및 WebSocket 연결 실패

**증상:**

```
Toast.tsx:28 Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.

websocket.ts:163 WebSocket 오류: Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}
websocket.ts:165 WebSocket 상태: 3
```

**원인:**

- Toast 컴포넌트의 useEffect에서 의존성 배열 문제로 인한 무한 렌더링
- WebSocket 연결 실패로 인한 반복적인 오류 발생
- 서버 연결 문제 또는 네트워크 이슈

**해결 방법:**

#### A. Toast 무한 렌더링 해결

```typescript
// Toast.tsx
const Toast: React.FC<ToastProps> = ({ id, type, title, message, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  }, [onClose, id]);

  useEffect(() => {
    // 애니메이션을 위한 지연
    const showTimer = setTimeout(() => setIsVisible(true), 100);

    // 자동 닫기
    const hideTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [handleClose, duration]); // 안정적인 의존성 배열
};
```

#### B. WebSocket 연결 실패 처리

```typescript
// websocket.ts
this.ws.onerror = error => {
  console.error('WebSocket 오류:', error);
  console.error('WebSocket URL:', wsUrl);
  console.error('WebSocket 상태:', this.ws?.readyState);

  clearTimeout(connectionTimeout);
  this.connectionPromise = null;

  // WebSocket 연결 실패 시 즉시 폴백 모드로 전환
  console.warn('WebSocket 연결 실패, HTTP 폴링 모드로 전환');
  this.startPolling();

  // 오류를 reject하지 않고 resolve (폴백 모드로 계속 진행)
  resolve();
};
```

#### C. 안전한 폴백 처리

```typescript
// RealTimeContext.tsx
const connectWebSocket = useCallback(async () => {
  try {
    await webSocketService.connect(wsUrl);

    // 연결 성공 여부 확인
    if (webSocketService.isConnectedState()) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        connectionStatus: 'connected',
        reconnectAttempts: 0,
      }));

      showSuccess('실시간 연결이 설정되었습니다.');
    } else {
      // WebSocket 연결 실패했지만 폴백 모드로 작동 중
      setState(prev => ({
        ...prev,
        connectionStatus: 'connected',
        reconnectAttempts: 0,
      }));

      showInfo('실시간 연결에 실패했지만 폴백 모드로 작동 중입니다.');
    }
  } catch (error) {
    console.error('WebSocket 연결 실패:', error);
    showError('실시간 연결에 실패했습니다.', '폴백 모드로 전환됩니다.');
  }
}, []);
```

#### D. 서버 상태 확인

```bash
# 백엔드 서버 상태 확인
curl -s -H "Accept: application/json" http://localhost:3001/health | jq .

# WebSocket 통계 확인
curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats | jq .

# 포트 사용 확인
lsof -i :3001
```

## 🔧 디버깅 방법

### 1. 브라우저 개발자 도구

#### Network 탭

1. **WS** 필터 적용
2. WebSocket 연결 상태 확인
3. 메시지 전송/수신 확인

#### Console 탭

```javascript
// WebSocket 상태 확인
console.log('WebSocket 상태:', webSocketService.isConnectedState());
console.log('WebSocket 객체:', webSocketService.ws);
```

### 2. 서버 로그 확인

```bash
# 실시간 로그 확인
tail -f logs/backend.log | grep -i websocket

# WebSocket 통계 확인
curl -s http://localhost:3001/api/websocket/stats | jq .
```

### 3. wscat을 사용한 테스트

```bash
# 기본 연결 테스트
wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 3

# 대화형 테스트
wscat -c ws://localhost:3001 --show-ping-pong
```

## 🛠️ 예방 방법

### 1. 연결 상태 관리

```typescript
// 연결 전 상태 확인
if (state.connectionStatus === 'connecting') {
  return; // 중복 연결 방지
}

// 연결 해제 시 정리
disconnect() {
  this.reconnectAttempts = this.maxReconnectAttempts; // 재연결 중지
  if (this.ws) {
    this.ws.close(1000, '사용자 요청');
    this.ws = null;
  }
}
```

### 2. 폴백 메커니즘

```typescript
// WebSocket 실패 시 HTTP 폴링으로 전환
private startPolling() {
  this.fallbackMode = true;
  this.pollingInterval = setInterval(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/websocket/stats');
      const stats = await response.json();
      if (stats.enabled) {
        this.simulatePriceUpdates();
      }
    } catch (error) {
      console.warn('HTTP 폴링 오류:', error);
    }
  }, 5000);
}
```

### 3. 재연결 로직

```typescript
// 지수 백오프를 사용한 재연결
private scheduleReconnect() {
  this.reconnectAttempts++;
  const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

  setTimeout(() => {
    if (!this.isConnected) {
      this.connect().catch(error => {
        console.error('재연결 실패:', error);
      });
    }
  }, delay);
}
```

## 📋 체크리스트

### 연결 전 확인사항

- [ ] 백엔드 서버가 실행 중인가?
- [ ] 포트 3001이 사용 가능한가?
- [ ] CORS 설정이 올바른가?
- [ ] 환경 변수가 설정되었는가?

### 연결 중 확인사항

- [ ] 브라우저 콘솔에 오류가 있는가?
- [ ] Network 탭에서 WebSocket 연결이 보이는가?
- [ ] 서버 로그에 연결 요청이 기록되는가?

### 연결 후 확인사항

- [ ] WebSocket 상태가 'OPEN'인가?
- [ ] 메시지 전송/수신이 정상적인가?
- [ ] Heartbeat가 정상 작동하는가?

### 메시지 큐 관리 확인사항

- [ ] 메시지 큐 크기가 제한되어 있는가?
- [ ] 중복 메시지가 필터링되는가?
- [ ] 연결 해제 시 큐가 정리되는가?
- [ ] 메모리 누수가 발생하지 않는가?

## 🚀 성능 최적화

### 1. 연결 풀 관리

```typescript
// 연결 풀 크기 제한
private maxConnections = 5;
private activeConnections = 0;

connect() {
  if (this.activeConnections >= this.maxConnections) {
    console.warn('최대 연결 수에 도달했습니다.');
    return;
  }
  this.activeConnections++;
}
```

### 2. 메시지 큐 최적화

```typescript
// 메시지 큐 크기 제한
private maxQueueSize = 100;

send(message: WebSocketMessage): boolean {
  if (this.messageQueue.length >= this.maxQueueSize) {
    console.warn('메시지 큐가 가득 찼습니다. 오래된 메시지를 제거합니다.');
    this.messageQueue.shift();
  }
  this.messageQueue.push(message);
}
```

### 3. 메모리 누수 방지

```typescript
// 이벤트 리스너 정리
disconnect() {
  this.listeners.clear();
  this.messageQueue = [];
  this.stopHeartbeat();
  this.stopPolling();
}
```

## 📞 추가 지원

문제가 지속되는 경우:

1. **로그 수집**: 브라우저 콘솔 및 서버 로그
2. **환경 정보**: OS, 브라우저 버전, Node.js 버전
3. **재현 단계**: 오류 발생 과정 상세 설명
4. **네트워크 정보**: 방화벽, 프록시 설정 등

## 🔗 관련 문서

- [WebSocket 테스트 가이드](WEBSOCKET_TESTING.md)
- [환경 설정 가이드](ENVIRONMENT_SETUP.md)
- [API 문서](../backend/README.md)

### 6. 구독 제한 관리

**증상:**

```
- 구독이 계속 쌓여서 성능 저하
- 메모리 사용량 증가
- 중복 구독 요청
- 구독 수 제한 필요
```

**원인:**

- 구독 수 제한 없음
- 중복 구독 방지 로직 부재
- 구독 해제 로직 부재
- 구독 상태 추적 부족

**해결 방법:**

#### A. 구독 제한 설정

```typescript
class WebSocketService {
  private subscriptions: Set<string> = new Set(); // 구독 추적
  private maxSubscriptions = 100; // 최대 구독 수 제한

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
}
```

#### B. 구독 해제 메서드

```typescript
// 구독 해제 메서드들
unsubscribeFromPriceUpdates(propertyIds: string[]) {
  propertyIds.forEach(propertyId => {
    this.removeSubscription('price', propertyId);
    this.send({
      type: 'unsubscribe_prices',
      data: { propertyIds: [propertyId] },
      timestamp: Date.now()
    });
  });
}

unsubscribeFromPortfolioUpdates(userId: string) {
  if (this.removeSubscription('portfolio', userId)) {
    this.send({
      type: 'unsubscribe_portfolio',
      data: { userId },
      timestamp: Date.now()
    });
  }
}
```

#### C. 구독 통계 모니터링

```typescript
// 구독 통계 반환
getSubscriptionStats(): { total: number; max: number; subscriptions: string[] } {
  return {
    total: this.subscriptions.size,
    max: this.maxSubscriptions,
    subscriptions: Array.from(this.subscriptions)
  };
}

// 사용 예시
const stats = webSocketService.getSubscriptionStats();
console.log('현재 구독 상태:', stats);
```

#### D. 안전한 구독 요청

```typescript
// RealTimeContext.tsx
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
```

#### E. 구독 정리

```typescript
disconnect() {
  console.log('WebSocket 연결 해제 중...');

  // 재연결 시도 중지
  this.reconnectAttempts = this.maxReconnectAttempts;

  // 연결 Promise 정리
  this.connectionPromise = null;

  if (this.ws) {
    this.ws.close(1000, '사용자 요청');
    this.ws = null;
  }

  this.stopHeartbeat();
  this.stopPolling();
  this.isConnected = false;
  this.fallbackMode = false;

  // 메시지 큐 정리
  console.log(`메시지 큐 정리 (${this.messageQueue.length}개 메시지 제거)`);
  this.messageQueue = [];

  // 이벤트 리스너 정리
  this.listeners.clear();

  // 구독 정리
  this.clearSubscriptions();

  console.log('WebSocket 연결 해제 완료');
}
```

### 7. 무한 WebSocket 오류 반복

**증상:**

```
WebSocket 오류: Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}
WebSocket URL: ws://localhost:3001
WebSocket 상태: 3
```

- WebSocket 오류가 무한 반복됨
- 브라우저 콘솔이 오류 메시지로 가득 참
- 앱 성능 저하

**원인:**

- WebSocket 연결 실패 시 무한 재연결 시도
- 재연결 로직에서 최대 시도 횟수 제한 부재
- 폴백 모드 전환 로직 부재
- 연결 상태 관리 오류

**해결 방법:**

#### A. 무한 재연결 방지

```typescript
// websocket.ts
this.ws.onerror = error => {
  console.error('WebSocket 오류:', error);
  console.error('WebSocket URL:', wsUrl);
  console.error('WebSocket 상태:', this.ws?.readyState);

  clearTimeout(connectionTimeout);
  this.connectionPromise = null;

  // WebSocket 연결 실패 시 즉시 폴백 모드로 전환하고 재연결 중지
  console.warn('WebSocket 연결 실패, HTTP 폴링 모드로 전환하고 재연결 중지');
  this.reconnectAttempts = this.maxReconnectAttempts; // 재연결 시도 중지
  this.startPolling();

  // 오류를 reject하지 않고 resolve (폴백 모드로 계속 진행)
  resolve();
};
```

#### B. 재연결 로직 개선

```typescript
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
```

#### C. RealTimeContext에서 재연결 제한

```typescript
// RealTimeContext.tsx
const connectWebSocket = useCallback(async () => {
  // 최대 재연결 시도 횟수에 도달하면 폴백 모드로 전환
  if (state.reconnectAttempts >= 5) {
    console.log('최대 재연결 시도 횟수에 도달했습니다. 폴백 모드로 전환');
    setState(prev => ({
      ...prev,
      connectionStatus: 'connected',
      isConnected: true, // 폴백 모드에서도 연결된 것으로 표시
    }));
    showInfo('실시간 연결에 실패했지만 폴백 모드로 작동 중입니다.');
    return;
  }

  // ... 연결 로직
}, [state.connectionStatus, state.isConnected, state.reconnectAttempts]);
```

#### D. 폴백 모드 상태 관리

```typescript
isConnectedState(): boolean {
  const wsConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
  const fallbackActive = this.fallbackMode;

  console.log('WebSocket 연결 상태 확인:', {
    wsConnected,
    fallbackActive,
    readyState: this.ws?.readyState,
    isConnected: this.isConnected,
    reconnectAttempts: this.reconnectAttempts
  });

  // WebSocket이 연결되어 있거나 폴백 모드가 활성화되어 있으면 연결된 것으로 간주
  return wsConnected || fallbackActive;
}
```

#### E. 서버 상태 확인

```bash
# 백엔드 서버 상태 확인
curl -s -H "Accept: application/json" http://localhost:3001/health | jq .

# WebSocket 통계 확인
curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats | jq .

# WebSocket 연결 테스트
wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 3
```

#### F. 브라우저 캐시 정리

```javascript
// 브라우저 개발자 도구에서 실행
// 1. Application 탭 > Storage > Clear storage
// 2. Network 탭 > Disable cache 체크
// 3. 페이지 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)
```

#### G. WebSocket InvalidAccessError 해결

```typescript
// websocket.ts - 안전한 WebSocket 종료
disconnect(): void {
  console.log('WebSocket 연결 해제 시작');

  // 타이머 정리
  if (this.heartbeatInterval) {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  if (this.pollingInterval) {
    clearInterval(this.pollingInterval);
    this.pollingInterval = null;
  }

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
```

**WebSocket Close 코드 규칙:**

- **1000**: 정상 종료 (Normal closure)
- **1001**: 서버 종료 또는 브라우저 이동
- **1002**: 프로토콜 오류
- **1003**: 지원하지 않는 데이터 타입
- **1006**: 비정상 종료 (코드 없음)
- **3000-3999**: 예약됨
- **4000-4999**: 애플리케이션 정의

**올바른 사용법:**

```typescript
// ✅ 올바른 사용
ws.close(1000, 'Normal closure');
ws.close(1000, 'Connection cancelled');
ws.close(1000, 'Connection timeout');

// ❌ 잘못된 사용 (InvalidAccessError 발생)
ws.close(1001, 'Custom reason'); // 1001은 예약된 코드
ws.close(2000, 'Custom code'); // 2000-2999 범위는 사용 불가
```

#### H. WebSocket 연결 재사용 및 클라이언트 ID 관리

**증상:**

```
WebSocket 연결 타임아웃
WebSocket 오류: Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}
WebSocket URL: ws://localhost:3001
WebSocket 상태: undefined
```

- WebSocket 연결이 매번 새로 생성됨
- 클라이언트 ID가 매번 변경됨
- 연결 타임아웃 발생
- 불필요한 재연결 시도

**원인:**

- 클라이언트 ID가 매번 새로 생성됨
- 연결 재사용 로직 부재
- 연결 타임아웃이 너무 김
- 서버에서 클라이언트 식별 불가

**해결 방법:**

#### A. 고정 클라이언트 ID 구현

```typescript
// websocket.ts
class WebSocketService {
  private clientId: string; // 고정 클라이언트 ID
  private lastConnectionTime: number = 0; // 마지막 연결 시간
  private connectionReuseThreshold = 30000; // 30초 내 재연결 시 기존 연결 재사용

  constructor() {
    // 고정 클라이언트 ID 생성 (브라우저 세션 동안 유지)
    this.clientId = this.generateClientId();
    console.log('WebSocket 클라이언트 ID 생성:', this.clientId);
  }

  private generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }
}
```

#### B. 연결 재사용 로직

```typescript
connect(url?: string): Promise<void> {
  // 기존 연결이 있고 30초 내에 재연결 시도하는 경우 기존 연결 재사용
  const now = Date.now();
  if (this.ws && this.isConnected && (now - this.lastConnectionTime) < this.connectionReuseThreshold) {
    console.log('기존 WebSocket 연결을 재사용합니다. 클라이언트 ID:', this.clientId);
    return Promise.resolve();
  }

  // ... 연결 로직
}
```

#### C. 클라이언트 ID 서버 전송

```typescript
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
```

#### D. 서버에서 클라이언트 ID 처리

```javascript
// websocketService.js
handleMessage(clientId, message) {
  switch (message.type) {
    case 'client_identification':
      // 클라이언트가 전송한 고정 ID 저장
      const client = this.clients.get(clientId);
      if (client && message.data && message.data.clientId) {
        client.customClientId = message.data.clientId;
        logger.info(`Client ${clientId} identified as: ${message.data.clientId}`);

        // 클라이언트 ID 확인 응답
        this.sendToClient(clientId, {
          type: 'client_identified',
          data: {
            serverClientId: clientId,
            customClientId: message.data.clientId,
            timestamp: Date.now()
          }
        });
      }
      break;
    // ... 기타 메시지 처리
  }
}
```

#### E. 연결 타임아웃 최적화

```typescript
// 연결 타임아웃을 5초로 단축
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
```

#### F. 클라이언트 ID 확인 메시지 처리

```typescript
private handleMessage(message: WebSocketMessage) {
  console.log('WebSocket 메시지 수신:', message.type, message.data);

  switch (message.type) {
    case 'client_identified':
      console.log('클라이언트 ID 확인됨:', {
        serverClientId: message.data.serverClientId,
        customClientId: message.data.customClientId
      });
      break;

    case 'connection_established':
      console.log('WebSocket 연결 확인됨:', message.data);
      break;

    // ... 기타 메시지 처리
  }
}
```

#### G. WebSocketMessage 타입 확장

```typescript
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
```

**예상 결과:**

- ✅ **고정 클라이언트 ID**: 브라우저 세션 동안 동일한 클라이언트 ID 유지
- ✅ **연결 재사용**: 30초 내 재연결 시 기존 연결 재사용
- ✅ **빠른 연결**: 5초 타임아웃으로 빠른 연결/폴백 전환
- ✅ **서버 식별**: 서버에서 클라이언트를 고유하게 식별 가능
- ✅ **안정적인 연결**: 불필요한 재연결 시도 감소

#### I. WebSocket 성능 최적화

**증상:**

- WebSocket 응답이 느림
- 동시에 여러 요청 시 응답 못함
- 메시지 처리 지연
- 연결 타임아웃 발생

**원인:**

- 동기적 메시지 처리로 인한 블로킹
- 비효율적인 브로드캐스트 (모든 클라이언트 순회)
- 과도한 로깅으로 인한 성능 저하
- 메모리 누수 및 클라이언트 정리 부족
- 구독 인덱스 부재

**해결 방법:**

#### A. 비동기 메시지 처리

```javascript
// websocketService.js
ws.on('message', message => {
  // 클라이언트 활동 시간 업데이트
  const client = this.clients.get(clientId);
  if (client) {
    client.lastActivity = Date.now();
  }

  // 비동기로 메시지 처리
  setImmediate(() => {
    try {
      const parsedMessage = JSON.parse(message);
      this.handleMessage(clientId, parsedMessage);
    } catch (error) {
      logger.error('WebSocket message parsing error:', error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' },
      });
    }
  });
});
```

#### B. 구독 인덱스 최적화

```javascript
// 성능 최적화를 위한 인덱스
this.priceSubscribers = new Map(); // propertyId -> Set of clientIds
this.portfolioSubscribers = new Map(); // userId -> Set of clientIds
this.transactionSubscribers = new Map(); // userId -> Set of clientIds

// 구독 시 인덱스에 추가
subscribeToPrices(clientId, propertyIds) {
  const client = this.clients.get(clientId);
  if (!client) return;

  propertyIds.forEach(propertyId => {
    client.subscriptions.prices.add(propertyId);

    // 인덱스에 추가
    if (!this.priceSubscribers.has(propertyId)) {
      this.priceSubscribers.set(propertyId, new Set());
    }
    this.priceSubscribers.get(propertyId).add(clientId);
  });
}
```

#### C. 성능 최적화된 브로드캐스트

```javascript
// 성능 최적화된 브로드캐스트
broadcastToSubscribers(type, data) {
  let subscribers = null;

  switch (type) {
    case 'price_update':
      subscribers = this.priceSubscribers.get(data.propertyId);
      break;
    case 'portfolio_update':
      subscribers = this.portfolioSubscribers.get(data.userId);
      break;
    case 'transaction_update':
      subscribers = this.transactionSubscribers.get(data.userId);
      break;
    default:
      // 모든 클라이언트에게 전송
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(clientId, { type, data });
        }
      });
      return;
  }

  // 구독자들에게만 전송
  if (subscribers) {
    subscribers.forEach(clientId => {
      this.sendToClient(clientId, { type, data });
    });
  }
}
```

#### D. 클라이언트 정리 자동화

```javascript
// 클라이언트 정리 메서드
cleanupClient(clientId) {
  const client = this.clients.get(clientId);
  if (!client) return;

  // 구독 정보 정리
  this.removeClientFromAllSubscriptions(clientId, client.subscriptions);

  // 클라이언트 제거
  this.clients.delete(clientId);
}

// 정기 클린업 작업
startCleanupTask() {
  setInterval(() => {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5분

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > inactiveThreshold) {
        logger.info(`Cleaning up inactive client: ${clientId}`);
        this.cleanupClient(clientId);
      }
    }
  }, 60000); // 1분마다 실행
}
```

#### E. 과도한 로깅 제거

```javascript
handleMessage(clientId, message) {
  // 중요한 메시지만 로깅
  if (message.type !== 'ping' && message.type !== 'pong') {
    logger.debug(`Received message from client ${clientId}:`, message.type);
  }

  switch (message.type) {
    case 'client_identification':
      const client = this.clients.get(clientId);
      if (client && message.data && message.data.clientId) {
        client.customClientId = message.data.clientId;
        logger.debug(`Client ${clientId} identified as: ${message.data.clientId}`);
        // ... 처리 로직
      }
      break;
    // ... 기타 메시지 처리
  }
}
```

#### F. 프론트엔드 메시지 큐 최적화

```typescript
// 메시지 큐 처리 최적화
private processMessageQueue() {
  if (this.messageQueue.length === 0 || !this.isConnected) return;

  // 한 번에 여러 메시지 처리
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
      // 전송 실패한 메시지를 다시 큐에 추가
      this.messageQueue.unshift(message);
      if (this.messageQueue.length > this.maxQueueSize) {
        this.messageQueue.pop();
      }
    }
  });

  // 다음 처리 스케줄링 (비동기로)
  if (this.messageQueue.length > 0) {
    setTimeout(() => this.processMessageQueue(), 0);
  }
}
```

#### G. 성능 테스트 결과

```bash
# 성능 테스트 실행
./scripts/websocket-performance-test.sh

# 예상 결과:
# ✅ 단일 연결 성공: ~2000ms
# ✅ 다중 구독 완료: ~75ms
# ✅ 동시 연결 테스트 완료: 10/10 성공, ~10800ms
# ✅ 메시지 처리량 테스트 완료: 50/50 성공, ~5 msg/sec
```

**성능 개선 효과:**

- ✅ **비동기 처리**: 메시지 처리 블로킹 제거
- ✅ **인덱스 최적화**: O(n) → O(1) 구독자 검색
- ✅ **자동 정리**: 메모리 누수 방지
- ✅ **로깅 최적화**: 불필요한 로그 제거
- ✅ **큐 최적화**: 배치 처리로 성능 향상
- ✅ **동시 처리**: 여러 요청 동시 처리 가능

#### J. jq를 활용한 JSON 파싱 개선

**개선 사항:**

- JSON 응답의 구조적 분석
- 실시간 데이터 추출 및 포맷팅
- 성능 메트릭 계산
- 오류 응답 분석
- 설정 정보 상세 파싱

**jq 활용 예시:**

#### A. 기본 JSON 파싱

```bash
# 서버 통계 파싱
curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats | jq -r '
    "  - 활성화: " + (.enabled | tostring) +
    "\n  - 총 클라이언트: " + (.totalClients | tostring) +
    "\n  - 가격 구독: " + (.priceSubscriptions | tostring) +
    "\n  - 포트폴리오 구독: " + (.portfolioSubscriptions | tostring) +
    "\n  - 거래 구독: " + (.transactionSubscriptions | tostring)
'
```

#### B. JSON 구조 분석

```bash
# 최상위 키 분석
echo "$stats_response" | jq -r '
    "  - 최상위 키: " + (keys | join(", ")) +
    "\n  - 설정 키: " + (.config | keys | join(", "))
'
```

#### C. 성능 메트릭 계산

```bash
# WebSocket 응답 시간 분석
echo "$response" | jq -r '
    "  - 메시지 타입: " + .type +
    "\n  - 타임스탬프: " + (.data.timestamp | tostring) +
    "\n  - 응답 시간: " + ((now * 1000 - .data.timestamp) | tostring) + "ms"
'
```

#### D. 오류 응답 분석

```bash
# 오류 메시지 파싱
if echo "$invalid_response" | jq -e '.type == "error"' > /dev/null 2>&1; then
    echo "$invalid_response" | jq -r '
        "  - 오류 타입: " + .type +
        "\n  - 오류 메시지: " + .data.message
    '
fi
```

#### E. 설정 정보 상세 파싱

```bash
# 설정 정보 파싱
echo "$stats_response" | jq -r '.config |
    "  - 최대 클라이언트: " + (.maxClients | tostring) +
    "\n  - 메시지 큐 크기: " + (.messageQueueSize | tostring) +
    "\n  - 재연결 시도: " + (.maxReconnectAttempts | tostring) +
    "\n  - 재연결 지연: " + (.reconnectDelay | tostring) + "ms" +
    "\n  - 하트비트 간격: " + (.heartbeatInterval | tostring) + "ms"
'
```

#### F. 고급 테스트 스크립트

```bash
# 고급 테스트 실행
./scripts/websocket-advanced-test.sh

# 예상 결과:
# ✅ JSON 구조 분석 완료
# ✅ WebSocket 연결 성공 (응답 시간: ~2000ms)
# ✅ 다중 구독 완료 (~67ms)
# ✅ 성능 메트릭: 100% 성공률, 평균 1082ms
# ✅ 오류 처리 정상
```

**jq 활용 개선 효과:**

- ✅ **구조적 분석**: JSON 키 구조 자동 분석
- ✅ **실시간 계산**: 응답 시간, 성공률 등 실시간 계산
- ✅ **오류 분석**: 오류 메시지 구조적 파싱
- ✅ **설정 모니터링**: 서버 설정 정보 상세 표시
- ✅ **성능 추적**: 성능 메트릭 자동 계산
- ✅ **가독성 향상**: JSON 데이터를 읽기 쉬운 형태로 변환

#### K. useEffect 의존성 배열 문제 해결

**증상:**

```
Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

**원인:**

- useEffect의 의존성 배열이 없거나 잘못 설정됨
- 의존성 배열의 값이 렌더링될 때마다 변경됨
- 객체나 함수가 매번 새로 생성되어 무한 렌더링 발생

**해결 방법:**

#### A. useCallback을 사용한 함수 메모이제이션

```typescript
// ❌ 잘못된 방법 - 매번 새로운 함수 생성
const loadData = async () => {
  // 데이터 로드 로직
};

useEffect(() => {
  loadData();
}, [loadData]); // loadData가 매번 새로 생성되어 무한 렌더링

// ✅ 올바른 방법 - useCallback으로 메모이제이션
const loadData = useCallback(async () => {
  // 데이터 로드 로직
}, [dependency1, dependency2]); // 의존성이 변경될 때만 함수 재생성

useEffect(() => {
  loadData();
}, [loadData]); // 이제 안정적인 참조
```

#### B. 객체 메모이제이션

```typescript
// ❌ 잘못된 방법 - 매번 새로운 객체 생성
useEffect(() => {
  webSocketService.setToastFunction({ showSuccess, showError, showInfo });
}, [showSuccess, showError, showInfo]); // 객체가 매번 새로 생성됨

// ✅ 올바른 방법 - useCallback으로 객체 메모이제이션
const toastFunctions = useCallback(
  () => ({
    showSuccess,
    showError,
    showInfo,
  }),
  [showSuccess, showError, showInfo]
);

useEffect(() => {
  webSocketService.setToastFunction(toastFunctions());
}, [toastFunctions]);
```

#### C. 의존성 배열 최적화

```typescript
// ❌ 잘못된 방법 - 불필요한 의존성 포함
useEffect(() => {
  if (web3State.isConnected) {
    connectWebSocket();
  }
}, [web3State.isConnected, connectWebSocket, disconnectWebSocket, state.isConnected]);

// ✅ 올바른 방법 - 필수 의존성만 포함
useEffect(() => {
  if (web3State.isConnected) {
    connectWebSocket();
  }
}, [web3State.isConnected]); // connectWebSocket은 이미 useCallback으로 메모이제이션됨
```

#### D. 컴포넌트 내부 함수 처리

```typescript
// ❌ 잘못된 방법 - 컴포넌트 내부 함수를 의존성에 포함
const checkKYCStatus = async () => {
  // KYC 상태 확인 로직
};

useEffect(() => {
  checkKYCStatus();
}, [checkKYCStatus]); // 매번 새로운 함수 참조

// ✅ 올바른 방법 - useCallback으로 메모이제이션
const checkKYCStatus = useCallback(async () => {
  // KYC 상태 확인 로직
}, [account]); // account가 변경될 때만 함수 재생성

useEffect(() => {
  checkKYCStatus();
}, [checkKYCStatus]);
```

#### E. 함수 정의 순서 주의사항

```typescript
// ❌ 잘못된 순서 - useEffect가 함수 정의보다 먼저
useEffect(() => {
  loadData();
}, [loadData]);

const loadData = useCallback(async () => {
  // 데이터 로드 로직
}, [dependency]);

// ✅ 올바른 순서 - 함수 정의 후 useEffect
const loadData = useCallback(async () => {
  // 데이터 로드 로직
}, [dependency]);

useEffect(() => {
  loadData();
}, [loadData]);
```

#### F. 빈 의존성 배열 사용

```typescript
// 컴포넌트 마운트 시에만 실행되어야 하는 경우
useEffect(() => {
  // 초기화 로직
  const interval = setInterval(updateMetrics, 30000);

  return () => {
    clearInterval(interval);
  };
}, []); // 빈 의존성 배열로 마운트 시에만 실행
```

**수정된 컴포넌트들:**

#### 1. RealTimeContext.tsx

```typescript
// Toast 함수 메모이제이션
const toastFunctions = useCallback(
  () => ({
    showSuccess,
    showError,
    showInfo,
  }),
  [showSuccess, showError, showInfo]
);

useEffect(() => {
  webSocketService.setToastFunction(toastFunctions());
}, [toastFunctions]);

// WebSocket 이벤트 구독
useEffect(() => {
  if (!state.isConnected) return;

  const unsubscribePrice = webSocketService.subscribe('price_update', updatePriceData);
  const unsubscribePortfolio = webSocketService.subscribe('portfolio_update', updatePortfolioData);
  const unsubscribeTransaction = webSocketService.subscribe(
    'transaction_update',
    updateTransactionData
  );

  return () => {
    unsubscribePrice();
    unsubscribePortfolio();
    unsubscribeTransaction();
  };
}, [state.isConnected]); // updatePriceData 등은 이미 useCallback으로 메모이제이션됨
```

#### 2. Portfolio.tsx

```typescript
// 데이터 로드 함수 메모이제이션
const loadData = useCallback(async () => {
  setIsLoading(true);
  try {
    // 데이터 로드 로직
    showSuccess('포트폴리오 데이터가 업데이트되었습니다.');
  } catch (error) {
    showError('데이터 로드 중 오류가 발생했습니다.');
  } finally {
    setIsLoading(false);
  }
}, [showSuccess, showError]);

// 실시간 구독 설정
useEffect(() => {
  if (web3State.isConnected && web3State.account && realTimeState.isConnected) {
    const subscriptionTimer = setTimeout(() => {
      subscribeToPortfolio();
      subscribeToTransactions();
    }, 500);

    return () => {
      clearTimeout(subscriptionTimer);
    };
  }
}, [web3State.isConnected, web3State.account, realTimeState.isConnected]);
```

#### 3. TradingSystem.tsx

```typescript
// 로드 함수들 메모이제이션
const loadOrders = useCallback(async () => {
  try {
    const response = await tradingService.getOrders({ propertyId: selectedProperty });
    setOrders(response.data.orders);
  } catch (error) {
    console.error('Failed to load orders:', error);
  }
}, [selectedProperty]);

const loadTrades = useCallback(async () => {
  try {
    const response = await tradingService.getTrades({ propertyId: selectedProperty });
    setTrades(response.data.trades);
  } catch (error) {
    console.error('Failed to load trades:', error);
  }
}, [selectedProperty]);

const loadOrderBook = useCallback(async () => {
  try {
    const response = await tradingService.getOrderBook(selectedProperty);
    setOrderBook(response.data);
  } catch (error) {
    console.error('Failed to load order book:', error);
  }
}, [selectedProperty]);

// useEffect는 함수 정의 후에 배치
useEffect(() => {
  if (web3State.isConnected) {
    loadOrders();
    loadTrades();
    loadOrderBook();
  }
}, [web3State.isConnected, selectedProperty, loadOrders, loadTrades, loadOrderBook]);
```

**useEffect 의존성 배열 문제 해결 효과:**

- ✅ **무한 렌더링 방지**: 의존성 배열 최적화로 무한 렌더링 해결
- ✅ **성능 향상**: 불필요한 리렌더링 방지
- ✅ **메모리 누수 방지**: 적절한 cleanup 함수 실행
- ✅ **안정적인 참조**: useCallback으로 함수 참조 안정화
- ✅ **예측 가능한 동작**: 명확한 의존성 관계로 동작 예측 가능

#### L. setImmediate 브라우저 호환성 문제 해결

**증상:**

```
Uncaught ReferenceError: setImmediate is not defined
    at WebSocketService.send (websocket.ts:384:1)
    at ws.onopen (websocket.ts:165:1)
```

**원인:**

- `setImmediate`는 Node.js 환경에서만 사용 가능한 함수
- 브라우저 환경에서는 `setImmediate`가 정의되지 않음
- 프론트엔드 코드에서 Node.js 전용 API 사용

**해결 방법:**

#### A. setImmediate를 setTimeout으로 변경

```typescript
// ❌ 잘못된 방법 - 브라우저에서 지원되지 않음
setImmediate(() => this.processMessageQueue());

// ✅ 올바른 방법 - 브라우저 호환
setTimeout(() => this.processMessageQueue(), 0);
```

#### B. 프론트엔드 WebSocket 서비스 수정

```typescript
// frontend/src/services/websocket.ts

// 메시지 큐 처리
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

// 메시지 전송
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
```

#### C. 백엔드 WebSocket 서비스 수정 (일관성)

```javascript
// backend/src/services/websocketService.js

// 연결 확인 메시지 전송 (비동기로)
setTimeout(() => {
  this.sendToClient(clientId, {
    type: 'connection_established',
    data: {
      clientId,
      timestamp: Date.now(),
    },
  });
}, 0);

// 메시지 처리 (비동기로 처리)
setTimeout(() => {
  try {
    const parsedMessage = JSON.parse(message);
    this.handleMessage(clientId, parsedMessage);
  } catch (error) {
    logger.error(`메시지 파싱 오류 (클라이언트 ${clientId}):`, error);
    this.sendToClient(clientId, {
      type: 'error',
      data: {
        message: 'Invalid message format',
      },
    });
  }
}, 0);

// 구독 처리 (비동기로 데이터 전송)
setTimeout(() => {
  message.data.propertyIds.forEach(propertyId => {
    const priceData = this.generatePriceData(propertyId);
    this.sendToClient(clientId, { type: 'price_update', data: priceData });
  });
}, 0);
```

#### D. 브라우저 호환성 체크 함수

```typescript
// 브라우저 환경에서 setImmediate 대체 함수
const scheduleTask = (callback: () => void) => {
  if (typeof setImmediate !== 'undefined') {
    // Node.js 환경
    setImmediate(callback);
  } else {
    // 브라우저 환경
    setTimeout(callback, 0);
  }
};

// 사용 예시
scheduleTask(() => this.processMessageQueue());
```

#### E. 환경별 분기 처리

```typescript
// 환경에 따른 비동기 처리 함수
const asyncTask = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    // 브라우저 환경
    setTimeout(callback, 0);
  } else {
    // Node.js 환경
    setImmediate(callback);
  }
};

// 사용 예시
asyncTask(() => {
  this.processMessageQueue();
});
```

**setImmediate vs setTimeout 차이점:**

#### 1. 실행 순서

```javascript
// setImmediate (Node.js)
setImmediate(() => console.log('setImmediate'));
setTimeout(() => console.log('setTimeout'), 0);
// 출력: setImmediate, setTimeout

// setTimeout (브라우저)
setTimeout(() => console.log('setTimeout'), 0);
// 출력: setTimeout
```

#### 2. 성능 특성

- **setImmediate**: 현재 이벤트 루프 턴이 완료된 후 즉시 실행
- **setTimeout**: 최소 지연 시간(보통 4ms) 후 실행
- **브라우저**: setTimeout이 가장 빠른 비동기 실행 방법

#### 3. 사용 권장사항

```typescript
// ✅ 권장 - 브라우저 호환
setTimeout(() => {
  // 비동기 작업
}, 0);

// ❌ 비권장 - Node.js 전용
setImmediate(() => {
  // 비동기 작업
});
```

**setImmediate 브라우저 호환성 문제 해결 효과:**

- ✅ **브라우저 호환성**: 모든 브라우저에서 정상 동작
- ✅ **일관된 동작**: 프론트엔드와 백엔드에서 동일한 패턴
- ✅ **오류 방지**: ReferenceError 해결
- ✅ **성능 유지**: 비동기 처리 성능 유지
- ✅ **코드 안정성**: 환경에 관계없이 안정적 동작

#### M. 함수 초기화 순서 문제 해결

**증상:**

```
Uncaught runtime errors:
×
ERROR
Cannot access 'checkKYCStatus' before initialization
ReferenceError: Cannot access 'checkKYCStatus' before initialization
    at KYCSystem (http://localhost:3000/static/js/src_components_KYCSystem_tsx.chunk.js:102:16)
```

**원인:**

- `useEffect`가 `useCallback`으로 정의된 함수보다 먼저 정의됨
- JavaScript의 호이스팅(hoisting)과 함수 초기화 순서 문제
- `useEffect`에서 함수를 참조하려고 할 때 함수가 아직 초기화되지 않음

**해결 방법:**

#### A. 함수 정의 순서 변경

```typescript
// ❌ 잘못된 순서 - 오류 발생
const Component = () => {
  const [state, setState] = useState();

  useEffect(() => {
    checkKYCStatus(); // 함수가 아직 정의되지 않음
  }, [checkKYCStatus]);

  const checkKYCStatus = useCallback(async () => {
    // 함수 정의
  }, []);
};

// ✅ 올바른 순서 - 함수를 먼저 정의
const Component = () => {
  const [state, setState] = useState();

  const checkKYCStatus = useCallback(async () => {
    // 함수 정의
  }, []);

  useEffect(() => {
    checkKYCStatus(); // 함수가 이미 정의됨
  }, [checkKYCStatus]);
};
```

#### B. KYCSystem 컴포넌트 수정 예시

```typescript
// frontend/src/components/KYCSystem.tsx

const KYCSystem: React.FC = () => {
  const { state: userState } = useUser();
  const { web3State } = useWeb3();
  const account = web3State.account;

  // 상태 정의
  const [formData, setFormData] = useState<KYCFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: 'KR',
    documentType: 'PASSPORT',
    documentNumber: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'KR',
    expectedTransactionAmount: 0,
    isPEP: false,
    isSanctioned: false,
  });
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'verification' | 'complete'>('form');
  const [verificationId, setVerificationId] = useState<string>('');
  const [error, setError] = useState<string>('');

  // ✅ 함수를 먼저 정의
  const checkKYCStatus = useCallback(async () => {
    if (!account) return;

    try {
      setIsLoading(true);
      const status = await kycService.checkKYCStatus(account);
      setKycStatus(status);

      if (status.isVerified) {
        setCurrentStep('complete');
      }
    } catch (error) {
      console.error('KYC status check failed:', error);
      setError('KYC 상태 확인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  // ✅ useEffect를 함수 정의 뒤에 배치
  useEffect(() => {
    if (account) {
      checkKYCStatus();
    }
  }, [account, checkKYCStatus]);

  // 나머지 함수들...
  const handleInputChange = (e: any) => {
    // ...
  };

  const handleSubmit = async (e: React.FormEvent) => {
    // ...
  };
};
```

#### C. 일반적인 React 컴포넌트 구조 가이드

```typescript
const Component = () => {
  // 1. Context 및 Props
  const { state } = useContext();
  const { data } = useQuery();

  // 2. State 정의
  const [localState, setLocalState] = useState();
  const [loading, setLoading] = useState(false);

  // 3. useCallback으로 함수 정의
  const handleAction = useCallback(async () => {
    // 함수 로직
  }, [dependencies]);

  const processData = useCallback(() => {
    // 함수 로직
  }, [dependencies]);

  // 4. useEffect 정의
  useEffect(() => {
    handleAction();
  }, [handleAction]);

  useEffect(() => {
    processData();
  }, [processData]);

  // 5. 이벤트 핸들러
  const handleClick = () => {
    // 클릭 핸들러
  };

  const handleSubmit = (e: FormEvent) => {
    // 제출 핸들러
  };

  // 6. 렌더링
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

#### D. 함수 초기화 순서 체크리스트

```typescript
// ✅ 올바른 순서
const Component = () => {
  // 1. Context/Props 사용
  const context = useContext();

  // 2. State 정의
  const [state, setState] = useState();

  // 3. useCallback 함수들 정의
  const function1 = useCallback(() => {}, []);
  const function2 = useCallback(() => {}, []);

  // 4. useEffect 정의 (함수들 참조)
  useEffect(() => {
    function1();
  }, [function1]);

  useEffect(() => {
    function2();
  }, [function2]);

  // 5. 일반 함수들 정의
  const handleClick = () => {};

  // 6. 렌더링
  return <div />;
};

// ❌ 잘못된 순서
const Component = () => {
  const [state, setState] = useState();

  useEffect(() => {
    function1(); // 오류: 함수가 아직 정의되지 않음
  }, [function1]);

  const function1 = useCallback(() => {}, []); // 나중에 정의됨
};
```

#### E. 디버깅 방법

```typescript
// 1. 함수 정의 확인
console.log('checkKYCStatus 정의됨:', typeof checkKYCStatus);

// 2. useEffect 실행 순서 확인
useEffect(() => {
  console.log('useEffect 실행됨');
  if (typeof checkKYCStatus === 'function') {
    checkKYCStatus();
  } else {
    console.error('checkKYCStatus가 함수가 아님:', typeof checkKYCStatus);
  }
}, [checkKYCStatus]);

// 3. 함수 초기화 확인
const checkKYCStatus = useCallback(async () => {
  console.log('checkKYCStatus 함수 실행됨');
  // ...
}, [account]);
```

#### F. ESLint 규칙 설정

```json
// .eslintrc.json
{
  "rules": {
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/rules-of-hooks": "error"
  }
}
```

**함수 초기화 순서 문제 해결 효과:**

- ✅ **ReferenceError 해결**: 함수 초기화 전 접근 오류 방지
- ✅ **안정적인 실행**: 컴포넌트 마운트 시 안정적 동작
- ✅ **코드 가독성**: 논리적인 함수 정의 순서
- ✅ **디버깅 용이성**: 명확한 의존성 관계
- ✅ **성능 최적화**: useCallback과 useEffect의 올바른 조합

#### N. 토스트 메시지 위치 및 스타일 개선

**개선 목표:**

- 토스트 메시지의 위치를 더 적절하게 조정
- 현대적이고 부드러운 디자인 적용
- 반응형 디자인으로 모바일/데스크톱 모두 지원
- 더 나은 사용자 경험 제공

**개선 사항:**

#### A. 토스트 컨테이너 위치 개선

```typescript
// frontend/src/components/common/ToastContainer.tsx

// ❌ 이전 - 고정된 위치
<div className="fixed top-4 right-4 z-50 space-y-2">

// ✅ 개선 - 반응형 위치 및 여백
<div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] space-y-2 sm:space-y-3 w-full max-w-xs sm:max-w-sm md:max-w-md px-4 sm:px-0">
```

#### B. 토스트 컴포넌트 스타일 개선

```typescript
// frontend/src/components/common/Toast.tsx

// ❌ 이전 - 기본적인 스타일
<div className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ease-in-out ${
  isVisible && !isExiting
    ? 'translate-x-0 opacity-100'
    : 'translate-x-full opacity-0'
}`}>

// ✅ 개선 - 현대적이고 부드러운 스타일
<div className={`w-full transform transition-all duration-300 ease-out ${
  isVisible && !isExiting
    ? 'translate-x-0 opacity-100 scale-100'
    : 'translate-x-full opacity-0 scale-95'
}`}>
```

#### C. 배경색 및 테두리 개선

```typescript
// ❌ 이전 - 단순한 배경색
const getBackgroundColor = () => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200';
    case 'error':
      return 'bg-red-50 border-red-200';
    // ...
  }
};

// ✅ 개선 - 반투명 배경과 그림자 효과
const getBackgroundColor = () => {
  switch (type) {
    case 'success':
      return 'bg-green-50/95 border-green-200/80 shadow-green-100/50';
    case 'error':
      return 'bg-red-50/95 border-red-200/80 shadow-red-100/50';
    case 'warning':
      return 'bg-yellow-50/95 border-yellow-200/80 shadow-yellow-100/50';
    case 'info':
      return 'bg-blue-50/95 border-blue-200/80 shadow-blue-100/50';
    default:
      return 'bg-gray-50/95 border-gray-200/80 shadow-gray-100/50';
  }
};
```

#### D. 아이콘 및 텍스트 스타일 개선

```typescript
// ❌ 이전 - 기본 아이콘 색상
case 'success':
  return <CheckCircle className="w-5 h-5 text-green-500" />;

// ✅ 개선 - 더 진한 색상으로 가독성 향상
case 'success':
  return <CheckCircle className="w-5 h-5 text-green-600" />;

// ❌ 이전 - 기본 텍스트 스타일
<h4 className={`text-sm font-medium ${getTextColor()}`}>
  {title}
</h4>

// ✅ 개선 - 더 강조된 텍스트 스타일
<h4 className={`text-sm font-semibold leading-5 ${getTextColor()}`}>
  {title}
</h4>
```

#### E. 닫기 버튼 개선

```typescript
// ❌ 이전 - 기본 버튼 스타일
<button
  onClick={handleClose}
  className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
    type === 'success'
      ? 'text-green-400 hover:text-green-500 focus:ring-green-500'
      // ...
  }`}
>

// ✅ 개선 - 호버 효과와 접근성 개선
<button
  onClick={handleClose}
  className={`inline-flex rounded-lg p-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:bg-opacity-10 ${
    type === 'success'
      ? 'text-green-500 hover:text-green-600 hover:bg-green-500 focus:ring-green-500'
      // ...
  }`}
  aria-label="닫기"
>
```

#### F. 반응형 디자인 적용

```typescript
// 토스트 컨테이너 - 반응형 위치 및 크기
<div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] space-y-2 sm:space-y-3 w-full max-w-xs sm:max-w-sm md:max-w-md px-4 sm:px-0">

// 토스트 카드 - 반응형 패딩 및 둥근 모서리
<div className={`rounded-xl border-2 p-4 shadow-xl backdrop-blur-sm ${getBackgroundColor()}`}>
```

#### G. 애니메이션 개선

```typescript
// ❌ 이전 - 단순한 슬라이드 애니메이션
className={`transform transition-all duration-300 ease-in-out ${
  isVisible && !isExiting
    ? 'translate-x-0 opacity-100'
    : 'translate-x-full opacity-0'
}`}

// ✅ 개선 - 스케일과 슬라이드 조합 애니메이션
className={`transform transition-all duration-300 ease-out ${
  isVisible && !isExiting
    ? 'translate-x-0 opacity-100 scale-100'
    : 'translate-x-full opacity-0 scale-95'
}`}
```

#### H. Z-index 및 레이어링 개선

```typescript
// ❌ 이전 - 낮은 z-index
z - 50;

// ✅ 개선 - 높은 z-index로 다른 요소 위에 표시
z - [9999];
```

**토스트 메시지 개선 효과:**

#### 1. 시각적 개선

- ✅ **현대적 디자인**: 둥근 모서리와 그림자 효과
- ✅ **반투명 배경**: backdrop-blur 효과로 모던한 느낌
- ✅ **부드러운 애니메이션**: 스케일과 슬라이드 조합
- ✅ **향상된 가독성**: 더 진한 색상과 폰트 굵기

#### 2. 반응형 개선

- ✅ **모바일 최적화**: 작은 화면에서 적절한 크기
- ✅ **데스크톱 최적화**: 큰 화면에서 여유로운 레이아웃
- ✅ **적응형 여백**: 화면 크기에 따른 동적 여백 조정
- ✅ **반응형 폰트**: 화면 크기에 따른 텍스트 크기 조정

#### 3. 사용성 개선

- ✅ **접근성 향상**: aria-label 추가
- ✅ **호버 효과**: 버튼에 부드러운 호버 애니메이션
- ✅ **포커스 표시**: 키보드 접근성 개선
- ✅ **자동 정렬**: 여러 토스트의 자동 정렬

#### 4. 성능 개선

- ✅ **최적화된 애니메이션**: GPU 가속 활용
- ✅ **효율적인 렌더링**: transform 기반 애니메이션
- ✅ **메모리 효율성**: 적절한 cleanup 함수

**사용 예시:**

```typescript
// 개선된 토스트 메시지 사용
const { showSuccess, showError, showInfo, showWarning } = useToast();

// 성공 메시지
showSuccess('작업이 성공적으로 완료되었습니다.');

// 오류 메시지
showError('작업 중 오류가 발생했습니다.');

// 정보 메시지
showInfo('새로운 업데이트가 있습니다.');

// 경고 메시지
showWarning('주의가 필요한 작업입니다.');
```

**개선된 토스트 메시지 특징:**

- 🎨 **현대적 디자인**: 둥근 모서리, 그림자, 반투명 배경
- 📱 **반응형 레이아웃**: 모바일과 데스크톱 모두 최적화
- ✨ **부드러운 애니메이션**: 스케일과 슬라이드 조합
- ♿ **접근성 개선**: ARIA 라벨과 키보드 지원
- 🎯 **적절한 위치**: 화면 우상단에 적절한 여백
- 🔄 **자동 정렬**: 여러 토스트의 자동 스택 정렬
