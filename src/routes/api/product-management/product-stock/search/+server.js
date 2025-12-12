// src/routes/api/product-management/product-stock/search/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== Product Stock Search API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const searchTerm = url.searchParams.get('search_term') || '';
    const searchType = url.searchParams.get('search_type') || 'name';
    const discontinuedFilter = url.searchParams.get('discontinued_filter') || 'normal';
    const companyCode = url.searchParams.get('company_code') || 'A1';
    const registrationCode = url.searchParams.get('registration_code') || 'AK';
    const registrationName = url.searchParams.get('registration_name');
    const productType = url.searchParams.get('product_type')|| '';
    
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
    let searchParams = []; 
    let searchSQL = '1=1'; // 기본 조건
    
    // 검색어가 있는 경우만 검색 조건 추가
    if (searchTerm.trim()) {
      if (searchType === 'code') {
        searchSQL = "p.PROH_CODE LIKE ?";
        searchParams.push(`%${searchTerm.trim()}%`);
      } else {
        // 제품명 검색 - 글자 하나씩 잘라서 AND 조건
        const nameSearchConditions = [];
        const searchChars = searchTerm.trim().replace(/\s/g, '').split('');
        searchChars.forEach((char) => {
          nameSearchConditions.push("p.PROH_NAME LIKE ?");
          searchParams.push(`%${char}%`);
        });
        searchSQL = nameSearchConditions.join(' AND ');
      }
    }
    
    // 단종 필터 적용 (제품정보일 때만)
    let discontinuedSQL = '';
    if (registrationCode === 'AK') {
      console.log('✅ 제품정보 확인됨, 단종 필터 적용:', discontinuedFilter);
      
      if (discontinuedFilter === 'discontinued') {
        discontinuedSQL = `AND EXISTS (
          SELECT 1 FROM ASSE_PROD p_disc 
          WHERE p_disc.PROD_GUB1 = p.PROH_GUB1 
            AND p_disc.PROD_GUB2 = p.PROH_GUB2 
            AND p_disc.PROD_CODE = p.PROH_CODE 
            AND p_disc.PROD_COD2 = 'L5' 
            AND p_disc.PROD_TXT1 = '1'
        )`;
      } else if (discontinuedFilter === 'normal') {
        discontinuedSQL = `AND NOT EXISTS (
          SELECT 1 FROM ASSE_PROD p_disc 
          WHERE p_disc.PROD_GUB1 = p.PROH_GUB1 
            AND p_disc.PROD_GUB2 = p.PROH_GUB2 
            AND p_disc.PROD_CODE = p.PROH_CODE 
            AND p_disc.PROD_COD2 = 'L5' 
            AND p_disc.PROD_TXT1 = '1'
        )`;
      }
    } else {
      console.log('⚠️ 단종 필터 미적용 - registrationName:', registrationName);
    }
    
    // 제품구분 필터 추가
    let productTypeSQL = '';
    if (registrationCode === 'AK' && productType && productType !== 'ALL' && productType.trim() !== '') {
      console.log('✅ 제품구분 필터 적용:', productType);
      productTypeSQL = `AND EXISTS (
        SELECT 1 FROM ASSE_PROD p_type 
        WHERE p_type.PROD_GUB1 = p.PROH_GUB1 
          AND p_type.PROD_GUB2 = p.PROH_GUB2 
          AND p_type.PROD_CODE = p.PROH_CODE 
          AND p_type.PROD_COD2 = 'L1' 
          AND p_type.PROD_TXT1 = ?
      )`;
      searchParams.push(productType);
    } else {
      console.log('⚠️ 제품구분 필터 미적용 - registrationName:', registrationName, 'productType:', productType);
    }
    
    // 쿼리 실행
    let sql;
    
    if (registrationCode === 'AK') {
      // 제품정보인 경우 - 상세 정보 포함
      sql = `
        SELECT p.PROH_CODE, 
              p.PROH_NAME, 
              d.DPRC_SOPR, 
              d.DPRC_BAPR,
              COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
              MAX(CASE WHEN prod.PROD_COD2 = 'L1' THEN prod.PROD_TXT1 END) as product_type,
              MAX(CASE WHEN prod.PROD_COD2 = 'L3' THEN prod.PROD_TXT1 END) as cash_status,
              MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) as discontinued_status,
              MAX(CASE WHEN prod.PROD_COD2 = 'L6' THEN prod.PROD_TXT1 END) as stock_managed,
              MAX(CASE WHEN prod.PROD_COD2 = 'L7' THEN prod.PROD_TXT1 END) as online_status,
              COALESCE(sale.SALE_QTY_SUMMARY, '0/0/0') as SALES_INFO,
              IFNULL(img.IMAG_PCPH, '') as imagePath
        FROM ASSE_PROH p
        INNER JOIN ASSE_PROD prod
          ON p.PROH_GUB1 = prod.PROD_GUB1
          AND p.PROH_GUB2 = prod.PROD_GUB2
          AND p.PROH_CODE = prod.PROD_CODE
        LEFT JOIN BISH_DPRC d
          ON p.PROH_CODE = d.DPRC_CODE
        LEFT JOIN STOK_HYUN h
          ON p.PROH_CODE = h.HYUN_ITEM
        LEFT JOIN ASSE_IMAG img
          ON p.PROH_CODE = img.IMAG_CODE
        AND img.IMAG_GUB1 = ?
        AND img.IMAG_GUB2 = ?
        AND img.IMAG_GUB3 = '0'
        AND img.IMAG_CNT1 = 1
        LEFT JOIN (
          SELECT 
            DNDT_ITEM,
            CONCAT(
              CAST(SUM(DNDT_QTY1) AS CHAR), '/',
              CAST(SUM(CASE WHEN SUBSTRING(DNDT_SLIP, 3, 4) = YEAR(CURDATE()) THEN DNDT_QTY1 ELSE 0 END) AS CHAR), '/',
              CAST(SUM(CASE WHEN SUBSTRING(DNDT_SLIP, 3, 6) = DATE_FORMAT(CURDATE(), '%Y%m') THEN DNDT_QTY1 ELSE 0 END) AS CHAR)
            ) as SALE_QTY_SUMMARY
          FROM SALE_DNDT
          GROUP BY DNDT_ITEM
        ) sale ON p.PROH_CODE = sale.DNDT_ITEM               
        WHERE p.PROH_GUB1 = ?
          AND p.PROH_GUB2 = ?
          AND prod.PROD_COD2 IN ('L1', 'L3', 'L5', 'L6', 'L7')
          AND (${searchSQL})
          ${discontinuedSQL}
          ${productTypeSQL}
        GROUP BY p.PROH_CODE, p.PROH_NAME, d.DPRC_SOPR, d.DPRC_BAPR, h.HYUN_QTY1, img.IMAG_PCPH
        ORDER BY p.PROH_CODE ASC
      `;
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
    }
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터 배열:', searchParams);
    console.log('제품구분 SQL 조건:', productTypeSQL);
    
    let params;
    if (registrationCode === 'AK') {
      params = [
        companyCode, registrationCode,  // img 조인
        companyCode, registrationCode,  // WHERE
        ...searchParams
      ];
    } else {
      params = [
        companyCode, registrationCode,  // WHERE만
        ...searchParams
      ];
    }

    const [rows] = await db.execute(sql, params);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    let products;
    
    if (registrationCode === 'AK') {
      products = rows.map(row => ({
        code: row.PROH_CODE,
        name: row.PROH_NAME,
        cost: user.role === 'admin' ? (parseInt(row.DPRC_BAPR) || 0) : 0, // admin만 원가 조회 가능
        price: parseInt(row.DPRC_SOPR) || 0,
        stock: parseInt(row.CURRENT_STOCK) || 0,
        productType: row.product_type,
        cashStatus: row.cash_status === '1',
        discontinued: row.discontinued_status === '1',
        stockManaged: row.stock_managed === '1',
        isOnline: row.online_status === '1',
        salesInfo: row.SALES_INFO,
        imagePath: row.imagePath || '',
        isProductInfo: true
      }));
    } else {
      products = rows.map(row => ({
        code: row.PROH_CODE,
        name: row.PROH_NAME,
        cost: 0,
        price: 0,
        stock: 0,
        productType: null,
        cashStatus: false,
        discontinued: false,
        stockManaged: false,
        isOnline: false,
        salesInfo: '',
        isProductInfo: false
      }));
    }

    console.log('변환된 제품 데이터:', products.length, '개');
    if (products.length > 0) {
      console.log('첫 번째 제품 예시:', products[0]);
    }
    console.log('=== Product Stock Search API 성공 완료 ===');

    return json({
      success: true,
      data: products,
      count: products.length
    });

  } catch (error) {
    console.error('=== Product Stock Search API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '검색 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}