import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';



// 시스템 정보 조회 (인증된 사용자만)
export async function GET({ locals }) {
  try {  // 🆕 try 문 추가!
    console.log('📋 시스템 정보 API 호출됨 (보안 강화됨)');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }
    
    const db = getDb();
    const [rows] = await db.execute(
      'SELECT setting_key, setting_value, setting_type FROM system_settings WHERE is_public = 1 ORDER BY setting_key'
    );
    
    const settings = {};
    rows.forEach(row => {
      const { setting_key, setting_value, setting_type } = row;
      
      switch (setting_type) {
        case 'number':
          settings[setting_key] = parseFloat(setting_value);
          break;
        case 'boolean':
          settings[setting_key] = setting_value === 'true' || setting_value === '1';
          break;
        case 'json':
          try {
            settings[setting_key] = JSON.parse(setting_value);
          } catch {
            settings[setting_key] = setting_value;
          }
          break;
        default:
          settings[setting_key] = setting_value;
      }
    });
    
    // 🔒 민감한 정보 제거한 안전한 시스템 정보
    const systemInfo = {
      ...settings,
      server_time: new Date().toISOString(),
      // version 제거 (보안)
      // environment 제거 (보안)
      user_role: user.role  // 🆕 decoded.role 대신 user.role
    };
    
    console.log('✅ 안전한 시스템 정보 반환 완료');
    return json({
      success: true,
      data: systemInfo
    });

  } catch (error) {
    console.error('❌ 시스템 정보 조회 오류:', error);
    return json({ 
      success: false,
      error: '시스템 정보를 불러올 수 없습니다.' 
    }, { status: 500 });
  }
}
