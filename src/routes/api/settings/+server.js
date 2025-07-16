import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { getDb } from '$lib/database.js';

const JWT_SECRET = 'your-secret-key';

// 모든 시스템 설정 조회 (관리자만)
export async function GET({ cookies }) {
  try {
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const db = getDb();
    const [settings] = await db.execute(
      'SELECT * FROM system_settings ORDER BY setting_key'
    );

    // 타입에 따른 값 변환
    const processedSettings = settings.map(setting => {
      let value = setting.setting_value;
      
      switch (setting.setting_type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true';
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = null;
          }
          break;
      }
      
      return {
        ...setting,
        parsed_value: value
      };
    });

    return json({
      success: true,
      data: processedSettings
    });
    
  } catch (error) {
    console.error('설정 조회 오류:', error);
    return json({
      success: false,
      message: '설정을 가져올 수 없습니다.'
    }, { status: 500 });
  }
}

// 시스템 설정 업데이트 (관리자만)
export async function PUT({ request, cookies }) {
  try {
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
        const { setting_key, setting_value, setting_type } = setting;
        
        // 값 검증 및 변환
        let processedValue = setting_value;
        
        switch (setting_type) {
          case 'number':
            if (isNaN(Number(setting_value))) {
              throw new Error(`${setting_key}: 숫자 값이 필요합니다.`);
            }
            processedValue = String(Number(setting_value));
            break;
          case 'boolean':
            if (typeof setting_value !== 'boolean') {
              throw new Error(`${setting_key}: 불린 값이 필요합니다.`);
            }
            processedValue = String(setting_value);
            break;
          case 'json':
            try {
              if (typeof setting_value === 'object') {
                processedValue = JSON.stringify(setting_value);
              } else {
                JSON.parse(setting_value); // 검증
                processedValue = setting_value;
              }
            } catch (e) {
              throw new Error(`${setting_key}: 올바른 JSON 형식이 필요합니다.`);
            }
            break;
          default:
            processedValue = String(setting_value);
        }
        
        // 설정 업데이트
        await db.execute(
          'UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
          [processedValue, setting_key]
        );
      }
      
      await db.execute('COMMIT');
      
      return json({
        success: true,
        message: '설정이 성공적으로 업데이트되었습니다.'
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    return json({
      success: false,
      message: error.message || '설정 업데이트에 실패했습니다.'
    }, { status: 500 });
  }
}
