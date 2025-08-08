#!/bin/bash

# HomeSure 프로젝트 중지 스크립트
# 모든 실행 중인 컴포넌트를 안전하게 중지합니다.

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

log_info "🛑 HomeSure 프로젝트 중지 중..."

# PID 파일 디렉토리 생성
mkdir -p .pids

# 1. PID 파일에서 프로세스 중지
if [ -f ".pids/frontend.pid" ]; then
    FRONTEND_PID=$(cat .pids/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        log_info "프론트엔드 프로세스 중지 중... (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID
        sleep 2
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            log_warning "프론트엔드 프로세스 강제 종료 중..."
            kill -9 $FRONTEND_PID
        fi
        log_success "프론트엔드가 중지되었습니다."
    else
        log_warning "프론트엔드 프로세스가 이미 종료되었습니다."
    fi
    rm -f .pids/frontend.pid
fi

if [ -f ".pids/backend.pid" ]; then
    BACKEND_PID=$(cat .pids/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        log_info "백엔드 프로세스 중지 중... (PID: $BACKEND_PID)"
        kill $BACKEND_PID
        sleep 2
        if kill -0 $BACKEND_PID 2>/dev/null; then
            log_warning "백엔드 프로세스 강제 종료 중..."
            kill -9 $BACKEND_PID
        fi
        log_success "백엔드가 중지되었습니다."
    else
        log_warning "백엔드 프로세스가 이미 종료되었습니다."
    fi
    rm -f .pids/backend.pid
fi

if [ -f ".pids/blockchain.pid" ]; then
    BLOCKCHAIN_PID=$(cat .pids/blockchain.pid)
    if kill -0 $BLOCKCHAIN_PID 2>/dev/null; then
        log_info "블록체인 노드 중지 중... (PID: $BLOCKCHAIN_PID)"
        kill $BLOCKCHAIN_PID
        sleep 2
        if kill -0 $BLOCKCHAIN_PID 2>/dev/null; then
            log_warning "블록체인 노드 강제 종료 중..."
            kill -9 $BLOCKCHAIN_PID
        fi
        log_success "블록체인 노드가 중지되었습니다."
    else
        log_warning "블록체인 노드가 이미 종료되었습니다."
    fi
    rm -f .pids/blockchain.pid
fi

# 2. 추가 프로세스 정리
log_info "추가 프로세스 정리 중..."

# Hardhat 노드 프로세스 정리
pkill -f "hardhat node" || true

# Node.js 서버 프로세스 정리
pkill -f "node src/server-simple.js" || true

# React 개발 서버 프로세스 정리
pkill -f "npm start" || true
pkill -f "react-scripts start" || true

# 포트 사용 확인 및 정리
log_info "포트 사용 상태 확인 중..."

# 3000번 포트 (프론트엔드)
if lsof -ti:3000 > /dev/null 2>&1; then
    log_warning "포트 3000이 여전히 사용 중입니다. 강제 종료 중..."
    lsof -ti:3000 | xargs kill -9
fi

# 3001번 포트 (백엔드)
if lsof -ti:3001 > /dev/null 2>&1; then
    log_warning "포트 3001이 여전히 사용 중입니다. 강제 종료 중..."
    lsof -ti:3001 | xargs kill -9
fi

# 8545번 포트 (블록체인)
if lsof -ti:8545 > /dev/null 2>&1; then
    log_warning "포트 8545가 여전히 사용 중입니다. 강제 종료 중..."
    lsof -ti:8545 | xargs kill -9
fi

# 3. 로그 디렉토리 정리
if [ -d "logs" ]; then
    log_info "로그 파일 정리 중..."
    # 오늘 날짜로 로그 백업
    TODAY=$(date +%Y%m%d)
    if [ ! -d "logs/backup" ]; then
        mkdir -p logs/backup
    fi
    
    # 오늘 생성된 로그 파일들을 백업
    find logs -name "*.log" -newermt "$TODAY" -exec mv {} logs/backup/ \; 2>/dev/null || true
    
    log_success "로그 파일이 백업되었습니다."
fi

# 4. 임시 파일 정리
log_info "임시 파일 정리 중..."
rm -rf .pids/* 2>/dev/null || true

# 5. 완료 메시지
echo ""
log_success "🎉 HomeSure 프로젝트가 성공적으로 중지되었습니다!"
echo ""
echo "📊 정리된 항목:"
echo "  🛑 프론트엔드 서버 (포트 3000)"
echo "  🛑 백엔드 API 서버 (포트 3001)"
echo "  🛑 블록체인 노드 (포트 8545)"
echo "  📁 로그 파일 백업"
echo "  🗂️  임시 파일 정리"
echo ""
echo "🚀 프로젝트 재시작: ./scripts/start-project.sh"
echo "" 