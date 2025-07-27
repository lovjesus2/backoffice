// src/routes/admin/sales/flea-market/+page.js
import { redirect } from '@sveltejs/kit';

export async function load({ fetch, url }) {
  try {
    // 사용자 인증 상태 확인
    const response = await fetch('/api/auth/me');
    
    if (!response.ok) {
      throw redirect(302, '/');
    }

    const { user } = await response.json();
    
    if (!user) {
      throw redirect(302, '/');
    }

    // 프리마켓 페이지는 로그인한 사용자라면 접근 가능
    // (관리자/일반 사용자 모두 접근 가능)
    
    return {
      user
    };
  } catch (error) {
    if (error.status === 302) {
      throw error;
    }
    
    console.error('프리마켓 페이지 로드 오류:', error);
    throw redirect(302, '/');
  }
}