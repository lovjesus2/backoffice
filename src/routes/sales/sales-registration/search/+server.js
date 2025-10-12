import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';  // ← 이렇게 수정

export async function GET({ url }) {
  
  try {
    // 쿼리 파라미터 추출
    const company_code = url.searchParams.get('company_code') || '';
    const registration_code = url.searchParams.get('registration_code') || '';
    const start_date = url.searchParams.get('start_date') || '';
    const end_date = url.searchParams.get('end_date') || '';
    const search_term = url.searchParams.get('search_term') || '';

    console.log('매출 조회 요청:', {
      company_code,
      registration_code,
      start_date,
      end_date,
      search_term
    });

    // 필수 파라미터 검증
    if (!company_code || !registration_code || !start_date || !end_date) {
      return json({
        success: false,
        message: '회사구분, 등록구분, 조회 기간은 필수입니다.'
      }, { status: 400 });
    }

    const db = getDb();  // ← getDbConnection() 대신 getDb() 사용
    
    // 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
    const startDateFormatted = start_date.replace(/-/g, '');
    const endDateFormatted = end_date.replace(/-/g, '');
    
    // 기본 쿼리
    let strsql = `
      SELECT DNHD_DATE, DNHD_QTY1, DNHD_TAMT, DNHD_SLGB, DNHD_RAND,
             DNHD_BPCD, DNHD_SLIP, DNHD_SHOP, MINR_NAME as SLGB_NAME,
             IFNULL(SHOP_NAME,'') SHOP_NAME, IFNULL(BPCD_NAME,'') BPCD_NAME,
             IFNULL(SUM(CASE WHEN DNDT_HYGB = '1' THEN DNDT_TAMT END),0) as CASH_AMT,
             IFNULL(SUM(CASE WHEN DNDT_HYGB = '0' THEN DNDT_TAMT END),0) as CARD_AMT,
             IFNULL(SUM(CASE WHEN DNDT_HYGB = '1' THEN DNDT_QTY1 END),0) as CASH_QTY,
             IFNULL(SUM(CASE WHEN DNDT_HYGB = '0' THEN DNDT_QTY1 END),0) as CARD_QTY,
             IFNULL(POST_SLIP,'') as POST_SLIP
        FROM SALE_DNHD
       INNER JOIN BISH_MINR 
          ON MINR_MJCD = 'D0001'
         AND MINR_CODE = DNHD_SLGB
       INNER JOIN BISH_SHOP 
          ON SHOP_CODE = DNHD_SHOP
       INNER JOIN SALE_DNDT 
          ON DNDT_SLIP = DNHD_SLIP
        LEFT JOIN BISH_BPCD 
          ON BPCD_CODE = DNHD_BPCD
        LEFT JOIN SALE_POST 
          ON DNHD_SLIP = POST_SLIP
       WHERE DNHD_DATE BETWEEN ? AND ?   
    `;

    const params = [startDateFormatted, endDateFormatted];

    // 검색 조건이 있는 경우
    // 검색 조건이 있는 경우 제품 테이블 조인
    // 검색 조건이 있는 경우 제품 테이블 조인
    // 검색 조건이 있는 경우 제품 테이블 조인
    if (search_term.trim()) {
      const searchType = url.searchParams.get('search_type') || 'name';
      
      strsql += `
      AND EXISTS (
        SELECT 1 FROM ASSE_PROH p
        WHERE p.PROH_CODE = DNDT_ITEM
          AND p.PROH_GUB1 = ?
          AND p.PROH_GUB2 = ?
      `;
      
      params.push(company_code, registration_code);
      
      if (searchType === 'code') {
        // 코드 검색 - 단순 LIKE
        strsql += ` AND p.PROH_CODE LIKE ?`;
        params.push(`%${search_term.trim()}%`);
      } else {
        // 제품명 검색 - 글자 단위
        const searchChars = search_term.trim().replace(/\s/g, '').split('');
        
        if (searchChars.length > 0) {
          strsql += ` AND (`;
          const nameSearchConditions = [];
          
          searchChars.forEach((char) => {
            nameSearchConditions.push("p.PROH_NAME LIKE ?");
            params.push(`%${char}%`);
          });
          
          strsql += nameSearchConditions.join(' AND ');
          strsql += `)`;
        }
      }
      
      strsql += `)`;
    }

    strsql += `
       GROUP BY DNHD_DATE, DNHD_QTY1, DNHD_TAMT, DNHD_SLGB, DNHD_RAND,
                DNHD_BPCD, DNHD_SLIP, DNHD_SHOP, MINR_NAME,
                SHOP_NAME, BPCD_NAME
       ORDER BY DNHD_DATE DESC, DNHD_SLIP DESC
    `;

    console.log('실행할 SQL:', strsql);
    console.log('파라미터:', params);

    const [rows] = await db.execute(strsql, params);
    
    console.log(`매출 조회 결과: ${rows.length}건`);

    // 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
    const formattedData = rows.map(row => ({
      ...row,
      DNHD_DATE_FORMATTED: `${row.DNHD_DATE.substring(0,4)}-${row.DNHD_DATE.substring(4,6)}-${row.DNHD_DATE.substring(6,8)}`
    }));

    return json({
      success: true,
      data: formattedData,
      count: rows.length,
      message: `${rows.length}건의 매출 데이터를 조회했습니다.`
    });

  } catch (error) {
    console.error('매출 조회 오류:', error);
    return json({
      success: false,
      message: `매출 조회 중 오류가 발생했습니다: ${error.message}`,
      data: []
    }, { status: 500 });
  }
  // finally 블록 제거 (pool 연결은 자동 관리됨)
}