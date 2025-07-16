import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb } from '$lib/database.js';

// POST: 비밀번호 변경
export async function POST({ request, locals }) {
  try {
    console.log('🔐 비밀번호 변경 API 호출됨');
    
    // 미들웨어에서 검증된 사용자 정보 사용
    const user = locals.user;
    if (!user) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();
    
    console.log('사용자:', user.username);
    
    // 입력 검증
    if (!currentPassword || !newPassword || !confirmPassword) {
      return json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return json({ error: '새 비밀번호가 일치하지 않습니다.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // 현재 사용자 정보 조회
    const [users] = await db.execute(
      'SELECT id, username, password FROM users WHERE id = ?',
      [user.id]
    );

    if (users.length === 0) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const userData = users[0];
    
    // 현재 비밀번호 확인
    const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, userData.password);
    if (!isCurrentPasswordValid) {
      console.log('❌ 현재 비밀번호 불일치');
      return json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
    }

    // 새 비밀번호 해시화
    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    
    // 비밀번호 업데이트
    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, user.id]
    );

    console.log('✅ 비밀번호 변경 완료:', userData.username);
    
    return json({ 
      success: true, 
      message: '비밀번호가 성공적으로 변경되었습니다.' 
    });

  } catch (error) {
    console.error('❌ 비밀번호 변경 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
