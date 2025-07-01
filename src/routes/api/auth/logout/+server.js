import { json } from '@sveltejs/kit';

export async function POST({ cookies }) {
  try {
    console.log('로그아웃 API 호출됨');
    
    // 토큰 쿠키 삭제 (이름 통일)
    cookies.delete('token', { path: '/' });
    cookies.set('token', '', { 
      path: '/', 
      expires: new Date(0),
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });
    
    console.log('쿠키 삭제 완료');
    
    return json({ 
      success: true,
      message: '로그아웃 되었습니다.'
    });
  } catch (error) {
    console.error('로그아웃 처리 오류:', error);
    return json({ 
      success: false, 
      message: '로그아웃 처리 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
