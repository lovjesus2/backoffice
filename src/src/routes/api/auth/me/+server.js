import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ locals }) {
  try {
    // 미들웨어에서 검증된 사용자 정보 사용
    const user = locals.user;
    
    if (!user) {
      return json({ error: '인증 정보가 없습니다.' }, { status: 401 });
    }

    const db = getDb();
    const [rows] = await db.execute(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [user.id]
    );

    if (rows.length === 0) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, { status: 401 });
    }

    return json({ 
      success: true,
      user: rows[0] 
    });
    
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
