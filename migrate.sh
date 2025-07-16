#!/bin/bash

# admin-proxy → SvelteKit 원클릭 마이그레이션 스크립트

set -e  # 오류 발생시 스크립트 중단

echo "🚀 admin-proxy → SvelteKit 마이그레이션 시작"
echo "================================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 현재 디렉토리 확인
if [ ! -f "package.json" ]; then
    log_error "package.json이 없습니다. /volume1/web/backoffice 디렉토리에서 실행해주세요."
    exit 1
fi

# 1. 환경 변수 설정
echo "1️⃣  환경 변수 설정 중..."
if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
JWT_SECRET=backoffice-super-secret-key-change-in-production-$(date +%s)
DB_HOST=localhost
DB_PORT=21379
DB_USER=kimhojun
DB_PASSWORD=Rlaghwns2@
DB_NAME=HOJUN
NODE_ENV=production
PORT=3001
ENVEOF
    chmod 600 .env
    log_info "환경 변수 파일 생성 완료"
else
    log_warning "기존 .env 파일 사용"
fi

# 2. 빌드
echo "2️⃣  애플리케이션 빌드 중..."
if npm run build; then
    log_info "빌드 완료"
else
    log_error "빌드 실패"
    exit 1
fi

# 3. 데이터베이스 초기화
echo "3️⃣  데이터베이스 초기화 중..."
if node -e "
import('./src/lib/database.js').then(db => {
    return db.initializeDatabase();
}).then(() => {
    console.log('데이터베이스 초기화 완료');
    process.exit(0);
}).catch(err => {
    console.error('데이터베이스 오류:', err.message);
    process.exit(1);
});
"; then
    log_info "데이터베이스 초기화 완료"
else
    log_error "데이터베이스 초기화 실패"
    exit 1
fi

# 4. admin-proxy 중지
echo "4️⃣  admin-proxy 중지 중..."
if pgrep -f admin-proxy > /dev/null; then
    pkill -f admin-proxy
    sleep 2
    if pgrep -f admin-proxy > /dev/null; then
        log_warning "admin-proxy가 여전히 실행 중입니다"
        ps aux | grep admin-proxy | grep -v grep
    else
        log_info "admin-proxy 중지 완료"
    fi
else
    log_info "admin-proxy가 실행되지 않음"
fi

# 5. 기존 SvelteKit 프로세스 중지
echo "5️⃣  기존 프로세스 정리 중..."
if pgrep -f "node build/index.js" > /dev/null; then
    pkill -f "node build/index.js"
    sleep 2
    log_info "기존 프로세스 중지 완료"
fi

# 6. SvelteKit 시작
echo "6️⃣  SvelteKit 애플리케이션 시작 중..."
nohup npm start > /var/log/backoffice.log 2>&1 &
sleep 3

# 시작 확인
if pgrep -f "node build/index.js" > /dev/null; then
    PID=$(pgrep -f "node build/index.js")
    log_info "SvelteKit 시작 완료 (PID: $PID)"
else
    log_error "SvelteKit 시작 실패"
    echo "로그 확인:"
    tail -20 /var/log/backoffice.log
    exit 1
fi

# 7. 포트 확인
echo "7️⃣  포트 확인 중..."
sleep 2
if netstat -tlnp | grep :3001 > /dev/null; then
    log_info "포트 3001 바인딩 완료"
else
    log_error "포트 3001 바인딩 실패"
    exit 1
fi

# 8. 헬스 체크
echo "8️⃣  헬스 체크 중..."
for i in {1..10}; do
    if curl -s http://localhost:3001/api/health > /dev/null; then
        log_info "애플리케이션 정상 작동 확인"
        break
    fi
    if [ $i -eq 10 ]; then
        log_error "헬스 체크 실패"
        echo "로그 확인:"
        tail -20 /var/log/backoffice.log
        exit 1
    fi
    sleep 1
done

# 9. 최종 상태 출력
echo ""
echo "🎉 마이그레이션 완료!"
echo "================================================"
echo ""
echo "📊 현재 상태:"
echo "   프로세스: $(ps aux | grep "node build/index.js" | grep -v grep | awk '{print "PID " $2}')"
echo "   포트: $(netstat -tlnp | grep :3001 | awk '{print $4}')"
echo "   헬스: $(curl -s http://localhost:3001/api/health | jq -r '.status' 2>/dev/null || echo 'OK')"
echo ""
echo "🔧 다음 단계 (수동 작업 필요):"
echo "   1. DSM 관리자 로그인"
echo "   2. Web Station > 웹 서비스 포털"
echo "   3. 포트 8285 포털 편집"
echo "   4. '뒤 URL'을 'http://localhost:3001'로 변경"
echo ""
echo "🌐 접속 정보:"
echo "   외부 URL: https://your-domain.com/admin"
echo "   사용자명: admin"
echo "   비밀번호: admin123!"
echo ""
echo "📝 로그 확인:"
echo "   tail -f /var/log/backoffice.log"
echo ""
echo "================================================"

