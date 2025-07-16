import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';
import bcrypt from 'bcryptjs';

// 사용자 목록 조회 - 미들웨어에서 admin 권한 체크됨
export async function GET({ url, locals }) {
  try {
    // 미들웨어에서 admin 권한이 이미 체크됨
    const user = locals.user;

    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    
    const db = getDb();
    
    let query = 'SELECT id, username, email, role, created_at FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    let params = [];
    
    if (search) {
      query += ' WHERE username LIKE ? OR email LIKE ?';
      countQuery += ' WHERE username LIKE ? OR email LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [users] = await db.execute(query, params);
    const [countResult] = await db.execute(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
    
    return json({
      success: true,
      users,
      total: countResult[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult[0].total / limit)
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 새 사용자 생성 - 미들웨어에서 admin 권한 체크됨
export async function POST({ request, locals }) {
  try {
    // 미들웨어에서 admin 권한이 이미 체크됨
    const user = locals.user;

    const { username, email, password, role } = await request.json();
    
    if (!username || !password) {
      return json({ error: '사용자명과 비밀번호는 필수입니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // 중복 사용자 확인
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email || '']
    );
    
    if (existing.length > 0) {
      return json({ error: '이미 존재하는 사용자명 또는 이메일입니다.' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [username, email || null, hashedPassword, role || 'user']
    );

    return json({ 
      success: true, 
      message: '사용자가 생성되었습니다.',
      userId: result.insertId 
    });

  } catch (error) {
    console.error('사용자 생성 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
