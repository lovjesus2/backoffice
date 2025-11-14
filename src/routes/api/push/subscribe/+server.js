// src/routes/api/push/subscribe/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    console.log('🔥 FCM 토큰 관리 API 시작');
    
    const user = locals.user;
    if (!user) {
      console.log('❌ 인증된 사용자 없음');
      return json({ success: false, message: '인증 필요' }, { status: 401 });
    }

    console.log('🔥 인증된 사용자:', user.username, 'Role:', user.role);

    const { token, deviceInfo } = await request.json();
    
    if (!token) {
      console.log('❌ FCM 토큰이 없음');
      return json({ success: false, message: '토큰이 필요합니다' }, { status: 400 });
    }

    const db = getDb();

    if (user.role === 'user') {
      // user 로그인 시 해당 토큰 삭제
      console.log('🔥 user 로그인 - 토큰 삭제 시도');
      await db.execute('DELETE FROM push_subscriptions WHERE device_token = ?', [token]);
      console.log('✅ user 토큰 삭제 완료');
      return json({ success: true, message: 'user 토큰 삭제 완료' });
      
    } else if (user.role === 'admin') {
      // admin 로그인 시 토큰 저장/업데이트
      console.log('🔥 admin 로그인 - 토큰 저장 시도');
      await db.execute(`
        INSERT INTO push_subscriptions (device_token, device_info) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE 
        device_info = VALUES(device_info),
        updated_at = CURRENT_TIMESTAMP
      `, [token, JSON.stringify(deviceInfo || {})]);
      
      console.log('✅ admin 토큰 저장 완료');
      return json({ success: true, message: 'admin 토큰 등록 완료' });
    } else {
      console.log('❌ 알 수 없는 role:', user.role);
      return json({ success: false, message: '알 수 없는 권한입니다' }, { status: 403 });
    }
    
  } catch (error) {
    console.error('❌ 토큰 관리 API 오류:', error);
    return json({ 
      success: false, 
      message: `서버 오류: ${error.message}`
    }, { status: 500 });
  }
}