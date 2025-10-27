

// 사용자 관리 페이지는 관리자만 접근 가능
export async function load({ parent }) {
  const { user } = await parent();
  
  // 🎯 미들웨어에서 모든 권한 체크 완료!
  // DB의 role_menu_permissions에서 권한 확인됨
  
  console.log('✅ 사용자 관리 페이지 접근 허용:', user?.username, user?.role);
  
  return {
    pageTitle: '사용자 관리',
    actionButtons: []
  };
}
