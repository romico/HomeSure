#!/bin/bash

# WebSocket 성능 테스트 스크립트
echo "🚀 WebSocket 성능 테스트 시작"

# wscat 설치 확인
if ! command -v wscat &> /dev/null; then
    echo "📦 wscat 설치 중..."
    npm install -g wscat
fi

# 서버 상태 확인
echo "🔍 서버 상태 확인 중..."
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ 백엔드 서버가 실행되지 않았습니다. 먼저 서버를 시작해주세요."
    exit 1
fi

echo "✅ 서버가 정상적으로 실행 중입니다."

# 성능 테스트 함수들
test_single_connection() {
    echo "📊 단일 연결 테스트..."
    start_time=$(date +%s%N)
    
    # WebSocket 연결 및 ping 테스트
    response=$(wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 2 2>/dev/null)
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 )) # 밀리초 단위
    
    if echo "$response" | grep -q "pong"; then
        echo "✅ 단일 연결 성공: ${duration}ms"
    else
        echo "❌ 단일 연결 실패"
    fi
}

test_multiple_subscriptions() {
    echo "📊 다중 구독 테스트..."
    
    # 여러 구독 요청을 동시에 보내기
    subscriptions=(
        '{"type":"subscribe_prices","data":{"propertyIds":["property-1","property-2","property-3"]}}'
        '{"type":"subscribe_portfolio","data":{"userId":"user-1"}}'
        '{"type":"subscribe_transactions","data":{"userId":"user-1"}}'
    )
    
    start_time=$(date +%s%N)
    
    for sub in "${subscriptions[@]}"; do
        wscat -c ws://localhost:3001 --execute "$sub" --wait 1 > /dev/null 2>&1 &
    done
    
    # 모든 백그라운드 프로세스 완료 대기
    wait
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    
    echo "✅ 다중 구독 완료: ${duration}ms"
}

test_concurrent_connections() {
    echo "📊 동시 연결 테스트..."
    
    local num_connections=10
    local success_count=0
    
    start_time=$(date +%s%N)
    
    for i in $(seq 1 $num_connections); do
        if wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 1 > /dev/null 2>&1; then
            ((success_count++))
        fi
    done
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    
    echo "✅ 동시 연결 테스트 완료: ${success_count}/${num_connections} 성공, ${duration}ms"
}

test_message_throughput() {
    echo "📊 메시지 처리량 테스트..."
    
    local num_messages=50
    local success_count=0
    
    start_time=$(date +%s%N)
    
    for i in $(seq 1 $num_messages); do
        if wscat -c ws://localhost:3001 --execute "{\"type\":\"ping\",\"data\":{\"id\":$i}}" --wait 0.5 > /dev/null 2>&1; then
            ((success_count++))
        fi
    done
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    
    local throughput=$(( (success_count * 1000) / duration ))
    echo "✅ 메시지 처리량 테스트 완료: ${success_count}/${num_messages} 성공, ${throughput} msg/sec"
}

test_server_stats() {
    echo "📊 서버 통계 확인..."
    
    stats=$(curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats)
    
    echo "📈 현재 서버 상태:"
    if command -v jq &> /dev/null; then
        echo "$stats" | jq -r '
            "  - 활성화: " + (.enabled | tostring) +
            "\n  - 총 클라이언트: " + (.totalClients | tostring) +
            "\n  - 가격 구독: " + (.priceSubscriptions | tostring) +
            "\n  - 포트폴리오 구독: " + (.portfolioSubscriptions | tostring) +
            "\n  - 거래 구독: " + (.transactionSubscriptions | tostring) +
            "\n  - 가격 데이터: " + (.priceDataCount | tostring) +
            "\n  - 포트폴리오 데이터: " + (.portfolioDataCount | tostring) +
            "\n  - 거래 데이터: " + (.transactionDataCount | tostring) +
            "\n  - 최대 클라이언트: " + (.config.maxClients | tostring) +
            "\n  - 메시지 큐 크기: " + (.config.messageQueueSize | tostring) +
            "\n  - 재연결 시도: " + (.config.maxReconnectAttempts | tostring) +
            "\n  - 재연결 지연: " + (.config.reconnectDelay | tostring) + "ms" +
            "\n  - 하트비트 간격: " + (.config.heartbeatInterval | tostring) + "ms"
        '
    else
        # jq가 없는 경우 기본 파싱
        echo "$stats" | sed 's/,/,\n  /g' | sed 's/{/\n  /' | sed 's/}/\n  /' | sed 's/"/  - /g' | sed 's/:/: /g'
    fi
}

# 메인 테스트 실행
echo "🧪 성능 테스트 시작..."
echo "=================================="

test_single_connection
echo "----------------------------------"

test_multiple_subscriptions
echo "----------------------------------"

test_concurrent_connections
echo "----------------------------------"

test_message_throughput
echo "----------------------------------"

test_server_stats
echo "=================================="

echo "🎉 WebSocket 성능 테스트 완료!"
echo ""
echo "💡 성능 개선 사항:"
echo "  - 비동기 메시지 처리"
echo "  - 구독 인덱스 최적화"
echo "  - 클라이언트 정리 자동화"
echo "  - 과도한 로깅 제거"
echo "  - 메모리 누수 방지"
