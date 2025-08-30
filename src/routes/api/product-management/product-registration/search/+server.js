// src/routes/api/product-management/product-registration/search/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== 제품등록 Search API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      console.log('인증되지 않은 사용자');
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const searchTerm = url.searchParams.get('search_term') || '';
    const searchType = url.searchParams.get('search_type') || 'name';
    const discontinuedFilter = url.searchParams.get('discontinued_filter') || 'all';
    const companyCode = url.searchParams.get('company_code');
    const registrationCode = url.searchParams.get('registration_code');
    const registrationName = url.searchParams.get('registration_name');
    const productType = url.searchParams.get('product_type');
    
    console.log('검색 파라미터:', {
      searchTerm,
      searchType,
      discontinuedFilter,
      companyCode,
      registrationCode,
      registrationName,
      productType,
      user: user.username
    });
    
    // 필수 파라미터 검증
    if (!companyCode || !registrationCode) {
      return json({
        success: false,
        message: '회사구분과 등록구분을 선택해주세요.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 기본 검색 조건 배열 (회사구분, 등록구분을 먼저 추가)
    let searchParams = [companyCode, registrationCode];
    let searchSQL = '1=1'; // 기본 조건
    
    // 검색어가 있는 경우만 검색 조건 추가
    if (searchTerm.trim()) {
      if (searchType === 'code') {
        // 제품코드 검색 - 단순 LIKE 검색
        searchSQL = "p.PROH_CODE LIKE ?";
        searchParams.push(`%${searchTerm.trim()}%`);
      } else {
        // 제품명 검색 - 글자 하나씩 잘라서 AND 조건
        const nameSearchConditions = [];
        [...searchTerm.trim()].forEach((char) => {
          nameSearchConditions.push("p.PROH_NAME LIKE ?");
          searchParams.push(`%${char}%`);
        });
        searchSQL = nameSearchConditions.join(' AND ');
      }
    }
    
    // 단종 필터 적용 (제품정보일 때만)
    let discontinuedSQL = '';
    if (registrationName === '제품정보') {
      if (discontinuedFilter === 'discontinued') {
        discontinuedSQL = "AND prod_l5.PROD_TXT1 = ?";
        searchParams.push('1');
      } else if (discontinuedFilter === 'normal') {
        discontinuedSQL = "AND (prod_l5.PROD_TXT1 = ? OR prod_l5.PROD_TXT1 IS NULL)";
        searchParams.push('0');
      }
    }
    
    // 제품구분 필터 적용 (제품정보이고 제품구분이 선택된 경우)
    let productTypeSQL = '';
    if (registrationName === '제품정보' && productType && productType !== 'ALL') {
      productTypeSQL = "AND prod_l1.PROD_TXT1 = ?";
      searchParams.push(productType);
    }
    
    // 쿼리 실행 (LIMIT 없음)
    let sql;
    
    if (registrationName === '제품정보') {
      // 제품정보인 경우 - 가격, 재고, 단종 정보 포함
      sql = `
        SELECT p.PROH_CODE, p.PROH_NAME, d.DPRC_SOPR, d.DPRC_BAPR, 
              prod_l5.PROD_TXT1 as discontinued_status,
              COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
              COALESCE(prod_l6.PROD_TXT1, '0') as STOCK_MANAGED
        FROM ASSE_PROH p
        INNER JOIN ASSE_PROD prod_l1
           ON p.PROH_GUB1 = prod_l1.PROD_GUB1
          AND p.PROH_GUB2 = prod_l1.PROD_GUB2
          AND p.PROH_CODE = prod_l1.PROD_CODE
          AND prod_l1.PROD_COD2 = 'L1'
        INNER JOIN ASSE_PROD prod_l5
           ON p.PROH_GUB1 = prod_l5.PROD_GUB1
          AND p.PROH_GUB2 = prod_l5.PROD_GUB2
          AND p.PROH_CODE = prod_l5.PROD_CODE
          AND prod_l5.PROD_COD2 = 'L5'
         LEFT JOIN BISH_DPRC d
           ON p.PROH_CODE = d.DPRC_CODE
        LEFT JOIN STOK_HYUN h
          ON p.PROH_CODE = h.HYUN_ITEM
        LEFT JOIN ASSE_PROD prod_l6
          ON p.PROH_GUB1 = prod_l6.PROD_GUB1
        AND p.PROH_GUB2 = prod_l6.PROD_GUB2
        AND p.PROH_CODE = prod_l6.PROD_CODE
        AND prod_l6.PROD_COD2 = 'L6'
        WHERE p.PROH_GUB1 = ?
          AND p.PROH_GUB2 = ?
          AND (${searchSQL})
          ${discontinuedSQL}
          ${productTypeSQL}
        ORDER BY p.PROH_CODE ASC
      `;
      // 회사구분과 등록구분을 파라미터 앞쪽에 추가
      // 이미 searchParams에 추가되어 있음
    } else {
      // 기타 등록구분인 경우 - 기본 제품 정보만
      sql = `
        SELECT p.PROH_CODE, p.PROH_NAME
        FROM ASSE_PROH p
        WHERE p.PROH_GUB1 = ?
          AND p.PROH_GUB2 = ?
          AND (${searchSQL})
        ORDER BY p.PROH_CODE ASC
      `;
      // 회사구분과 등록구분을 파라미터 앞쪽에 추가
      // 이미 searchParams에 추가되어 있음
    }
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터 배열:', searchParams);
    
    const [rows] = await db.execute(sql, searchParams);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    let products;
    
    if (registrationName === '제품정보') {
      products = rows.map(row => ({
        code: row.PROH_CODE,
        name: row.PROH_NAME,
        cost: parseInt(row.DPRC_BAPR) || 0,
        price: parseInt(row.DPRC_SOPR) || 0,
        stock: parseInt(row.CURRENT_STOCK) || 0,
        discontinued: row.discontinued_status === '1',
        stockManaged: row.STOCK_MANAGED === '1',
        isProductInfo: true
      }));
    } else {
      products = rows.map(row => ({
        code: row.PROH_CODE,
        name: row.PROH_NAME,
        cost: 0,
        price: 0,
        stock: 0,
        discontinued: false,
        isProductInfo: false
      }));
    }

    console.log('변환된 제품 데이터:', products.length, '개');
    console.log('=== 제품등록 Search API 성공 완료 ===');

    return json({
      success: true,
      data: products,
      count: products.length
    });

  } catch (error) {
    console.error('=== 제품등록 Search API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '검색 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}