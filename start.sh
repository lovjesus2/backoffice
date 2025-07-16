#!/bin/bash
cd /volume1/web/backoffice

# 환경 변수 로드
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# PM2가 설치되어 있으면 PM2로 실행, 아니면 직접 실행
if command -v pm2 &> /dev/null; then
    echo "PM2로 애플리케이션 시작..."
    pm2 start ecosystem.config.js
else
    echo "직접 애플리케이션 시작..."
    node build/index.js
fi
