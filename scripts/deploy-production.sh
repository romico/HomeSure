#!/bin/bash

# HomeSure 프로덕션 배포 스크립트
# 사용법: ./scripts/deploy-production.sh [network]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 환경 변수 확인
check_env() {
    log_info "환경 변수 확인 중..."
    
    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
        "PRIVATE_KEY"
        "INFURA_PROJECT_ID"
        "INFURA_PROJECT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "필수 환경 변수가 설정되지 않았습니다: $var"
            exit 1
        fi
    done
    
    # WebSocket 관련 환경 변수 확인
    if [ -z "$WEBSOCKET_ENABLED" ]; then
        log_warning "WEBSOCKET_ENABLED가 설정되지 않았습니다. 기본값 'true'를 사용합니다."
        export WEBSOCKET_ENABLED=true
    fi
    
    if [ -z "$WEBSOCKET_HEARTBEAT_INTERVAL" ]; then
        log_warning "WEBSOCKET_HEARTBEAT_INTERVAL가 설정되지 않았습니다. 기본값 '30000'을 사용합니다."
        export WEBSOCKET_HEARTBEAT_INTERVAL=30000
    fi
    
    log_success "환경 변수 확인 완료"
}

# 의존성 설치
install_dependencies() {
    log_info "의존성 설치 중..."
    
    # 루트 의존성
    npm install
    
    # 백엔드 의존성
    cd backend
    npm install
    cd ..
    
    # 프론트엔드 의존성
    cd frontend
    npm install --legacy-peer-deps
    cd ..
    
    log_success "의존성 설치 완료"
}

# 데이터베이스 마이그레이션
run_migrations() {
    log_info "데이터베이스 마이그레이션 실행 중..."
    
    cd backend
    npx prisma migrate deploy
    npx prisma generate
    cd ..
    
    log_success "데이터베이스 마이그레이션 완료"
}

# 스마트 컨트랙트 배포
deploy_contracts() {
    local network=${1:-"sepolia"}
    
    log_info "스마트 컨트랙트 배포 중... (네트워크: $network)"
    
    # 컨트랙트 컴파일
    npx hardhat compile
    
    # 컨트랙트 배포
    npx hardhat run scripts/deploy.ts --network $network
    
    log_success "스마트 컨트랙트 배포 완료"
}

# 프론트엔드 빌드
build_frontend() {
    log_info "프론트엔드 빌드 중..."
    
    cd frontend
    
    # 환경 변수 설정
    echo "REACT_APP_API_URL=$API_URL" > .env.production
    echo "REACT_APP_WEBSOCKET_URL=$WEBSOCKET_URL" >> .env.production
    echo "REACT_APP_CHAIN_ID=$CHAIN_ID" >> .env.production
    echo "REACT_APP_NETWORK_NAME=$NETWORK_NAME" >> .env.production
    echo "REACT_APP_ENABLE_ANALYTICS=true" >> .env.production
    echo "REACT_APP_ENABLE_DEBUG_MODE=false" >> .env.production
    
    # 프로덕션 빌드
    npm run build
    
    cd ..
    
    log_success "프론트엔드 빌드 완료"
}

# 백엔드 빌드
build_backend() {
    log_info "백엔드 빌드 중..."
    
    cd backend
    
    # 환경별 설정 파일 복사
    if [ -f ".env.${NODE_ENV:-production}" ]; then
        log_info "환경별 설정 파일 복사: .env.${NODE_ENV:-production}"
        cp ".env.${NODE_ENV:-production}" .env.production
    else
        log_warning "환경별 설정 파일이 없습니다: .env.${NODE_ENV:-production}"
        log_info "기본 .env 파일을 사용합니다"
    fi
    
    # TypeScript 컴파일 (필요한 경우)
    if [ -f "tsconfig.json" ]; then
        npx tsc
    fi
    
    cd ..
    
    log_success "백엔드 빌드 완료"
}

# Docker 이미지 빌드 (선택사항)
build_docker() {
    if [ "$USE_DOCKER" = "true" ]; then
        log_info "Docker 이미지 빌드 중..."
        
        # 백엔드 이미지
        docker build -t homesure-backend ./backend
        
        # 프론트엔드 이미지
        docker build -t homesure-frontend ./frontend
        
        log_success "Docker 이미지 빌드 완료"
    fi
}

# 배포 검증
verify_deployment() {
    log_info "배포 검증 중..."
    
    # API 헬스체크
    if curl -f -s "$API_URL/health" > /dev/null; then
        log_success "API 서버 정상 작동"
    else
        log_error "API 서버 연결 실패"
        exit 1
    fi
    
    # 프론트엔드 접근 확인
    if curl -f -s "$FRONTEND_URL" > /dev/null; then
        log_success "프론트엔드 정상 접근"
    else
        log_error "프론트엔드 접근 실패"
        exit 1
    fi
    
    log_success "배포 검증 완료"
}

# 메인 배포 프로세스
main() {
    local network=${1:-"sepolia"}
    
    log_info "HomeSure 프로덕션 배포 시작 (네트워크: $network)"
    
    # 1. 환경 변수 확인
    check_env
    
    # 2. 의존성 설치
    install_dependencies
    
    # 3. 데이터베이스 마이그레이션
    run_migrations
    
    # 4. 스마트 컨트랙트 배포
    deploy_contracts $network
    
    # 5. 백엔드 빌드
    build_backend
    
    # 6. 프론트엔드 빌드
    build_frontend
    
    # 7. Docker 이미지 빌드 (선택사항)
    build_docker
    
    # 8. 배포 검증
    verify_deployment
    
    log_success "HomeSure 프로덕션 배포 완료!"
    log_info "프론트엔드: $FRONTEND_URL"
    log_info "API 서버: $API_URL"
    log_info "네트워크: $network"
}

# 스크립트 실행
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "HomeSure 프로덕션 배포 스크립트"
    echo ""
    echo "사용법: $0 [network]"
    echo ""
    echo "네트워크 옵션:"
    echo "  sepolia     - Sepolia 테스트넷 (기본값)"
    echo "  polygon     - Polygon 메인넷"
    echo "  ethereum    - Ethereum 메인넷"
    echo ""
    echo "환경 변수:"
    echo "  DATABASE_URL           - PostgreSQL 연결 문자열"
    echo "  REDIS_URL             - Redis 연결 문자열"
    echo "  JWT_SECRET            - JWT 시크릿 키"
    echo "  PRIVATE_KEY           - 블록체인 지갑 개인키"
    echo "  INFURA_PROJECT_ID     - Infura 프로젝트 ID"
    echo "  INFURA_PROJECT_SECRET - Infura 프로젝트 시크릿"
    echo "  API_URL               - API 서버 URL"
    echo "  WEBSOCKET_URL         - WebSocket 서버 URL"
    echo "  FRONTEND_URL          - 프론트엔드 URL"
    echo "  CHAIN_ID              - 블록체인 네트워크 ID"
    echo "  NETWORK_NAME          - 블록체인 네트워크 이름"
    echo "  WEBSOCKET_ENABLED     - WebSocket 활성화 여부 (true/false)"
    echo "  WEBSOCKET_HEARTBEAT_INTERVAL - WebSocket Heartbeat 간격 (ms)"
    echo "  USE_DOCKER            - Docker 사용 여부 (true/false)"
    exit 0
fi

# 메인 함수 실행
main "$@" 