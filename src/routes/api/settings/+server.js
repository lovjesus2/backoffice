import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

// 모든 시스템 설정 조회 (관리자만)
export async function GET({ locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
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
export async function PUT({ request, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
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
        const { key, value, type } = setting;
        
        if (!key) {
          throw new Error('설정 키가 필요합니다.');
        }
        
        // 타입에 따른 값 변환
        let finalValue = value;
        switch (type) {
          case 'boolean':
            finalValue = value ? 'true' : 'false';
            break;
          case 'json':
            finalValue = JSON.stringify(value);
            break;
          default:
            finalValue = String(value);
        }
        
        // UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
        await db.execute(`
          INSERT INTO system_settings (setting_key, setting_value, setting_type, updated_by, updated_at)
          VALUES (?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value),
          setting_type = VALUES(setting_type),
          updated_by = VALUES(updated_by),
          updated_at = NOW()
        `, [key, finalValue, type || 'string', user.username]);
      }
      
      // 트랜잭션 커밋
      await db.execute('COMMIT');
      
      return json({
        success: true,
        message: '설정이 성공적으로 업데이트되었습니다.'
      });
      
    } catch (error) {
      // 트랜잭션 롤백
      await db.execute('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    return json({
      success: false,
      message: '설정 업데이트에 실패했습니다: ' + error.message
    }, { status: 500 });
  }
}

// 특정 설정 조회
export async function POST({ request, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { keys } = await request.json();
    
    if (!keys || !Array.isArray(keys)) {
      return json({ error: '조회할 설정 키가 필요합니다.' }, { status: 400 });
    }

    const db = getDb();
    const placeholders = keys.map(() => '?').join(',');
    const [settings] = await db.execute(
      `SELECT * FROM system_settings WHERE setting_key IN (${placeholders})`,
      keys
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
      message: '설정 조회에 실패했습니다: ' + error.message
    }, { status: 500 });
  }
}