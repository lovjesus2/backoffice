import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { findUser } from '$lib/database.js';

const JWT_SECRET = 'your-secret-key';

export async function POST({ request, cookies }) {
    try {
        const { username, password } = await request.json();
        
        console.log('🔍 로그인 시도:', username);
        
        // database.js의 findUser 함수 사용
        const user = await findUser(username, password);
        
        if (!user) {
            console.log('❌ 로그인 실패');
            return json({ 
                success: false, 
                message: '사용자명 또는 비밀번호가 잘못되었습니다.' 
            }, { status: 401 });
        }
        
        console.log('✅ 로그인 성공:', user.username, user.role);
        
        // JWT 토큰 생성
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // 쿠키에 토큰 설정
        cookies.set('token', token, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
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
