import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== Search API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      console.log('인증되지 않은 사용자');
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const searchTerm = url.searchParams.get('search_term') || '';
    const searchType = url.searchParams.get('search_type') || 'name';
    const discontinuedFilter = url.searchParams.get('discontinued_filter') || 'normal';

    console.log('검색 파라미터:', { searchTerm, searchType, discontinuedFilter, user: user.username });

    if (!searchTerm.trim()) {
      return json({ success: false, message: '검색어를 입력해주세요.' });
    }

    console.log('데이터베이스 연결 시도...');
    const db = getDb();
    
    // 검색 조건 구성 - 배열 파라미터 사용
    let searchSQL = '';
    let searchParams = [];
    
    if (searchType === 'code') {
      // 코드 검색
      searchSQL = "p.PROH_CODE LIKE ?";
      searchParams.push(`%${searchTerm}%`);
    } else {
      // 제품명 검색 - 각 문자를 분리하여 모두 포함되어야 함
      const searchChars = searchTerm.replace(/\s/g, '').split('');
      const nameSearchConditions = [];
      
      searchChars.forEach((char) => {
        nameSearchConditions.push("p.PROH_NAME LIKE ?");
        searchParams.push(`%${char}%`);
      });
      
      searchSQL = nameSearchConditions.join(' AND ');
    }
    
    // 단종 필터 적용
    let discontinuedSQL = '';
    if (discontinuedFilter === 'discontinued') {
      discontinuedSQL = "AND prod.PROD_TXT1 = ?";
      searchParams.push('1');
    } else if (discontinuedFilter === 'normal') {
      discontinuedSQL = "AND (prod.PROD_TXT1 = ? OR prod.PROD_TXT1 IS NULL)";
      searchParams.push('0');
    }
    
    // 쿼리 실행
    const sql = `
      SELECT p.PROH_CODE, p.PROH_NAME, d.DPRC_SOPR, d.DPRC_BAPR, prod.PROD_TXT1,
             COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK
      FROM ASSE_PROH p
      INNER JOIN ASSE_PROD prod
         ON p.PROH_GUB1 = prod.PROD_GUB1
        AND p.PROH_GUB2 = prod.PROD_GUB2
        AND p.PROH_CODE = prod.PROD_CODE
        AND prod.PROD_COD2 = 'L5'
      INNER JOIN BISH_DPRC d
         ON p.PROH_CODE = d.DPRC_CODE
      LEFT JOIN STOK_HYUN h
         ON p.PROH_CODE = h.HYUN_ITEM
      WHERE p.PROH_GUB1 = 'A1'
        AND p.PROH_GUB2 = 'AK'
        AND (${searchSQL})
        ${discontinuedSQL}
      ORDER BY p.PROH_CODE ASC
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터 배열:', searchParams);
    
    const [rows] = await db.execute(sql, searchParams);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    const products = rows.map(row => ({
      code: row.PROH_CODE,
      name: row.PROH_NAME,
      cost: parseInt(row.DPRC_BAPR) || 0,
      price: parseInt(row.DPRC_SOPR) || 0,
      stock: parseInt(row.CURRENT_STOCK) || 0,
      discontinued: row.PROD_TXT1 === '1'
    }));

    console.log('변환된 제품 데이터:', products.length, '개');
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