// src/routes/admin/sales/sale01/+page.js
export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!

  
  console.log('✅ 매출분석 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '매출분석',
    actionButtons: []
  };
}