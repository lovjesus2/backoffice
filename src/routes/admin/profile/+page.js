// src/routes/admin/profile/+page.js

export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!
  // 프로필은 로그인한 모든 사용자 접근 가능
  
  console.log('✅ 프로필 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '내 정보',
    actionButtons: []
  };
}
