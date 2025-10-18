import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { findUser, getDb } from '$lib/database.js';

const JWT_SECRET = 'your-secret-key';

// 시스템 설정에서 세션 타임아웃 조회
async function getSessionTimeout() {
  try {
    const db = getDb();
    const [rows] = await db.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      ['session_timeout']
    );
    
    return rows.length > 0 ? parseInt(rows[0].setting_value) : 168; // 기본값 168시간
  } catch (error) {
    console.error('세션 타임아웃 조회 실패:', error);
    return 168;
  }
}

export async function POST({ request, cookies }) {
    try {
        const { username, password } = await request.json();
        
        console.log('로그인 시도:', username);
        
        const user = await findUser(username, password);
        
        if (!user) {
            console.log('로그인 실패');
            return json({ 
                success: false, 
                message: '사용자명 또는 비밀번호가 잘못되었습니다.' 
            }, { status: 401 });
        }
        
        console.log('로그인 성공:', user.username, user.role);
        
        // DB에서 세션 타임아웃 가져오기 (720시간)
        const sessionTimeoutHours = await getSessionTimeout();
        const sessionTimeoutSeconds = sessionTimeoutHours * 60 * 60;
        
        console.log(`세션 타임아웃: ${sessionTimeoutHours}시간 (${sessionTimeoutHours/24}일)`);
        
        // JWT 토큰 생성 (720시간 사용)
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: sessionTimeoutSeconds } // 720시간 = 30일
        );
        
        // 쿠키에 토큰 설정 (720시간 사용)
        cookies.set('token', token, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: sessionTimeoutSeconds // 720시간 = 30일
        });
        
        return json({
            success: true,
            message: '로그인 성공',
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('로그인 오류:', error);
        return json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        }, { status: 500 });
    }
}