#!/bin/bash

# HomeSure 프로젝트 실행 스크립트
# 모든 컴포넌트를 순차적으로 시작합니다.

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

# 프로젝트 루트 디렉토리 확인
if [ ! -f "package.json" ]; then
    log_error "이 스크립트는 프로젝트 루트 디렉토리에서 실행해야 합니다."
    exit 1
fi

log_info "🏠 HomeSure 프로젝트 시작 중..."

# 1. 기존 프로세스 정리
log_info "기존 프로세스 정리 중..."
pkill -f "hardhat node" || true
pkill -f "node src/server-simple.js" || true
pkill -f "npm start" || true
sleep 2

# 2. 의존성 확인
log_info "의존성 확인 중..."
if [ ! -d "node_modules" ]; then
    log_warning "루트 의존성이 설치되지 않았습니다. 설치 중..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    log_warning "백엔드 의존성이 설치되지 않았습니다. 설치 중..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    log_warning "프론트엔드 의존성이 설치되지 않았습니다. 설치 중..."
    cd frontend && npm install && cd ..
fi

# 3. 블록체인 노드 시작
log_info "블록체인 노드 시작 중..."
npx hardhat node --hostname 0.0.0.0 > logs/blockchain.log 2>&1 &
BLOCKCHAIN_PID=$!
sleep 5

# 블록체인 노드 상태 확인
if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 > /dev/null 2>&1; then
    log_success "블록체인 노드가 성공적으로 시작되었습니다. (PID: $BLOCKCHAIN_PID)"
else
    log_error "블록체인 노드 시작에 실패했습니다."
    exit 1
fi

# 4. 스마트 컨트랙트 배포
log_info "스마트 컨트랙트 배포 중..."
npx hardhat run scripts/deploy.ts --network localhost > logs/deployment.log 2>&1
if [ $? -eq 0 ]; then
    log_success "스마트 컨트랙트 배포가 완료되었습니다."
else
    log_error "스마트 컨트랙트 배포에 실패했습니다."
    exit 1
fi

# 5. 백엔드 서버 시작
log_info "백엔드 서버 시작 중..."
cd backend
node src/server-simple.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 3

# 백엔드 서버 상태 확인
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    log_success "백엔드 서버가 성공적으로 시작되었습니다. (PID: $BACKEND_PID)"
else
    log_error "백엔드 서버 시작에 실패했습니다."
    exit 1
fi

# 6. 프론트엔드 시작
log_info "프론트엔드 시작 중..."
cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 10

# 프론트엔드 상태 확인
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    log_success "프론트엔드가 성공적으로 시작되었습니다. (PID: $FRONTEND_PID)"
else
    log_warning "프론트엔드 시작 확인 중... 잠시 기다려주세요."
    sleep 10
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        log_success "프론트엔드가 성공적으로 시작되었습니다. (PID: $FRONTEND_PID)"
    else
        log_error "프론트엔드 시작에 실패했습니다."
        exit 1
    fi
fi

# 7. 통합 테스트 실행
log_info "통합 테스트 실행 중..."
npx hardhat run scripts/simple-integration-test.ts --network localhost > logs/integration-test.log 2>&1
if [ $? -eq 0 ]; then
    log_success "통합 테스트가 성공적으로 완료되었습니다."
else
    log_warning "통합 테스트에 일부 문제가 있을 수 있습니다. 로그를 확인해주세요."
fi

# 8. 서비스 정보 출력
echo ""
log_success "🎉 HomeSure 프로젝트가 성공적으로 시작되었습니다!"
echo ""
echo "📊 서비스 정보:"
echo "  🌐 프론트엔드: http://localhost:3000"
echo "  🔧 백엔드 API: http://localhost:3001"
echo "  ⛓️  블록체인: http://localhost:8545"
echo ""
echo "📁 로그 파일:"
echo "  📄 블록체인: logs/blockchain.log"
echo "  📄 백엔드: logs/backend.log"
echo "  📄 프론트엔드: logs/frontend.log"
echo "  📄 배포: logs/deployment.log"
echo "  📄 테스트: logs/integration-test.log"
echo ""
echo "🛑 프로젝트 중지: ./scripts/stop-project.sh"
echo ""

# PID 파일 저장
echo $BLOCKCHAIN_PID > .pids/blockchain.pid
echo $BACKEND_PID > .pids/backend.pid
echo $FRONTEND_PID > .pids/frontend.pid

log_info "모든 서비스가 백그라운드에서 실행 중입니다."
log_info "브라우저에서 http://localhost:3000 을 열어 HomeSure를 확인하세요!" 