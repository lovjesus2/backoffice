import { redirect } from '@sveltejs/kit';

// 관리자 영역은 로그인한 사용자만 접근 가능
export async function load({ parent, url }) {
  const { user } = await parent();
  
  console.log('admin 페이지 접근 시도, user:', user?.username, user?.role);
  
  // 로그인하지 않은 경우 → 루트 페이지로 (실제 로그인 페이지)
  if (!user) {
    console.log('❌ 로그인하지 않은 사용자, 루트 페이지로 리다이렉트');
    throw redirect(302, '/?redirectTo=/admin');
  }
  
  // 접근 거부 에러 파라미터 처리
  const error = url.searchParams.get('error');
  let errorMessage = '';
  if (error === 'access_denied') {
    errorMessage = '해당 페이지에 접근할 권한이 없습니다.';
  }
  
  console.log('✅ 로그인된 사용자 접근 허용 (', user.role, ')');
  
  return {
    user,
    errorMessage
  };
}
