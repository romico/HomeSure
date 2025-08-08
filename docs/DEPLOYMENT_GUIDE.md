# HomeSure 실제 네트워크 배포 가이드

## 📋 개요

이 문서는 HomeSure 블록체인 기반 부동산 토큰화 플랫폼을 실제 네트워크(Sepolia, Polygon Mumbai, Mainnet)에 배포하는 방법을 설명합니다.

## 🚀 배포 전 준비사항

### 1. 환경 변수 설정

`.env` 파일에 다음 정보를 설정해야 합니다:

```bash
# 네트워크 RPC URL
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
POLYGON_MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_INFURA_PROJECT_ID
POLYGON_MAINNET_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# 배포자 프라이빗 키 (절대 공개하지 마세요!)
PRIVATE_KEY=your_actual_private_key_here

# API 키들
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# 기타 서비스 API 키들
INFURA_PROJECT_ID=your_infura_project_id
INFURA_PROJECT_SECRET=your_infura_project_secret
```

### 2. 필수 서비스 계정

- **Infura**: 이더리움 노드 제공
- **Etherscan**: 컨트랙트 검증
- **Polygonscan**: 폴리곤 컨트랙트 검증
- **IPFS**: 메타데이터 저장 (Infura IPFS 또는 Pinata)

### 3. 지갑 준비

- **Sepolia 테스트넷**: 최소 0.1 ETH
- **Polygon Mumbai**: 최소 0.1 MATIC
- **Mainnet**: 충분한 ETH/MATIC (가스비용)

## 🔧 배포 단계

### 1단계: Sepolia 테스트넷 배포

```bash
# Sepolia에 배포
npm run deploy:testnet

# 또는 직접 실행
npx hardhat run scripts/deploy.ts --network sepolia
```

### 2단계: 컨트랙트 검증

```bash
# Sepolia 컨트랙트 검증
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS [constructor_args]

# 예시:
npx hardhat verify --network sepolia 0x1234... KYCVerification_address
```

### 3단계: Polygon Mumbai 배포

```bash
# Polygon Mumbai에 배포
npx hardhat run scripts/deploy.ts --network polygon-mumbai
```

### 4단계: 메인넷 배포 (최종)

```bash
# 이더리움 메인넷 배포
npx hardhat run scripts/deploy.ts --network mainnet

# 폴리곤 메인넷 배포
npx hardhat run scripts/deploy.ts --network polygon
```

## 📊 배포된 컨트랙트 주소 관리

배포 후 `deployment.json` 파일이 생성되며, 다음과 같은 정보가 포함됩니다:

```json
{
  "network": "sepolia",
  "deployer": "0x...",
  "timestamp": "2025-08-05T...",
  "contracts": {
    "KYCVerification": "0x...",
    "PropertyToken": "0x...",
    "PropertyOracle": "0x...",
    "PropertyValuation": "0x...",
    "PropertyRegistry": "0x...",
    "TradingContract": "0x..."
  }
}
```

## 🔍 배포 후 검증

### 1. 컨트랙트 기능 테스트

```bash
# Sepolia에서 통합 테스트
npx hardhat run scripts/simple-integration-test.ts --network sepolia

# 거래 시스템 테스트
npx hardhat run scripts/test-trading-system.ts --network sepolia
```

### 2. 프론트엔드 설정 업데이트

`frontend/src/config/contracts.ts` 파일을 업데이트:

```typescript
export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    contracts: {
      KYCVerification: '0x...',
      PropertyToken: '0x...',
      // ... 기타 컨트랙트 주소
    }
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    contracts: {
      // ... 메인넷 컨트랙트 주소
    }
  }
};
```

### 3. 백엔드 환경 변수 업데이트

`backend/.env` 파일 업데이트:

```bash
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
CHAIN_ID=11155111
KYC_VERIFICATION_ADDRESS=0x...
PROPERTY_TOKEN_ADDRESS=0x...
```

## 🛡️ 보안 고려사항

### 1. 프라이빗 키 보안

- **절대 코드에 하드코딩하지 마세요**
- **환경 변수로만 관리**
- **백업은 안전한 곳에 보관**

### 2. 멀티시그 지갑 사용

프로덕션 환경에서는 멀티시그 지갑 사용을 권장합니다:

```solidity
// 멀티시그 지갑 설정
const multiSigWallet = await MultiSigWallet.deploy([owner1, owner2, owner3], 2);
```

### 3. 컨트랙트 업그레이드

업그레이드 가능한 컨트랙트 사용:

```bash
# 프록시 패턴으로 배포
npx hardhat run scripts/deploy-with-proxy.ts --network sepolia
```

## 📈 모니터링 및 유지보수

### 1. 블록 익스플로러 모니터링

- **Etherscan**: 이더리움 네트워크
- **Polygonscan**: 폴리곤 네트워크
- **트랜잭션 실패 모니터링**
- **가스비 사용량 추적**

### 2. 로그 모니터링

```bash
# 로그 확인
tail -f logs/deployment.log

# 에러 로그 필터링
grep "ERROR" logs/deployment.log
```

### 3. 성능 모니터링

- **가스비 최적화**
- **트랜잭션 처리 시간**
- **네트워크 혼잡도**

## 🚨 문제 해결

### 일반적인 문제들

1. **가스비 부족**
   ```bash
   # 가스비 확인
   npx hardhat run scripts/check-balance.ts --network sepolia
   ```

2. **컨트랙트 크기 초과**
   - 옵티마이저 설정 확인
   - 불필요한 코드 제거
   - 라이브러리 사용

3. **네트워크 연결 실패**
   - RPC URL 확인
   - 네트워크 상태 확인
   - 대체 RPC 제공자 사용

## 📞 지원

배포 중 문제가 발생하면:

1. **로그 확인**: `logs/deployment.log`
2. **네트워크 상태 확인**: 각 블록 익스플로러
3. **커뮤니티 지원**: GitHub Issues
4. **기술 지원**: 개발팀 연락

## 🎯 다음 단계

배포 완료 후:

1. **사용자 테스트 진행**
2. **성능 최적화**
3. **보안 감사**
4. **마케팅 및 런칭**

---

**⚠️ 중요**: 실제 네트워크 배포는 되돌릴 수 없습니다. 충분한 테스트 후 진행하세요! 