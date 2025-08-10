#!/bin/bash

# WebSocket 검증 스크립트 (wscat 사용)
# HomeSure 프로젝트용 WebSocket 테스트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 설정
WEBSOCKET_URL="ws://localhost:3001"
API_URL="http://localhost:3001"

# wscat 설치 확인
check_wscat() {
    if ! command -v wscat &> /dev/null; then
        log_error "wscat이 설치되지 않았습니다."
        log_info "설치 중: npm install -g wscat"
        npm install -g wscat
        log_success "wscat 설치 완료"
    else
        log_success "wscat이 이미 설치되어 있습니다."
    fi
}

# 서버 상태 확인
check_server() {
    log_info "서버 상태 확인 중..."
    if curl -s -H "Accept: application/json" "$API_URL/health" > /dev/null; then
        log_success "서버가 실행 중입니다."
        return 0
    else
        log_error "서버가 실행되지 않았습니다."
        log_info "서버를 먼저 시작해주세요: ./scripts/start-project.sh"
        return 1
    fi
}

# 기본 연결 테스트
test_basic_connection() {
    log_info "기본 연결 테스트..."
    
    local output=$(wscat -c "$WEBSOCKET_URL" --execute '{"type":"ping"}' --wait 3 2>&1)
    
    if echo "$output" | grep -q "connection_established"; then
        log_success "기본 연결 성공"
        echo "$output" | grep -E "(connection_established|pong)"
        return 0
    else
        log_error "기본 연결 실패"
        echo "$output"
        return 1
    fi
}

# 가격 구독 테스트
test_price_subscription() {
    log_info "가격 구독 테스트..."
    
    local output=$(wscat -c "$WEBSOCKET_URL" --execute '{"type":"subscribe_prices","data":{"propertyIds":["property-1","property-2"]}}' --wait 5 2>&1)
    
    if echo "$output" | grep -q "price_update"; then
        log_success "가격 구독 성공"
        echo "$output" | grep "price_update" | head -2
        return 0
    else
        log_error "가격 구독 실패"
        echo "$output"
        return 1
    fi
}

# 포트폴리오 구독 테스트
test_portfolio_subscription() {
    log_info "포트폴리오 구독 테스트..."
    
    local output=$(wscat -c "$WEBSOCKET_URL" --execute '{"type":"subscribe_portfolio","data":{"userId":"user-1"}}' --wait 5 2>&1)
    
    if echo "$output" | grep -q "portfolio_update"; then
        log_success "포트폴리오 구독 성공"
        echo "$output" | grep "portfolio_update" | head -1
        return 0
    else
        log_error "포트폴리오 구독 실패"
        echo "$output"
        return 1
    fi
}

# 거래 구독 테스트
test_transaction_subscription() {
    log_info "거래 구독 테스트..."
    
    local output=$(wscat -c "$WEBSOCKET_URL" --execute '{"type":"subscribe_transactions","data":{"userId":"user-1"}}' --wait 8 2>&1)
    
    if echo "$output" | grep -q "transaction_update"; then
        log_success "거래 구독 성공"
        echo "$output" | grep "transaction_update" | head -3
        return 0
    else
        log_error "거래 구독 실패"
        echo "$output"
        return 1
    fi
}

# 구독 해제 테스트
test_unsubscribe() {
    log_info "구독 해제 테스트..."
    
    local output=$(wscat -c "$WEBSOCKET_URL" \
        --execute '{"type":"subscribe_prices","data":{"propertyIds":["property-1"]}}' \
        --execute '{"type":"unsubscribe_prices","data":{"propertyIds":["property-1"]}}' \
        --wait 3 2>&1)
    
    if echo "$output" | grep -q "connection_established"; then
        log_success "구독 해제 테스트 완료"
        return 0
    else
        log_error "구독 해제 테스트 실패"
        echo "$output"
        return 1
    fi
}

# 에러 처리 테스트
test_error_handling() {
    log_info "에러 처리 테스트..."
    
    local output=$(wscat -c "$WEBSOCKET_URL" --execute '{"type":"unknown_message_type"}' --wait 2 2>&1)
    
    if echo "$output" | grep -q "error"; then
        log_success "에러 처리 정상 작동"
        echo "$output" | grep "error"
        return 0
    else
        log_warning "에러 응답이 없습니다 (정상일 수 있음)"
        return 0
    fi
}

# 대화형 테스트 모드
interactive_mode() {
    log_info "대화형 WebSocket 테스트 모드 시작..."
    log_info "연결 URL: $WEBSOCKET_URL"
    log_info "종료하려면 Ctrl+C를 누르세요."
    echo
    
    wscat -c "$WEBSOCKET_URL" --show-ping-pong
}

# 메인 함수
main() {
    echo "🔌 HomeSure WebSocket 검증 스크립트 (wscat 사용)"
    echo "================================================"
    
    # wscat 설치 확인
    check_wscat
    
    # 서버 상태 확인
    if ! check_server; then
        exit 1
    fi
    
    # 명령행 인수 처리
    case "${1:-all}" in
        "basic")
            test_basic_connection
            ;;
        "price")
            test_price_subscription
            ;;
        "portfolio")
            test_portfolio_subscription
            ;;
        "transaction")
            test_transaction_subscription
            ;;
        "unsubscribe")
            test_unsubscribe
            ;;
        "error")
            test_error_handling
            ;;
        "interactive")
            interactive_mode
            ;;
        "all")
            log_info "모든 테스트 실행 중..."
            
            test_basic_connection && echo
            test_price_subscription && echo
            test_portfolio_subscription && echo
            test_transaction_subscription && echo
            test_unsubscribe && echo
            test_error_handling && echo
            
            log_success "모든 테스트 완료!"
            ;;
        *)
            echo "사용법: $0 [test_type]"
            echo ""
            echo "테스트 타입:"
            echo "  basic        - 기본 연결 테스트"
            echo "  price        - 가격 구독 테스트"
            echo "  portfolio    - 포트폴리오 구독 테스트"
            echo "  transaction  - 거래 구독 테스트"
            echo "  unsubscribe  - 구독 해제 테스트"
            echo "  error        - 에러 처리 테스트"
            echo "  interactive  - 대화형 모드"
            echo "  all          - 모든 테스트 (기본값)"
            echo ""
            echo "예시:"
            echo "  $0 basic"
            echo "  $0 interactive"
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"
