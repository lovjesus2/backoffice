// src/routes/admin/+layout.server.js
console.log('🚀 파일이 로드되었습니다!');

export async function load({ locals }) {
  console.log('🔍 [layout.server.js] 함수 실행됨!');
  console.log('🔍 [layout.server.js] locals.user:', locals.user);
  
  return {
    user: locals.user || { id: 999, username: 'test', role: 'admin' }
  };
}