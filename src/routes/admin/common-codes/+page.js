// src/routes/admin/common-codes/+page.js

export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!
  
  console.log('✅ 공통코드 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '공통코드 관리',
    actionButtons: []
  };
}