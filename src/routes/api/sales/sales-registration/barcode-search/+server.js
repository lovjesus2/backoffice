import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== 바코드 검색 API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const productCode = url.searchParams.get('code');
    // 🆕 동적으로 회사구분, 등록구분 받기 (기본값 설정)
    const companyCode = url.searchParams.get('company_code') || user.company_code || 'A1';
    const registrationCode = url.searchParams.get('registration_code') || 'AK';
    
    console.log('바코드 검색 요청:', { 
      productCode, 
      companyCode, 
      registrationCode, 
      user: user.username 
    });
    
    if (!productCode || productCode.trim() === '') {
      return json({
        success: false,
        message: '제품코드를 입력해주세요.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 🆕 동적 파라미터로 수정
    const sql = `
      SELECT p.PROH_CODE, 
         p.PROH_NAME, 
         p.PROH_BIGO,
         d.DPRC_SOPR, 
         d.DPRC_BAPR,
         d.DPRC_DCPR,
         d.DPRC_DEPR,
         COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
         COALESCE(sale.SALE_QTY_SUMMARY, '0/0/0') as SALES_INFO,
         MAX(CASE WHEN prod.PROD_COD2 = 'L3' THEN prod.PROD_TXT1 END) as cash_status,
         MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) as discontinued_status,
         MAX(CASE WHEN prod.PROD_COD2 = 'L6' THEN prod.PROD_TXT1 END) as stock_managed,
         MAX(CASE WHEN prod.PROD_COD2 = 'L7' THEN prod.PROD_TXT1 END) as online_status,
         y.YOUL_QTY1,
         y.YOUL_AMT1,
         y.YOUL_GUBN,
         -- ✅ 이미지 추가
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
  LEFT JOIN BISH_YOUL y
    ON p.PROH_CODE = y.YOUL_ITEM
  -- ✅ 이미지 조인 추가
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
    WHERE DNDT_ITEM = ?
    GROUP BY DNDT_ITEM
  ) sale ON p.PROH_CODE = sale.DNDT_ITEM     
  WHERE p.PROH_GUB1 = ?
    AND p.PROH_GUB2 = ?
    AND prod.PROD_COD2 IN ('L3', 'L5', 'L6', 'L7')
    AND (p.PROH_CODE = ? OR p.PROH_CDOT = ?)
  GROUP BY p.PROH_CODE, p.PROH_NAME, p.PROH_BIGO, d.DPRC_SOPR, d.DPRC_BAPR, 
           d.DPRC_DCPR, d.DPRC_DEPR, h.HYUN_QTY1, y.YOUL_QTY1, y.YOUL_AMT1, 
           y.YOUL_GUBN, img.IMAG_PCPH
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터:', [companyCode, registrationCode, productCode.trim().toUpperCase(), productCode.trim().toUpperCase()]);
    
    const [rows] = await db.execute(sql, [
      companyCode, registrationCode,  // img 조인용
      productCode.trim().toUpperCase(),  // sale 서브쿼리
      companyCode, registrationCode,  // WHERE
      productCode.trim().toUpperCase(), productCode.trim().toUpperCase()  // WHERE
    ]);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    if (rows.length === 0) {
      return json({
        success: false,
        message: `제품 코드 '${productCode}'를 찾을 수 없습니다.`
      }, { status: 404 });
    }
    
    const product = {
      code: rows[0].PROH_CODE,
      name: rows[0].PROH_NAME,
      description: rows[0].PROH_BIGO || '',
      cost: user.role === 'admin' ? (parseInt(rows[0].DPRC_BAPR) || 0) : 0,
      cardPrice: parseInt(rows[0].DPRC_SOPR) || 0,
      cashPrice: parseInt(rows[0].DPRC_DCPR) || 0,
      deliveryPrice: parseInt(rows[0].DPRC_DEPR) || 0,
      stock: parseInt(rows[0].CURRENT_STOCK) || 0,
      salesinfo: rows[0].SALES_INFO || '',
      cash_status : rows[0].cash_status === '1',
      discontinued: rows[0].discontinued_status === '1',
      stockManaged: rows[0].stock_managed === '1',
      isOnline: rows[0].online_status === '1',
      imagePath: rows[0].imagePath || '',
      // 할인 정보 추가
      discountQty: parseInt(rows[0].YOUL_QTY1) || 0,
      discountAmount: parseInt(rows[0].YOUL_AMT1) || 0,
      discountType: rows[0].YOUL_GUBN || '0'
    };

    console.log('변환된 제품 데이터:', product);
    console.log('=== 바코드 검색 API 성공 완료 ===');

    return json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('=== 바코드 검색 API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '바코드 검색 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}