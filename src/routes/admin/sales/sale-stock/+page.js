
// ===== 1. src/routes/admin/sales/sale-stock/+page.js =====
import { error } from '@sveltejs/kit';

export async function load({ fetch, parent }) {
  await parent(); // 부모 레이아웃에서 권한 체크
  
  return {
    title: '제품 검색 & 재고 관리'
  };
}