import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== Search API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
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
    
    // 검색 조건 구성 - 배열 파라미터 사용 (공백 제거 적용)
    let searchSQL = '';
    let searchParams = [];
    
    if (searchType === 'code') {
      // 코드 검색
      searchSQL = "p.PROH_CODE LIKE ?";
      searchParams.push(`%${searchTerm}%`);
    } else {
      // ✅ 제품명 검색 - 공백 제거 후 각 문자를 분리하여 모두 포함되어야 함
      const searchChars = searchTerm.replace(/\s/g, '').split('');
      const nameSearchConditions = [];
      
      searchChars.forEach((char) => {
        nameSearchConditions.push("p.PROH_NAME LIKE ?");
        searchParams.push(`%${char}%`);
      });
      
      searchSQL = nameSearchConditions.join(' AND ');
    }
    
    // ✅ 단종 필터 적용 - EXISTS 서브쿼리 사용 (제품등록과 동일)
    let discontinuedSQL = '';
    if (discontinuedFilter === 'discontinued') {
      discontinuedSQL = `AND EXISTS (
        SELECT 1 FROM ASSE_PROD p_disc 
        WHERE p_disc.PROD_GUB1 = p.PROH_GUB1 
          AND p_disc.PROD_GUB2 = p.PROH_GUB2 
          AND p_disc.PROD_CODE = p.PROH_CODE 
          AND p_disc.PROD_COD2 = 'L5' 
          AND p_disc.PROD_TXT1 = ?
      )`;
      searchParams.push('1');
    } else if (discontinuedFilter === 'normal') {
      discontinuedSQL = `AND (
        NOT EXISTS (
          SELECT 1 FROM ASSE_PROD p_disc 
          WHERE p_disc.PROD_GUB1 = p.PROH_GUB1 
            AND p_disc.PROD_GUB2 = p.PROH_GUB2 
            AND p_disc.PROD_CODE = p.PROH_CODE 
            AND p_disc.PROD_COD2 = 'L5' 
            AND p_disc.PROD_TXT1 = '1'
        ) OR EXISTS (
          SELECT 1 FROM ASSE_PROD p_disc 
          WHERE p_disc.PROD_GUB1 = p.PROH_GUB1 
            AND p_disc.PROD_GUB2 = p.PROH_GUB2 
            AND p_disc.PROD_CODE = p.PROH_CODE 
            AND p_disc.PROD_COD2 = 'L5' 
            AND p_disc.PROD_TXT1 = ?
        )
      )`;
      searchParams.push('0');
    }
    
    // ✅ 최적화된 쿼리 - 제품등록과 동일한 방식
    const sql = `
      SELECT p.PROH_CODE, 
             p.PROH_NAME, 
             p.PROH_QRCD,
             d.DPRC_SOPR, 
             d.DPRC_BAPR,
             COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
             MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) as discontinued_status,
             MAX(CASE WHEN prod.PROD_COD2 = 'L6' THEN prod.PROD_TXT1 END) as stock_managed,
             MAX(CASE WHEN prod.PROD_COD2 = 'L7' THEN prod.PROD_TXT1 END) as online_status
      FROM ASSE_PROH p
      INNER JOIN ASSE_PROD prod
         ON p.PROH_GUB1 = prod.PROD_GUB1
        AND p.PROH_GUB2 = prod.PROD_GUB2
        AND p.PROH_CODE = prod.PROD_CODE
      INNER JOIN BISH_DPRC d
         ON p.PROH_CODE = d.DPRC_CODE
      LEFT JOIN STOK_HYUN h
         ON p.PROH_CODE = h.HYUN_ITEM
      WHERE p.PROH_GUB1 = 'A1'
        AND p.PROH_GUB2 = 'AK'
        AND prod.PROD_COD2 IN ('L5', 'L6', 'L7')
        AND (${searchSQL})
        ${discontinuedSQL}
      GROUP BY p.PROH_CODE, p.PROH_NAME, d.DPRC_SOPR, d.DPRC_BAPR, h.HYUN_QTY1
      ORDER BY p.PROH_CODE ASC
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터 배열:', searchParams);
    
    const [rows] = await db.execute(sql, searchParams);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    // ✅ 새로운 데이터 매핑 (제품등록과 동일)
    const products = rows.map(row => ({
      code: row.PROH_CODE,
      name: row.PROH_NAME,
      qrCode: row.PROH_QRCD || '',
      cost: parseInt(row.DPRC_BAPR) || 0,
      price: parseInt(row.DPRC_SOPR) || 0,
      stock: parseInt(row.CURRENT_STOCK) || 0,
      discontinued: row.discontinued_status === '1',
      stockManaged: row.stock_managed === '1',
      isOnline: row.online_status === '1'  // ✅ 온라인 배지용 추가
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