# HomeSure Frontend

부동산 토큰화 플랫폼의 프론트엔드 애플리케이션입니다.

## 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수들을 설정하세요:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001/api

# WebSocket Configuration
REACT_APP_WEBSOCKET_URL=ws://localhost:3001

# Blockchain Configuration
REACT_APP_CHAIN_ID=1337
REACT_APP_NETWORK_NAME=Localhost

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

### 환경별 설정

**개발 환경:**
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WEBSOCKET_URL=ws://localhost:3001
REACT_APP_ENABLE_DEBUG_MODE=true
```

**스테이징 환경:**
```env
REACT_APP_API_URL=https://staging-api.homesure.com/api
REACT_APP_WEBSOCKET_URL=wss://staging-api.homesure.com
REACT_APP_CHAIN_ID=11155111
REACT_APP_NETWORK_NAME=Sepolia
```

**프로덕션 환경:**
```env
REACT_APP_API_URL=https://api.homesure.com/api
REACT_APP_WEBSOCKET_URL=wss://api.homesure.com
REACT_APP_CHAIN_ID=1
REACT_APP_NETWORK_NAME=Ethereum Mainnet
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG_MODE=false
```

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm start

# 프로덕션 빌드
npm run build
```

## 주요 기능

- 실시간 WebSocket 연결을 통한 가격 업데이트
- Material UI 기반 모던한 UI/UX
- 반응형 디자인
- 실시간 포트폴리오 모니터링
- 거래 시스템
- KYC/AML 검증
- 관리자 대시보드
