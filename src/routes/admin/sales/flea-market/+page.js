import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';

export const load = async ({ parent }) => {
  // 부모 레이아웃에서 사용자 정보 가져오기
  const { user } = await parent();
  
  // 사용자가 로그인되어 있지 않으면 로그인 페이지로 리디렉션
  if (!user) {
    throw redirect(302, '/');
  }
  
  // 프리마켓 접근 권한 체크 (admin 또는 user 모두 접근 가능)
  if (user.role !== 'admin' && user.role !== 'user') {
    throw redirect(302, '/admin');
  }
  
  return {
    user
  };
};