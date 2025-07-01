import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb } from '$lib/database.js';

// GET: 현재 사용자 프로필 조회
export async function GET({ locals }) {
  try {
    // 미들웨어에서 검증된 사용자 정보 사용
    const user = locals.user;

    const db = getDb();
    
    const [rows] = await db.execute(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [user.id]
    );

    if (rows.length === 0) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: 프로필 정보 수정
export async function PUT({ request, locals }) {
  try {
    // 미들웨어에서 검증된 사용자 정보 사용
    const user = locals.user;

    const { username, email } = await request.json();
    
    if (!username || !username.trim()) {
      return json({ error: '사용자명은 필수입니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // 중복 사용자명/이메일 확인 (자신 제외)
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
      [username, email || '', user.id]
    );
    
    if (existing.length > 0) {
      return json({ error: '이미 사용 중인 사용자명 또는 이메일입니다.' }, { status: 400 });
    }

    // 프로필 정보 업데이트
    await db.execute(
      'UPDATE users SET username = ?, email = ? WHERE id = ?',
      [username, email || null, user.id]
    );

    // 업데이트된 정보 조회
    const [updated] = await db.execute(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [user.id]
    );

    return json({
      success: true,
      message: '프로필이 수정되었습니다.',
      data: updated[0]
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    return json({ error: '프로필 수정에 실패했습니다.' }, { status: 500 });
  }
}
