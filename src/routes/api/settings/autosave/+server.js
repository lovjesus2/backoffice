import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET({ cookies }) {
  try {
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    jwt.verify(token, JWT_SECRET);
    
    const db = getDb();
    const [rows] = await db.execute(`
      SELECT setting_key, setting_value, setting_type 
      FROM system_settings 
      WHERE setting_key IN ('autosave_enabled', 'autosave_expiry_hours', 'autosave_cleanup_on_refresh', 'autosave_target_menus')
    `);
    
    const config = {};
    rows.forEach(row => {
      if (row.setting_type === 'boolean') {
        config[row.setting_key] = row.setting_value === 'true';
      } else if (row.setting_type === 'number') {
        config[row.setting_key] = parseInt(row.setting_value);
      } else if (row.setting_type === 'json') {
        config[row.setting_key] = JSON.parse(row.setting_value);
      } else {
        config[row.setting_key] = row.setting_value;
      }
    });
    
    return json({ success: true, config });
  } catch (error) {
    return json({ error: '설정 로드 실패' }, { status: 500 });
  }
}