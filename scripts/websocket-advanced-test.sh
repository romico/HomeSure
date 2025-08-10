#!/bin/bash

# jq를 활용한 고급 WebSocket 테스트 스크립트
echo "🚀 jq 기반 고급 WebSocket 테스트 시작"

# jq 설치 확인
if ! command -v jq &> /dev/null; then
    echo "📦 jq 설치 중..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y jq
    else
        echo "❌ jq 설치를 위해 수동으로 설치해주세요: https://stedolan.github.io/jq/download/"
        exit 1
    fi
fi

# 서버 상태 확인
echo "🔍 서버 상태 확인 중..."
health_response=$(curl -s -H "Accept: application/json" http://localhost:3001/health)
if [ $? -ne 0 ]; then
    echo "❌ 백엔드 서버가 실행되지 않았습니다. 먼저 서버를 시작해주세요."
    exit 1
fi

# jq로 헬스체크 응답 파싱
server_status=$(echo "$health_response" | jq -r '.status')
if [ "$server_status" = "OK" ]; then
    echo "✅ 서버가 정상적으로 실행 중입니다."
    echo "📊 서버 정보:"
    echo "$health_response" | jq -r '
        "  - 상태: " + .status +
        "\n  - 환경: " + .environment +
        "\n  - 업타임: " + (.uptime | tostring) + "초" +
        "\n  - 타임스탬프: " + .timestamp
    '
else
    echo "❌ 서버 상태가 비정상입니다: $server_status"
    exit 1
fi

# 고급 테스트 함수들
test_json_parsing() {
    echo "📊 JSON 파싱 테스트..."
    
    # WebSocket 통계 가져오기
    stats_response=$(curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats)
    
    echo "🔍 JSON 구조 분석:"
    echo "$stats_response" | jq -r '
        "  - 최상위 키: " + (keys | join(", ")) +
        "\n  - 설정 키: " + (.config | keys | join(", "))
    '
    
    echo "📈 상세 통계:"
    echo "$stats_response" | jq -r '
        "  - 활성화: " + (.enabled | tostring) +
        "\n  - 총 클라이언트: " + (.totalClients | tostring) +
        "\n  - 가격 구독: " + (.priceSubscriptions | tostring) +
        "\n  - 포트폴리오 구독: " + (.portfolioSubscriptions | tostring) +
        "\n  - 거래 구독: " + (.transactionSubscriptions | tostring) +
        "\n  - 가격 데이터: " + (.priceDataCount | tostring) +
        "\n  - 포트폴리오 데이터: " + (.portfolioDataCount | tostring) +
        "\n  - 거래 데이터: " + (.transactionDataCount | tostring)
    '
    
    echo "⚙️ 설정 정보:"
    echo "$stats_response" | jq -r '.config | 
        "  - 최대 클라이언트: " + (.maxClients | tostring) +
        "\n  - 메시지 큐 크기: " + (.messageQueueSize | tostring) +
        "\n  - 재연결 시도: " + (.maxReconnectAttempts | tostring) +
        "\n  - 재연결 지연: " + (.reconnectDelay | tostring) + "ms" +
        "\n  - 하트비트 간격: " + (.heartbeatInterval | tostring) + "ms"
    '
}

test_websocket_connection_with_json() {
    echo "📊 WebSocket 연결 테스트 (JSON 응답 분석)..."
    
    # WebSocket 연결 및 응답 캡처
    response=$(wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 2 2>/dev/null)
    
    if echo "$response" | jq -e '.type == "pong"' > /dev/null 2>&1; then
        echo "✅ WebSocket 연결 성공!"
        echo "📄 응답 분석:"
        echo "$response" | jq -r '
            "  - 메시지 타입: " + .type +
            "\n  - 타임스탬프: " + (.data.timestamp | tostring) +
            "\n  - 응답 시간: " + ((now * 1000 - .data.timestamp) | tostring) + "ms"
        '
    else
        echo "❌ WebSocket 연결 실패 또는 잘못된 응답"
        echo "📄 원시 응답: $response"
    fi
}

test_multiple_subscriptions_with_analysis() {
    echo "📊 다중 구독 테스트 (응답 분석)..."
    
    # 구독 전 통계
    stats_before=$(curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats)
    echo "📈 구독 전 상태:"
    echo "$stats_before" | jq -r '
        "  - 총 클라이언트: " + (.totalClients | tostring) +
        "\n  - 가격 구독: " + (.priceSubscriptions | tostring) +
        "\n  - 포트폴리오 구독: " + (.portfolioSubscriptions | tostring) +
        "\n  - 거래 구독: " + (.transactionSubscriptions | tostring)
    '
    
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
    
    # 구독 후 통계
    sleep 2
    stats_after=$(curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats)
    
    echo "📈 구독 후 상태:"
    echo "$stats_after" | jq -r '
        "  - 총 클라이언트: " + (.totalClients | tostring) +
        "\n  - 가격 구독: " + (.priceSubscriptions | tostring) +
        "\n  - 포트폴리오 구독: " + (.portfolioSubscriptions | tostring) +
        "\n  - 거래 구독: " + (.transactionSubscriptions | tostring)
    '
    
    echo "✅ 다중 구독 완료: ${duration}ms"
}

test_performance_metrics() {
    echo "📊 성능 메트릭 테스트..."
    
    # 성능 테스트 실행
    local num_tests=10
    local total_time=0
    local success_count=0
    
    for i in $(seq 1 $num_tests); do
        start_time=$(date +%s%N)
        
        if wscat -c ws://localhost:3001 --execute '{"type":"ping"}' --wait 1 > /dev/null 2>&1; then
            end_time=$(date +%s%N)
            duration=$(( (end_time - start_time) / 1000000 ))
            total_time=$((total_time + duration))
            ((success_count++))
        fi
    done
    
    # 통계 계산
    if [ $success_count -gt 0 ]; then
        avg_time=$((total_time / success_count))
        success_rate=$(( (success_count * 100) / num_tests ))
        
        echo "📈 성능 메트릭:"
        echo "  - 총 테스트: $num_tests"
        echo "  - 성공: $success_count"
        echo "  - 성공률: ${success_rate}%"
        echo "  - 평균 응답 시간: ${avg_time}ms"
        echo "  - 총 소요 시간: ${total_time}ms"
    else
        echo "❌ 모든 테스트 실패"
    fi
}

test_error_handling() {
    echo "📊 오류 처리 테스트..."
    
    # 잘못된 메시지 전송
    echo "🔍 잘못된 메시지 테스트:"
    invalid_response=$(wscat -c ws://localhost:3001 --execute '{"type":"invalid_type"}' --wait 1 2>/dev/null)
    
    if echo "$invalid_response" | jq -e '.type == "error"' > /dev/null 2>&1; then
        echo "✅ 오류 처리 정상:"
        echo "$invalid_response" | jq -r '
            "  - 오류 타입: " + .type +
            "\n  - 오류 메시지: " + .data.message
        '
    else
        echo "❌ 오류 처리 실패"
        echo "📄 응답: $invalid_response"
    fi
    
    # 잘못된 JSON 형식 테스트
    echo "🔍 잘못된 JSON 형식 테스트:"
    malformed_response=$(wscat -c ws://localhost:3001 --execute '{"type":"ping"' --wait 1 2>/dev/null)
    echo "📄 응답: $malformed_response"
}

# 메인 테스트 실행
echo "🧪 고급 성능 테스트 시작..."
echo "=================================="

test_json_parsing
echo "----------------------------------"

test_websocket_connection_with_json
echo "----------------------------------"

test_multiple_subscriptions_with_analysis
echo "----------------------------------"

test_performance_metrics
echo "----------------------------------"

test_error_handling
echo "=================================="

echo "🎉 jq 기반 고급 WebSocket 테스트 완료!"
echo ""
echo "💡 jq 활용 개선사항:"
echo "  - JSON 구조 분석"
echo "  - 상세한 통계 파싱"
echo "  - 성능 메트릭 계산"
echo "  - 오류 응답 분석"
echo "  - 실시간 데이터 추출"
