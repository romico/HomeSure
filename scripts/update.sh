#!/bin/bash
# update.sh

echo "🔄 Git 저장소 업데이트 중..."

# 현재 상태 확인
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  로컬 변경사항이 있습니다. Stash 합니다."
    git stash
    STASHED=true
fi

# 업데이트
echo "📥 원격 변경사항 가져오는 중..."
git fetch origin

echo "🔀 변경사항 병합 중..."
git merge origin/master

# Stash 복원
if [[ $STASHED == true ]]; then
    echo "📤 임시 저장한 변경사항 복원 중..."
    git stash pop
fi

echo "✅ 업데이트 완료!"