# HomeSure - 블록체인 기반 부동산 토큰화 플랫폼

HomeSure는 부동산 투자를 더욱 쉽고 투명하게 만드는 블록체인 기반 플랫폼입니다. 부동산을 토큰으로 분할하여 소액 투자자들도 부동산 시장에 참여할 수 있도록 합니다.

## 🚀 주요 기능

### 1. KYC/AML 통합 시스템

- **KYC (Know Your Customer)** 인증
- **AML (Anti-Money Laundering)** 검증
- 관리자 승인/거부 시스템
- 실시간 상태 추적
- 블록체인 기반 신원 검증

### 2. 부동산 토큰화 시스템

- 부동산 등록 및 검증
- 토큰 생성 및 발행
- IPFS 기반 메타데이터 저장
- 실시간 가격 추적
- 배당금 관리

### 3. 거래 시스템

- 실시간 주문장
- 매수/매도 주문
- 거래 내역 추적
- 가격 차트 및 분석

### 4. 포트폴리오 관리

- 보유 토큰 현황
- 수익률 분석
- 자산 분포 차트
- 거래 내역 관리

### 5. 관리자 대시보드

- KYC 신청 관리
- 부동산 승인/거부
- 시스템 통계
- 사용자 관리

## 🛠 기술 스택

### Frontend

- **React 18** + **TypeScript**
- **MUI CSS** - 스타일링
- **Lucide React** - 아이콘
- **Axios** - HTTP 클라이언트
- **Ethers.js** - 블록체인 상호작용

### Backend

- **Node.js** + **Express.js**
- **Prisma** - ORM
- **Redis** - 캐싱
- **JWT** - 인증

### Blockchain

- **Hardhat** - 개발 환경
- **Solidity** - 스마트 컨트랙트
- **Ethers.js** - 블록체인 라이브러리

### Infrastructure

- **IPFS** - 분산 파일 저장
- **Infura** - 블록체인 노드

## 📦 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/romico/HomeSure.git
cd homesure
```

### 2. 의존성 설치

```bash
# 루트 의존성
npm install

# 백엔드 의존성
cd backend
npm install

# 프론트엔드 의존성
cd ../frontend
npm install --legacy-peer-deps
```

### 3. 환경 변수 설정

```bash
# 루트 디렉토리에 .env 파일 생성
cp env.example .env

# 백엔드 디렉토리에 .env 파일 생성
cd backend
cp env.example .env
```

필요한 환경 변수:

- `DATABASE_URL` - PostgreSQL 연결 문자열
- `REDIS_URL` - Redis 연결 문자열
- `JWT_SECRET` - JWT 시크릿 키
- `PRIVATE_KEY` - 블록체인 지갑 개인키
- `INFURA_PROJECT_ID` - Infura 프로젝트 ID
- `INFURA_PROJECT_SECRET` - Infura 프로젝트 시크릿

### 4. 데이터베이스 설정

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. 블록체인 노드 실행

```bash
# 새 터미널에서
npx hardhat node
```

### 6. 스마트 컨트랙트 배포

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### 7. 백엔드 서버 실행

```bash
cd backend
node src/server-simple.js
```

### 8. 프론트엔드 실행

```bash
cd frontend
npm start
```

## 🏗 프로젝트 구조

```
HomeSure/
├── backend/                 # 백엔드 서버
│   ├── src/
│   │   ├── config/         # 설정 파일
│   │   ├── controllers/    # 컨트롤러
│   │   ├── middleware/     # 미들웨어
│   │   ├── routes/         # 라우트
│   │   ├── services/       # 비즈니스 로직
│   │   └── utils/          # 유틸리티
│   ├── prisma/             # 데이터베이스 스키마
│   └── server-simple.js    # 간단한 서버
├── frontend/               # 프론트엔드 앱
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── contexts/       # React Context
│   │   ├── services/       # API 서비스
│   │   └── utils/          # 유틸리티
│   └── public/             # 정적 파일
├── contracts/              # 스마트 컨트랙트
├── scripts/                # 배포 및 유틸리티 스크립트
└── test/                   # 테스트 파일
```

## 🔧 주요 스마트 컨트랙트

### KYCVerification.sol

- KYC 상태 관리
- 신원 검증 기능
- 역할 기반 접근 제어

### PropertyToken.sol

- ERC-1400 기반 부동산 토큰
- 배당금 분배
- 투자자 관리

### PropertyRegistry.sol

- 부동산 등록 관리
- 메타데이터 저장
- 소유권 추적

### TradingContract.sol

- 토큰 거래 기능
- 주문장 관리
- 가격 결정 메커니즘

## 📊 API 엔드포인트

### KYC/AML

- `GET /api/kyc/status/:userAddress` - KYC 상태 조회
- `POST /api/kyc/initiate` - KYC 시작
- `POST /api/kyc/transaction-risk` - 거래 위험도 평가

### 부동산

- `GET /api/properties` - 부동산 목록
- `POST /api/properties/register` - 부동산 등록
- `POST /api/properties/:id/tokenize` - 토큰화

### 관리자

- `GET /api/admin/kyc/pending` - 대기 중인 KYC 신청
- `POST /api/admin/kyc/:id/approve` - KYC 승인
- `POST /api/admin/kyc/:id/reject` - KYC 거부

## 🚀 배포

### 개발 환경

```bash
# 모든 서비스 실행
npm run dev:all
```

### 프로덕션 환경

```bash
# 빌드
cd frontend && npm run build
cd backend && npm run build

# 배포
npm run deploy
```

## 🧪 테스트

### WebSocket 테스트

실시간 WebSocket 기능을 테스트하려면:

```bash
# 모든 WebSocket 테스트 실행
npm run websocket:test

# 개별 테스트
npm run websocket:test:basic      # 기본 연결 테스트
npm run websocket:test:price      # 가격 구독 테스트
npm run websocket:test:portfolio  # 포트폴리오 구독 테스트
npm run websocket:test:transaction # 거래 구독 테스트

# 대화형 테스트
npm run websocket:test:interactive
```

자세한 내용은 [WebSocket 테스트 가이드](docs/WEBSOCKET_TESTING.md)를 참조하세요.

### 기타 테스트

```bash
# 스마트 컨트랙트 테스트
npm test

# 통합 테스트
npm run test:integration

# E2E 테스트
npm run test:e2e
```

## 📈 성능 최적화

### 캐싱 시스템

- 메모리 기반 캐싱
- API 응답 캐싱
- 자동 만료 관리

### 성능 모니터링

- 실시간 성능 지표
- 캐시 히트율 추적
- 네트워크 지연 모니터링

## 🔒 보안

- JWT 기반 인증
- 역할 기반 접근 제어
- 입력 검증 및 살균
- Rate Limiting
- CORS 설정

## 🔗 링크

- [Hardhat](https://hardhat.org/) - 블록체인 개발 도구
- [Ethers.js](https://docs.ethers.io/) - 블록체인 라이브러리
- [MUI CSS](https://mui.com/) - CSS 프레임워크
- [IPFS](https://ipfs.io/) - 분산 파일 시스템

## WebSocket 테스트

### 기본 테스트

```bash
# 기본 WebSocket 테스트
npm run websocket:test

# 성능 테스트
npm run websocket:performance

# 고급 테스트 (jq 활용)
npm run websocket:advanced

# jq 사용 예시
./scripts/jq-examples.sh
```

### jq를 활용한 JSON 파싱

프로젝트에서는 `jq`를 활용하여 JSON 응답을 구조적으로 분석하고 파싱합니다.

#### 설치

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

#### 사용 예시

```bash
# 서버 통계 파싱
curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats | jq -r '
    "활성화: " + (.enabled | tostring) +
    "\n총 클라이언트: " + (.totalClients | tostring) +
    "\n가격 구독: " + (.priceSubscriptions | tostring)
'

# JSON 구조 분석
curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats | jq -r 'keys | .[]'

# 성능 메트릭 계산
curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats | jq -r '
    "총 구독: " + (.priceSubscriptions + .portfolioSubscriptions + .transactionSubscriptions | tostring)
'
```

#### 주요 기능

- **구조적 분석**: JSON 키 구조 자동 분석
- **실시간 계산**: 응답 시간, 성공률 등 실시간 계산
- **오류 분석**: 오류 메시지 구조적 파싱
- **설정 모니터링**: 서버 설정 정보 상세 표시
- **성능 추적**: 성능 메트릭 자동 계산
