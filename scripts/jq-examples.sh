#!/bin/bash

# jq 사용 예시 스크립트
echo "🔧 jq 사용 예시"

# jq 설치 확인
if ! command -v jq &> /dev/null; then
    echo "❌ jq가 설치되지 않았습니다."
    echo "📦 설치 방법:"
    echo "  macOS: brew install jq"
    echo "  Ubuntu: sudo apt-get install jq"
    echo "  CentOS: sudo yum install jq"
    exit 1
fi

echo "✅ jq가 설치되어 있습니다."

# 서버 상태 확인
echo ""
echo "📊 1. 서버 헬스체크 파싱"
health_response=$(curl -s -H "Accept: application/json" http://localhost:3001/health)
echo "$health_response" | jq -r '
    "서버 상태: " + .status +
    "\n환경: " + .environment +
    "\n업타임: " + (.uptime | tostring) + "초" +
    "\n타임스탬프: " + .timestamp
'

# WebSocket 통계 파싱
echo ""
echo "📊 2. WebSocket 통계 파싱"
stats_response=$(curl -s -H "Accept: application/json" http://localhost:3001/api/websocket/stats)
echo "$stats_response" | jq -r '
    "활성화: " + (.enabled | tostring) +
    "\n총 클라이언트: " + (.totalClients | tostring) +
    "\n가격 구독: " + (.priceSubscriptions | tostring) +
    "\n포트폴리오 구독: " + (.portfolioSubscriptions | tostring) +
    "\n거래 구독: " + (.transactionSubscriptions | tostring)
'

# JSON 구조 분석
echo ""
echo "📊 3. JSON 구조 분석"
echo "최상위 키:"
echo "$stats_response" | jq -r 'keys | .[]' | sed 's/^/  - /'

echo ""
echo "설정 키:"
echo "$stats_response" | jq -r '.config | keys | .[]' | sed 's/^/  - /'

# 설정 정보 상세 파싱
echo ""
echo "📊 4. 설정 정보 상세 파싱"
echo "$stats_response" | jq -r '.config | 
    "최대 클라이언트: " + (.maxClients | tostring) +
    "\n메시지 큐 크기: " + (.messageQueueSize | tostring) +
    "\n재연결 시도: " + (.maxReconnectAttempts | tostring) +
    "\n재연결 지연: " + (.reconnectDelay | tostring) + "ms" +
    "\n하트비트 간격: " + (.heartbeatInterval | tostring) + "ms"
'

# 조건부 파싱 예시
echo ""
echo "📊 5. 조건부 파싱 예시"
echo "$stats_response" | jq -r '
    if .enabled then
        "✅ WebSocket 서비스가 활성화되어 있습니다."
    else
        "❌ WebSocket 서비스가 비활성화되어 있습니다."
    end
'

# 배열 처리 예시
echo ""
echo "📊 6. 배열 처리 예시"
echo "$stats_response" | jq -r '
    "데이터 카운트:"
    + "\n  - 가격 데이터: " + (.priceDataCount | tostring)
    + "\n  - 포트폴리오 데이터: " + (.portfolioDataCount | tostring)
    + "\n  - 거래 데이터: " + (.transactionDataCount | tostring)
'

# 계산 예시
echo ""
echo "📊 7. 계산 예시"
echo "$stats_response" | jq -r '
    "구독 통계:"
    + "\n  - 총 구독: " + (.priceSubscriptions + .portfolioSubscriptions + .transactionSubscriptions | tostring)
    + "\n  - 데이터 총합: " + (.priceDataCount + .portfolioDataCount + .transactionDataCount | tostring)
'

# 색상 출력 예시 (터미널에서)
echo ""
echo "📊 8. 색상 출력 예시"
echo "$stats_response" | jq -r '
    "✅ 활성화: " + (.enabled | tostring) +
    "\n📊 총 클라이언트: " + (.totalClients | tostring) +
    "\n📈 구독 수: " + (.priceSubscriptions + .portfolioSubscriptions + .transactionSubscriptions | tostring)
'

echo ""
echo "🎉 jq 사용 예시 완료!"
echo ""
echo "💡 추가 jq 명령어:"
echo "  - JSON 포맷팅: echo '{}' | jq '.'"
echo "  - 특정 필드 추출: echo '{}' | jq '.field'"
echo "  - 배열 필터링: echo '[]' | jq '.[] | select(.condition)'"
echo "  - JSON 병합: jq -s 'add' file1.json file2.json"
echo "  - JSON 변환: echo '{}' | jq '{new_key: .old_key}'"
