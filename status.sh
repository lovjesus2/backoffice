#!/bin/bash
echo "=== BackOffice 상태 확인 ==="

echo "1. 프로세스 상태:"
if command -v pm2 &> /dev/null; then
    pm2 list | grep backoffice
else
    ps aux | grep "node build/index.js" | grep -v grep
fi

echo -e "\n2. 포트 사용 상태:"
netstat -tlnp | grep :3001

echo -e "\n3. 서비스 응답 테스트:"
curl -s http://localhost:3001/api/health || echo "서비스 응답 없음"

echo -e "\n4. 로그 (마지막 10줄):"
if [ -f /var/log/backoffice.log ]; then
    tail -10 /var/log/backoffice.log
else
    echo "로그 파일 없음"
fi
