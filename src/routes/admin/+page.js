
// src/routes/admin/+page.js
export async function load({ parent }) {
  const data = await parent();
  
  console.log('🏠 대시보드 +page.js 데이터:', data);
  
  return {
    ...data,
    pageTitle: '대시보드',
    actionButtons: []
  };
}