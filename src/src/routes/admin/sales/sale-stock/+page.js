// src/routes/admin/sales/sale-stock/+page.js
import { redirect } from '@sveltejs/kit';

// 제품 검색 & 재고 관리는 로그인한 사용자 모두 접근 가능
export async function load({ parent }) {
  const { user } = await parent();
  
  console.log('sale-stock 페이지 접근 시도, user:', user?.username, user?.role);
  
  // 로그인하지 않은 경우 → 루트 페이지로
  if (!user) {
    console.log('❌ 로그인하지 않은 사용자, 루트 페이지로 리다이렉트');
    throw redirect(302, '/?redirectTo=/admin/sales/sale-stock');
  }
  
  // 로그인된 사용자는 모두 접근 가능 (admin, user 둘 다)
  console.log('✅ 사용자 접근 허용 (', user.role, ')');
  
  return {
    user
  };
}