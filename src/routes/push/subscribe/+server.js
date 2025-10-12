// src/routes/api/push/subscribe/+server.js (디버깅 강화)
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    console.log('🔥 [DEBUG] FCM 토큰 저장 API 시작');
    console.log('🔥 [DEBUG] locals.user 존재:', !!locals.user);
    
    const user = locals.user;
    if (!user) {
      console.log('❌ [DEBUG] 인증된 사용자 없음');
      return json({ success: false, message: '인증 필요' }, { status: 401 });
    }

    console.log('🔥 [DEBUG] 인증된 사용자:', user.username, 'ID:', user.id);

    const requestData = await request.json();
    console.log('🔥 [DEBUG] 요청 데이터:', {
      hasToken: !!requestData.token,
      tokenLength: requestData.token?.length,
      hasDeviceInfo: !!requestData.deviceInfo
    });

    const { token, deviceInfo } = requestData;
    
    if (!token) {
      console.log('❌ [DEBUG] FCM 토큰이 없음');
      return json({ success: false, message: '토큰이 필요합니다' }, { status: 400 });
    }

    console.log('🔥 [DEBUG] DB 연결 시도');
    const db = getDb();
    console.log('✅ [DEBUG] DB 연결 성공');

    // 테이블 존재 확인
    try {
      console.log('🔥 [DEBUG] push_subscriptions 테이블 확인');
      await db.execute('SELECT 1 FROM push_subscriptions LIMIT 1');
      console.log('✅ [DEBUG] 테이블 존재함');
    } catch (tableError) {
      console.log('❌ [DEBUG] 테이블 없음, 생성 시도:', tableError.message);
      
      // 테이블 생성
      await db.execute(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          device_token TEXT NOT NULL,
          device_info TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('✅ [DEBUG] 테이블 생성 완료');
    }

    console.log('🔥 [DEBUG] 기존 토큰 확인 쿼리 실행');
    const [existing] = await db.execute(
      'SELECT id FROM push_subscriptions WHERE user_id = ? AND device_token = ?',
      [user.id, token]
    );
    console.log('🔥 [DEBUG] 기존 토큰 검색 결과:', existing.length);

    if (existing.length === 0) {
      console.log('🔥 [DEBUG] 새 토큰 등록 시도');
      await db.execute(
        'INSERT INTO push_subscriptions (user_id, device_token, device_info) VALUES (?, ?, ?)',
        [user.id, token, JSON.stringify(deviceInfo || {})]
      );
      console.log('✅ [DEBUG] 새 토큰 등록 성공');
    } else {
      console.log('ℹ️ [DEBUG] 토큰이 이미 존재함, 업데이트');
      await db.execute(
        'UPDATE push_subscriptions SET device_info = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND device_token = ?',
        [JSON.stringify(deviceInfo || {}), user.id, token]
      );
      console.log('✅ [DEBUG] 토큰 업데이트 완료');
    }

    console.log('🎉 [DEBUG] API 성공 완료');
    return json({ success: true, message: '구독 등록 완료' });
    
  } catch (error) {
    console.error('❌ [DEBUG] API 오류 발생:');
    console.error('❌ [DEBUG] 오류 메시지:', error.message);
    console.error('❌ [DEBUG] 오류 스택:', error.stack);
    console.error('❌ [DEBUG] 오류 코드:', error.code);
    
    return json({ 
      success: false, 
      message: `서버 오류: ${error.message}`,
      debug: {
        errorCode: error.code,
        errorMessage: error.message
      }
    }, { status: 500 });
  }
}