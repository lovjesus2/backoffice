// src/routes/admin/product-management/product-registration/+page.js
import { redirect } from '@sveltejs/kit';

// 제품등록 페이지 접근 권한 체크
export async function load({ parent }) {
  const { user } = await parent();
  
  console.log('제품등록 페이지 접근 시도, user:', user?.username, user?.role);
  
  // 로그인하지 않은 경우 → 루트 페이지로 (실제 로그인 페이지)
  if (!user) {
    console.log('❌ 로그인하지 않은 사용자, 루트 페이지로 리다이렉트');
    throw redirect(302, '/?redirectTo=/admin/product-management/product-registration');
  }
  
  // 로그인된 사용자는 모두 접근 가능 (admin, user 모두)
  // 만약 관리자만 접근하게 하려면 아래 주석을 해제
  if (user.role !== 'admin') {
    console.log('❌ 권한 없음 (', user.role, '), 대시보드로 리다이렉트');
    throw redirect(302, '/admin?error=access_denied');
  }
  
  
  console.log('✅ 제품등록 페이지 접근 허용');
  return {};
}