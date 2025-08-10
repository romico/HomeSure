#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG() { echo "[BUILD] $*"; }

LOG "통합 빌드 시작"

# 1) Backend
LOG "백엔드 의존성 설치 및 Prisma 클라이언트 생성"
cd "$ROOT_DIR/backend"
npm install --no-audit --no-fund --silent --production=false
npx --yes prisma generate

# 2) Root deps (Hardhat 등 devDependencies 포함)
LOG "루트 의존성 설치 (devDependencies 포함)"
cd "$ROOT_DIR"
npm install --no-audit --no-fund --silent --production=false

# 3) Contracts (Hardhat)
LOG "스마트 컨트랙트 컴파일"
npx --yes hardhat compile

# 4) Frontend
LOG "프론트엔드 의존성 설치 및 프로덕션 빌드"
cd "$ROOT_DIR/frontend"
npm install --no-audit --no-fund --silent
npm run build --silent

LOG "통합 빌드 완료"
LOG "프론트엔드 빌드 산출물: $ROOT_DIR/frontend/build"

