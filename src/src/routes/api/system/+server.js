import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { getDb } from '$lib/database.js';
import { clearSettingsCache } from '$lib/utils/systemSettings.js';

const JWT_SECRET = 'your-secret-key';

// 값 타입 변환 함수
function convertValue(value, type) {
  if (value === null) return null;
  
  switch (type) {
    case 'number':
      return parseFloat(value);
    case 'boolean':
      return value === 'true' || value === '1';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

// 시스템 설정 조회
export async function GET({ cookies, url }) {
  try {
    console.log('🔧 시스템 API 호출됨');
    
    const mode = url.searchParams.get('mode');
    console.log('모드:', mode);
    
    // info 모드 - 로그인한 사용자용 (보안 강화)
    if (mode === 'info') {
      console.log('📋 시스템 정보 모드 (보안 강화)');
      
      // 토큰 검증 필요
      const token = cookies.get('token');
      if (!token) {
        return json({ error: '인증이 필요합니다.' }, { status: 401 });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ 인증 성공:', decoded.username);
      
      const db = getDb();
      const [rows] = await db.execute(
        'SELECT setting_key, setting_value, setting_type FROM system_settings WHERE is_public = 1 ORDER BY setting_key'
      );
      
      const settings = {};
      rows.forEach(row => {
        const { setting_key, setting_value, setting_type } = row;
        settings[setting_key] = convertValue(setting_value, setting_type);
      });
      
      // 보안 강화된 시스템 정보
      const systemInfo = {
        ...settings,
        server_time: new Date().toISOString(),
        user_role: decoded.role
      };
      
      console.log('✅ 보안 강화된 시스템 정보 반환 완료');
      return json({
        success: true,
        data: systemInfo
      });
    }
    
    // 일반 설정 조회는 인증 필요
    const token = cookies.get('token');
    if (!token) {
      console.log('❌ 인증 토큰 없음');
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ 인증 성공:', decoded.username);
    
    const db = getDb();
    const key = url.searchParams.get('key');
    
    let query, params;
    if (key) {
      // 특정 설정 조회
      query = 'SELECT * FROM system_settings WHERE setting_key = ?';
      params = [key];
    } else {
      // 전체 설정 조회 (role에 따라 필터링)
      if (decoded.role === 'admin') {
        query = 'SELECT * FROM system_settings ORDER BY setting_key';
        params = [];
      } else {
        query = 'SELECT * FROM system_settings WHERE is_public = 1 ORDER BY setting_key';
        params = [];
      }
    }
    
    const [rows] = await db.execute(query, params);
    
    if (key && rows.length === 0) {
      return json({ error: '설정을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 값 타입에 따른 변환
    const settings = rows.map(row => ({
      ...row,
      setting_value: convertValue(row.setting_value, row.setting_type)
    }));
    
    console.log('✅ 설정 조회 완료, 개수:', settings.length);
    
    return json({ 
      success: true, 
      data: key ? settings[0] : settings 
    });

  } catch (error) {
    console.error('❌ 시스템 설정 조회 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 시스템 설정 수정 (관리자만)
export async function PUT({ request, cookies }) {
  try {
    console.log('🔧 시스템 설정 수정 API 호출됨');
    
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { settings } = await request.json();
    
    if (!settings || !Array.isArray(settings)) {
      return json({ error: '올바른 설정 데이터가 필요합니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    
    try {
      for (const setting of settings) {
        const { setting_key, setting_value } = setting;
        
        await db.execute(
          'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
          [String(setting_value), setting_key]
        );
      }
      
      await db.execute('COMMIT');
      
      // 🔄 캐시 무효화 (중요!)
      clearSettingsCache();
      console.log('🗑️ 설정 캐시 무효화 완료');
      
      console.log('✅ 설정 저장 완료');
      return json({ 
        success: true, 
        message: '설정이 저장되고 시스템에 적용되었습니다.' 
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ 시스템 설정 수정 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST({ request, cookies }) {
  try {
    console.log('🔧 시스템 설정 추가 API 호출됨');
    
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { setting_key, setting_value, setting_type, description, is_public } = await request.json();
    
    if (!setting_key || setting_value === undefined) {
      return json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const db = getDb();
    
    await db.execute(
      'INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES (?, ?, ?, ?, ?)',
      [setting_key, String(setting_value), setting_type || 'string', description || '', is_public ? 1 : 0]
    );

    // 🔄 캐시 무효화
    clearSettingsCache();

    console.log('✅ 새 설정 추가 완료');
    return json({ 
      success: true, 
      message: '새 설정이 추가되었습니다.' 
    });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return json({ error: '이미 존재하는 설정 키입니다.' }, { status: 400 });
    }
    
    console.error('❌ 시스템 설정 추가 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
