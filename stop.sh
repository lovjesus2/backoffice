#!/bin/bash
echo "backoffice 애플리케이션 중지..."

# PM2 프로세스 중지
if command -v pm2 &> /dev/null; then
    pm2 stop backoffice 2>/dev/null || true
    pm2 delete backoffice 2>/dev/null || true
fi

# 직접 실행된 node 프로세스 중지
pkill -f "node build/index.js" 2>/dev/null || true

echo "중지 완료"
