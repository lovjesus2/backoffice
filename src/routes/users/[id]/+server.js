import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';
import bcrypt from 'bcryptjs';

// 사용자 상세 조회 - 미들웨어에서 admin 권한 체크됨
export async function GET({ params, locals }) {
  try {
    // 미들웨어에서 admin 권한이 이미 체크됨
    const user = locals.user;

    const db = getDb();
    const [rows] = await db.execute(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [params.id]
    );

    if (rows.length === 0) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return json({ 
      success: true,
      user: rows[0] 
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 사용자 정보 수정 - 미들웨어에서 admin 권한 체크됨
export async function PUT({ params, request, locals }) {
  try {
    // 미들웨어에서 admin 권한이 이미 체크됨
    const user = locals.user;

    const { username, email, role, password } = await request.json();
    
    const db = getDb();
    const [existing] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [params.id]
    );
    
    if (existing.length === 0) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    let updateFields = [];
    let updateValues = [];
    
    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }
    
    updateValues.push(params.id);
    
    await db.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    return json({ 
      success: true, 
      message: '사용자 정보가 수정되었습니다.' 
    });

  } catch (error) {
    console.error('사용자 수정 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 사용자 삭제 - 미들웨어에서 admin 권한 체크됨
export async function DELETE({ params, locals }) {
  try {
    // 미들웨어에서 admin 권한이 이미 체크됨
    const currentUser = locals.user;

    if (parseInt(params.id) === currentUser.id) {
      return json({ error: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 });
    }
    
    const db = getDb();
    const [result] = await db.execute(
      'DELETE FROM users WHERE id = ?',
      [params.id]
    );

    if (result.affectedRows === 0) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return json({ 
      success: true, 
      message: '사용자가 삭제되었습니다.' 
    });

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
