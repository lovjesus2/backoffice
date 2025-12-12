import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { findUser, getDb } from '$lib/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
        const { username, password, deviceType } = await request.json(); // ← deviceType 추가
        
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
        
        
        // 디바이스 타입에 따라 세션 타임아웃 설정
        let sessionTimeoutHours;
        if (deviceType === 'mobile') {
            sessionTimeoutHours = 720; // 모바일: 30일
            console.log('모바일 로그인 - 세션 타임아웃: 720시간 (30일)');
        } else {
            sessionTimeoutHours = await getSessionTimeout(); // 웹: DB 설정값
            console.log(`웹 로그인 - 세션 타임아웃: ${sessionTimeoutHours}시간 (${sessionTimeoutHours/24}일)`);
        }
        const sessionTimeoutSeconds = sessionTimeoutHours * 60 * 60;

        console.log(`세션 타임아웃: ${sessionTimeoutHours}시간 (${sessionTimeoutHours/24}일)`);
        
        // JWT 토큰 생성 (720시간 사용)
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role,
                deviceType: deviceType // ← deviceType도 토큰에 포함 (선택사항) 
            },
            JWT_SECRET,
            { expiresIn: sessionTimeoutSeconds } // 720시간 = 30일
        );
        
        // 쿠키에 토큰 설정 (720시간 사용)
        cookies.set('token', token, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: sessionTimeoutSeconds, // 720시간 = 30일
            // 즉시 적용을 위한 설정
            encode: false
        });
        
        return json({
            success: true,
            message: '로그인 성공',
            token, // 클라이언트용 토큰 추가
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