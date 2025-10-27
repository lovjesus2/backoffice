// src/routes/admin/setting/+page.js

export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!
  
  console.log('✅ 시스템설정 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '시스템설정',
    actionButtons: []
  };
}