// src/routes/admin/+layout.server.js - 표준 패턴
export async function load({ locals }) {
  console.log('Admin 레이아웃: locals.user 확인:', locals.user);
  
  // hooks.server.js에서 설정한 locals 데이터를 그대로 전달
  return {
    user: locals.user
   // user: locals.user || { id: 1, role: 'admin', username: 'test' }
  };
}