# WebSocket 테스트 가이드

이 문서는 HomeSure 프로젝트의 WebSocket 기능을 테스트하는 방법을 설명합니다.

## 📋 목차

- [개요](#개요)
- [wscat 설치](#wscat-설치)
- [자동화된 테스트](#자동화된-테스트)
- [수동 테스트](#수동-테스트)
- [대화형 테스트](#대화형-테스트)
- [문제 해결](#문제-해결)

## 🎯 개요

HomeSure 프로젝트는 실시간 부동산 거래를 위한 WebSocket 기능을 제공합니다:

- **실시간 가격 업데이트**: 부동산 토큰 가격 변화
- **포트폴리오 추적**: 사용자 포트폴리오 가치 변화
- **거래 알림**: 새로운 거래 완료 알림
- **연결 관리**: 자동 재연결 및 폴백 메커니즘

## 🔧 wscat 설치

### 전역 설치 (권장)

```bash
npm install -g wscat
```

### 설치 확인

```bash
wscat --version
```

## 🚀 자동화된 테스트

### 모든 테스트 실행

```bash
npm run websocket:test
# 또는
./scripts/websocket-test.sh all
```

### 개별 테스트 실행

```bash
# 기본 연결 테스트
npm run websocket:test:basic

# 가격 구독 테스트
npm run websocket:test:price

# 포트폴리오 구독 테스트
npm run websocket:test:portfolio

# 거래 구독 테스트
npm run websocket:test:transaction
```

### 대화형 테스트

```bash
npm run websocket:test:interactive
```

## 🧪 수동 테스트

### 1. 기본 연결 테스트

```bash
wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 3
```

**예상 결과:**

```json
{"type":"connection_established","data":{"clientId":"client-xxx","timestamp":xxx}}
{"type":"pong","data":{"timestamp":xxx}}
```

### 2. 가격 구독 테스트

```bash
wscat -c ws://localhost:3001 \
  --execute '{"type":"subscribe_prices","data":{"propertyIds":["property-1","property-2"]}}' \
  --wait 5
```

**예상 결과:**

```json
{"type":"price_update","data":{"propertyId":"property-1","price":xxx,"change":xxx,"changePercent":xxx,"timestamp":xxx}}
{"type":"price_update","data":{"propertyId":"property-2","price":xxx,"change":xxx,"changePercent":xxx,"timestamp":xxx}}
```

### 3. 포트폴리오 구독 테스트

```bash
wscat -c ws://localhost:3001 \
  --execute '{"type":"subscribe_portfolio","data":{"userId":"user-1"}}' \
  --wait 5
```

**예상 결과:**

```json
{"type":"portfolio_update","data":{"totalValue":xxx,"change":xxx,"changePercent":xxx,"assets":[...],"timestamp":xxx}}
```

### 4. 거래 구독 테스트

```bash
wscat -c ws://localhost:3001 \
  --execute '{"type":"subscribe_transactions","data":{"userId":"user-1"}}' \
  --wait 8
```

**예상 결과:**

```json
{"type":"transaction_update","data":{"id":"tx-xxx","type":"buy","amount":xxx,"propertyId":"property-x","status":"confirmed","timestamp":xxx}}
```

### 5. 구독 해제 테스트

```bash
wscat -c ws://localhost:3001 \
  --execute '{"type":"subscribe_prices","data":{"propertyIds":["property-1"]}}' \
  --execute '{"type":"unsubscribe_prices","data":{"propertyIds":["property-1"]}}' \
  --wait 3
```

### 6. 에러 처리 테스트

```bash
wscat -c ws://localhost:3001 --execute '{"type":"unknown_message_type"}' --wait 2
```

**예상 결과:**

```json
{ "type": "error", "data": { "message": "Unknown message type: unknown_message_type" } }
```

## 💬 대화형 테스트

실시간으로 WebSocket 메시지를 주고받으면서 테스트할 수 있습니다:

```bash
wscat -c ws://localhost:3001 --show-ping-pong
```

### 대화형 모드에서 사용할 수 있는 명령어

#### 연결 확인

```json
{ "type": "ping" }
```

#### 가격 구독

```json
{
  "type": "subscribe_prices",
  "data": { "propertyIds": ["property-1", "property-2", "property-3"] }
}
```

#### 포트폴리오 구독

```json
{ "type": "subscribe_portfolio", "data": { "userId": "user-1" } }
```

#### 거래 구독

```json
{ "type": "subscribe_transactions", "data": { "userId": "user-1" } }
```

#### 구독 해제

```json
{ "type": "unsubscribe_prices", "data": { "propertyIds": ["property-1"] } }
```

## 🔍 메시지 타입 참조

### 클라이언트 → 서버

| 타입                       | 설명                 | 데이터                      |
| -------------------------- | -------------------- | --------------------------- |
| `ping`                     | 연결 확인            | `{"timestamp": number}`     |
| `subscribe_prices`         | 가격 구독            | `{"propertyIds": string[]}` |
| `subscribe_portfolio`      | 포트폴리오 구독      | `{"userId": string}`        |
| `subscribe_transactions`   | 거래 구독            | `{"userId": string}`        |
| `unsubscribe_prices`       | 가격 구독 해제       | `{"propertyIds": string[]}` |
| `unsubscribe_portfolio`    | 포트폴리오 구독 해제 | `{}`                        |
| `unsubscribe_transactions` | 거래 구독 해제       | `{}`                        |

### 서버 → 클라이언트

| 타입                     | 설명                | 데이터                                                                                                          |
| ------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `connection_established` | 연결 성공           | `{"clientId": string, "timestamp": number}`                                                                     |
| `pong`                   | ping 응답           | `{"timestamp": number}`                                                                                         |
| `price_update`           | 가격 업데이트       | `{"propertyId": string, "price": number, "change": number, "changePercent": number, "timestamp": number}`       |
| `portfolio_update`       | 포트폴리오 업데이트 | `{"totalValue": number, "change": number, "changePercent": number, "assets": Array, "timestamp": number}`       |
| `transaction_update`     | 거래 업데이트       | `{"id": string, "type": string, "amount": number, "propertyId": string, "status": string, "timestamp": number}` |
| `notification`           | 알림                | `{"message": string, "type": string}`                                                                           |
| `error`                  | 오류                | `{"message": string}`                                                                                           |

## 🛠️ 문제 해결

### 서버가 실행되지 않는 경우

```bash
# 서버 시작
./scripts/start-project.sh

# 또는 개별 서버 시작
cd backend && npm start
```

### WebSocket 연결 실패

```bash
# 서버 상태 확인
curl -H "Accept: application/json" http://localhost:3001/health

# WebSocket 통계 확인
curl -H "Accept: application/json" http://localhost:3001/api/websocket/stats
```

### wscat 설치 오류

```bash
# Node.js 버전 확인
node --version

# npm 캐시 정리
npm cache clean --force

# wscat 재설치
npm uninstall -g wscat
npm install -g wscat
```

### 권한 오류

```bash
# 스크립트 실행 권한 부여
chmod +x scripts/websocket-test.sh
```

## 📊 테스트 결과 해석

### 성공적인 테스트의 특징

1. **연결 성공**: `connection_established` 메시지 수신
2. **ping/pong**: heartbeat 정상 작동
3. **구독 성공**: 요청한 데이터 타입의 업데이트 수신
4. **에러 처리**: 잘못된 메시지에 대한 적절한 에러 응답

### 일반적인 문제점

1. **연결 실패**: 서버가 실행되지 않음 또는 포트 충돌
2. **데이터 없음**: 구독한 데이터가 아직 생성되지 않음
3. **타임아웃**: 네트워크 지연 또는 서버 부하
4. **CORS 오류**: 브라우저에서의 origin 검증 실패

## 🔄 CI/CD 통합

### GitHub Actions 예시

```yaml
- name: WebSocket Tests
  run: |
    npm run websocket:test
```

### 로컬 개발 워크플로우

```bash
# 1. 서버 시작
./scripts/start-project.sh

# 2. WebSocket 테스트
npm run websocket:test

# 3. 특정 기능 테스트
npm run websocket:test:price
```

## 📝 추가 리소스

- [wscat 공식 문서](https://github.com/websockets/wscat)
- [WebSocket 프로토콜](https://tools.ietf.org/html/rfc6455)
- [HomeSure WebSocket 서비스](../backend/src/services/websocketService.js)
- [HomeSure WebSocket 클라이언트](../frontend/src/services/websocket.ts)
