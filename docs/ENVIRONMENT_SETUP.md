# 환경 변수 설정 가이드

HomeSure 프로젝트의 환경 변수 설정 방법을 안내합니다.

## 프론트엔드 환경 변수

프론트엔드 루트 디렉토리에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

### 필수 환경 변수

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001/api

# WebSocket Configuration
REACT_APP_WEBSOCKET_URL=ws://localhost:3001

# Blockchain Configuration
REACT_APP_CHAIN_ID=1337
REACT_APP_NETWORK_NAME=Localhost
```

### 선택적 환경 변수

```env
# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_DEBUG_MODE=true

# External Services
REACT_APP_IPFS_GATEWAY=https://ipfs.io/ipfs/
REACT_APP_ETHERSCAN_URL=https://etherscan.io

# Performance
REACT_APP_CACHE_TTL=300000
REACT_APP_WEBSOCKET_RECONNECT_ATTEMPTS=5
```

## 백엔드 환경 변수

백엔드 루트 디렉토리에 환경별 설정 파일을 생성하세요:

### 환경별 설정 파일

**개발 환경: `.env.development`**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://username:password@localhost:5432/homesure_dev_db
JWT_SECRET=dev-super-secret-jwt-key-here
ETHEREUM_NETWORK=localhost
ETHEREUM_RPC_URL=http://localhost:8545
WEBSOCKET_ENABLED=true
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
```

**스테이징 환경: `.env.staging`**
```env
NODE_ENV=staging
PORT=3001
DATABASE_URL=postgresql://username:password@staging-db.homesure.com:5432/homesure_staging_db
JWT_SECRET=staging-super-secret-jwt-key-here
ETHEREUM_NETWORK=sepolia
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
WEBSOCKET_ENABLED=true
LOG_LEVEL=info
CORS_ORIGIN=https://staging.homesure.com
```

**프로덕션 환경: `.env.production`**
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://username:password@prod-db.homesure.com:5432/homesure_prod_db
JWT_SECRET=prod-super-secret-jwt-key-here
ETHEREUM_NETWORK=mainnet
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
WEBSOCKET_ENABLED=true
LOG_LEVEL=warn
CORS_ORIGIN=https://homesure.com
```

### 필수 환경 변수

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/homesure_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Blockchain Configuration
ETHEREUM_NETWORK=localhost
ETHEREUM_RPC_URL=http://localhost:8545
PRIVATE_KEY=your-private-key-here

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### WebSocket 관련 환경 변수

```env
# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_HEARTBEAT_INTERVAL=30000
WEBSOCKET_MAX_RECONNECT_ATTEMPTS=5
WEBSOCKET_RECONNECT_DELAY=1000
```

### 선택적 환경 변수

```env
# API Configuration
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Security Configuration
BCRYPT_ROUNDS=12

# Frontend and Backend URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Encryption Configuration
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

## 환경별 실행 방법

### 프론트엔드

**개발 환경:**
```bash
cd frontend
npm start  # .env.development 자동 로드
```

**스테이징 환경:**
```bash
cd frontend
NODE_ENV=staging npm start  # .env.staging 로드
```

**프로덕션 환경:**
```bash
cd frontend
NODE_ENV=production npm run build  # .env.production 로드
```

### 백엔드

**개발 환경:**
```bash
cd backend
npm run dev  # .env.development 로드
```

**스테이징 환경:**
```bash
cd backend
npm run staging  # .env.staging 로드
```

**프로덕션 환경:**
```bash
cd backend
npm run prod  # .env.production 로드
```

## 환경별 설정

### 개발 환경

**프론트엔드 (.env.development):**
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WEBSOCKET_URL=ws://localhost:3001
REACT_APP_CHAIN_ID=1337
REACT_APP_NETWORK_NAME=Localhost
REACT_APP_ENABLE_DEBUG_MODE=true
```

**백엔드 (.env.development):**
```env
NODE_ENV=development
PORT=3001
WEBSOCKET_ENABLED=true
WEBSOCKET_HEARTBEAT_INTERVAL=30000
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
```

### 스테이징 환경

**프론트엔드 (.env.staging):**
```env
REACT_APP_API_URL=https://staging-api.homesure.com/api
REACT_APP_WEBSOCKET_URL=wss://staging-api.homesure.com
REACT_APP_CHAIN_ID=11155111
REACT_APP_NETWORK_NAME=Sepolia
REACT_APP_ENABLE_DEBUG_MODE=false
```

**백엔드 (.env.staging):**
```env
NODE_ENV=staging
PORT=3001
WEBSOCKET_ENABLED=true
WEBSOCKET_HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
CORS_ORIGIN=https://staging.homesure.com
```

### 프로덕션 환경

**프론트엔드 (.env.production):**
```env
REACT_APP_API_URL=https://api.homesure.com/api
REACT_APP_WEBSOCKET_URL=wss://api.homesure.com
REACT_APP_CHAIN_ID=1
REACT_APP_NETWORK_NAME=Ethereum Mainnet
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG_MODE=false
```

**백엔드 (.env.production):**
```env
NODE_ENV=production
PORT=3001
WEBSOCKET_ENABLED=true
WEBSOCKET_HEARTBEAT_INTERVAL=30000
LOG_LEVEL=warn
CORS_ORIGIN=https://homesure.com
```

## WebSocket 설정 상세

### 프론트엔드 WebSocket 설정

- **REACT_APP_WEBSOCKET_URL**: WebSocket 서버 주소
  - 개발: `ws://localhost:3001`
  - 프로덕션: `wss://api.homesure.com`

### 백엔드 WebSocket 설정

- **WEBSOCKET_ENABLED**: WebSocket 서비스 활성화 여부
  - `true`: WebSocket 서비스 활성화
  - `false`: WebSocket 서비스 비활성화

- **WEBSOCKET_HEARTBEAT_INTERVAL**: Heartbeat 간격 (밀리초)
  - 기본값: `30000` (30초)

- **WEBSOCKET_MAX_RECONNECT_ATTEMPTS**: 최대 재연결 시도 횟수
  - 기본값: `5`

- **WEBSOCKET_RECONNECT_DELAY**: 재연결 시도 간격 (밀리초)
  - 기본값: `1000` (1초)

## 환경 변수 확인

### 프론트엔드
```bash
cd frontend
npm start
```

### 백엔드
```bash
cd backend
npm run dev  # 개발 환경
npm run staging  # 스테이징 환경
npm run prod  # 프로덕션 환경
```

### WebSocket 연결 확인
```bash
# WebSocket 통계 확인
curl http://localhost:3001/api/websocket/stats
```

## 배포 시 환경 변수 설정

### 자동 배포 (배포 스크립트 사용)
```bash
# 환경 변수 설정 후 배포
export NODE_ENV=production
export WEBSOCKET_URL=wss://api.homesure.com
export API_URL=https://api.homesure.com/api
./scripts/deploy-production.sh ethereum
```

### 수동 배포
```bash
# 백엔드 배포
cd backend
cp .env.production .env
npm run prod

# 프론트엔드 배포
cd frontend
cp .env.production .env
npm run build
```

## 주의사항

1. **보안**: `.env` 파일은 절대 Git에 커밋하지 마세요
2. **프로덕션**: 프로덕션 환경에서는 HTTPS/WSS를 사용하세요
3. **백업**: 환경 변수 설정을 안전한 곳에 백업하세요
4. **테스트**: 환경 변수 변경 후 반드시 테스트하세요
5. **환경별 실행**: 각 환경에 맞는 스크립트를 사용하세요 