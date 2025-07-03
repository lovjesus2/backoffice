#!/bin/bash
cd /volume1/web/backoffice

echo "데이터베이스 초기화 시작..."

node -e "
import('./src/lib/database.js').then(db => {
    console.log('데이터베이스 연결 테스트...');
    return db.testConnection();
}).then(connected => {
    if (connected) {
        console.log('✅ 데이터베이스 연결 성공');
        return import('./src/lib/database.js').then(db => db.initializeDatabase());
    } else {
        throw new Error('데이터베이스 연결 실패');
    }
}).then(() => {
    console.log('✅ 데이터베이스 초기화 완료');
    console.log('기본 관리자 계정: admin / admin123!');
    process.exit(0);
}).catch(err => {
    console.error('❌ 오류:', err.message);
    process.exit(1);
});
"
