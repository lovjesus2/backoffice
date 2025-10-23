// src/routes/admin/menu-management/+page.js

export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!
  // 메뉴 관리는 관리자만 접근 가능
  
  console.log('✅ 메뉴 관리 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '메뉴 관리',
    actionButtons: []
  };
}