import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your-secret-key';

// admin 레이아웃에서 사용자 정보 로드
export async function load({ cookies }) {
  try {
    const token = cookies.get('token'); // 토큰 이름 통일
    console.log('Admin 레이아웃: 토큰 확인 중...', token ? '토큰 있음' : '토큰 없음');
    
    if (!token) {
      console.log('❌ 토큰이 없습니다.');
      return {
        user: null
      };
    }
    
    // JWT 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ 토큰 검증 성공:', decoded.username, decoded.role);
    
    return {
      user: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      }
    };
    
  } catch (error) {
    console.error('토큰 검증 오류:', error.message);
    
    // 잘못된 토큰은 삭제
    cookies.delete('token', { path: '/' });
    
    return {
      user: null
    };
  }
}
