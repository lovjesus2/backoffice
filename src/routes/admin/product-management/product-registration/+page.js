// src/routes/admin/product-management/product-registration/+page.js
export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!
  // DB에서 '/admin/product-management/product-registration' 경로 권한 확인됨
  
  console.log('✅ 제품등록 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '제품등록',
    actionButtons: []
  };
}