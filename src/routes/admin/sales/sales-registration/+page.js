// src/routes/admin/sales/sales-registration/+page.js
export async function load({ parent }) {
  const data = await parent();
  
  console.log('🔍 클라이언트 전용 로드:', data);
  
  return {
    ...data,
    pageTitle: '매출등록',
    actionButtons: []
  };
}