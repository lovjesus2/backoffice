import { redirect } from '@sveltejs/kit';

// 시스템 설정 페이지는 관리자만 접근 가능
export async function load({ parent }) {
  const { user } = await parent();
  
  console.log('settings 페이지 접근 시도, user:', user?.username, user?.role);
  
  // 로그인하지 않은 경우 → 루트 페이지로 (실제 로그인 페이지)
  if (!user) {
    console.log('❌ 로그인하지 않은 사용자, 루트 페이지로 리다이렉트');
    throw redirect(302, '/?redirectTo=/admin/settings');
  }
  
  // 관리자가 아닌 경우 → admin 대시보드로
  if (user.role !== 'admin') {
    console.log('❌ 권한 없음 (', user.role, '), 대시보드로 리다이렉트');
    throw redirect(302, '/admin?error=access_denied');
  }
  
  console.log('✅ 관리자 접근 허용');
  return {};
}
