// 📁 파일: src/routes/api/product-management/product-stock/search/+server.js
// 전체 파일을 이 코드로 교체하세요

import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== Product Search API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const searchTerm = url.searchParams.get('search_term') || '';
    const searchType = url.searchParams.get('search_type') || 'name';
    const discontinuedFilter = url.searchParams.get('discontinued_filter') || 'normal';
    
    console.log('검색 요청:', { searchTerm, searchType, discontinuedFilter, user: user.username });
    
    const db = getDb();
    
    // 검색 조건 구성
    let searchSQL = '';
    let searchParams = [];
    
    if (searchTerm && searchTerm.trim()) {
      if (searchType === 'code') {
        searchSQL = "p.PROH_CODE LIKE ?";
        searchParams.push(`%${searchTerm.trim().toUpperCase()}%`);
      } else {
        // name 검색
        const chars = searchTerm.trim().split('');
        const nameSearchConditions = chars.map(() => "p.PROH_NAME LIKE ?");
        chars.forEach(char => {
          searchParams.push(`%${char}%`);
        });
        searchSQL = nameSearchConditions.join(' AND ');
      }
    } else {
      searchSQL = "1=1";
    }
    
    // ✅ HAVING 절 생성 함수
    function getHavingClause(discontinuedFilter) {
      if (discontinuedFilter === 'discontinued') {
        return "HAVING MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) = '1'";
      } else if (discontinuedFilter === 'normal') {
        return "HAVING (MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) = '0' OR MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) IS NULL)";
      }
      return '';
    }
    
    // ✅ 수정된 SQL 쿼리 (cash_status 포함, HAVING 사용)
    const sql = `
      SELECT p.PROH_CODE, p.PROH_NAME, d.DPRC_SOPR, d.DPRC_BAPR,
             COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
             MAX(CASE WHEN prod.PROD_COD2 = 'L3' THEN prod.PROD_TXT1 END) as cash_status,
             MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) as discontinued_status,
             MAX(CASE WHEN prod.PROD_COD2 = 'L6' THEN prod.PROD_TXT1 END) as stock_managed,
             MAX(CASE WHEN prod.PROD_COD2 = 'L7' THEN prod.PROD_TXT1 END) as online_status
      FROM ASSE_PROH p
      LEFT JOIN ASSE_PROD prod
        ON p.PROH_GUB1 = prod.PROD_GUB1
        AND p.PROH_GUB2 = prod.PROD_GUB2
        AND p.PROH_CODE = prod.PROD_CODE
        AND prod.PROD_COD2 IN ('L3', 'L5', 'L6', 'L7')
      INNER JOIN BISH_DPRC d
        ON p.PROH_CODE = d.DPRC_CODE
      LEFT JOIN STOK_HYUN h
        ON p.PROH_CODE = h.HYUN_ITEM
      WHERE p.PROH_GUB1 = 'A1'
        AND p.PROH_GUB2 = 'AK'
        AND (${searchSQL})
      GROUP BY p.PROH_CODE, p.PROH_NAME, d.DPRC_SOPR, d.DPRC_BAPR, h.HYUN_QTY1
      ${getHavingClause(discontinuedFilter)}
      ORDER BY p.PROH_CODE ASC
      LIMIT 50
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터 배열:', searchParams);
    
    const [rows] = await db.execute(sql, searchParams);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    // ✅ 수정된 응답 데이터 (cash_status 포함)
    const products = rows.map(row => ({
      code: row.PROH_CODE,
      name: row.PROH_NAME,
      cost: parseInt(row.DPRC_BAPR) || 0,
      price: parseInt(row.DPRC_SOPR) || 0,
      stock: parseInt(row.CURRENT_STOCK) || 0,
      cash_status: row.cash_status === '1',                    // ✅ 추가!
      discontinued: row.discontinued_status === '1',
      stockManaged: row.stock_managed === '1',
      isOnline: row.online_status === '1'
    }));

    console.log('변환된 제품 데이터:', products.length, '개');
    if (products.length > 0) {
      console.log('첫 번째 제품 예시:', products[0]);
    }
    console.log('=== Search API 성공 완료 ===');

    return json({
      success: true,
      data: products,
      count: products.length
    });

  } catch (error) {
    console.error('=== Search API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '검색 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}