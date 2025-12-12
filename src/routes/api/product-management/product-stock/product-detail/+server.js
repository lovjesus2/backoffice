// src/routes/api/product-management/product-stock/product-detail/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== Product Detail API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const productCode = url.searchParams.get('code');
    
    console.log('제품 조회 요청:', { productCode, user: user.username });
    
    if (!productCode) {
      return json({
        success: false,
        message: '제품코드를 입력해주세요.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // ✅ 수정된 SQL: L5(단종)와 L6(재고사용) 모두 조회
    const sql = `
      SELECT p.PROH_CODE, 
            p.PROH_NAME,
            p.PROH_QRCD, 
            d.DPRC_SOPR, 
            d.DPRC_BAPR,
            COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
            MAX(CASE WHEN prod.PROD_COD2 = 'L3' THEN prod.PROD_TXT1 END) as cash_status,
            MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) as discontinued_status,
            MAX(CASE WHEN prod.PROD_COD2 = 'L6' THEN prod.PROD_TXT1 END) as stock_managed,
            MAX(CASE WHEN prod.PROD_COD2 = 'L7' THEN prod.PROD_TXT1 END) as online_status,
            COALESCE(sale.SALE_QTY_SUMMARY, '0/0/0') as SALES_INFO,
            IFNULL(img.IMAG_PCPH, '') as imagePath
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
      LEFT JOIN ASSE_IMAG img
        ON p.PROH_CODE = img.IMAG_CODE
      AND img.IMAG_GUB1 = 'A1'
      AND img.IMAG_GUB2 = 'AK'
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
      WHERE p.PROH_GUB1 = 'A1'
        AND p.PROH_GUB2 = 'AK'
        AND p.PROH_CODE = ?
      GROUP BY p.PROH_CODE, p.PROH_NAME, p.PROH_QRCD, d.DPRC_SOPR, d.DPRC_BAPR, h.HYUN_QTY1, img.IMAG_PCPH
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터:', [productCode]);
    
    const [rows] = await db.execute(sql, [productCode,productCode]);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    if (rows.length === 0) {
      return json({
        success: false,
        message: '제품을 찾을 수 없습니다.'
      }, { status: 404 });
    }
    
    // ✅ 응답 - stockManaged로 통일
    const product = {
      code: rows[0].PROH_CODE,
      name: rows[0].PROH_NAME,
      qrCode: rows[0].PROH_QRCD || '',
      cost: user.role === 'admin' ? (parseInt(rows[0].DPRC_BAPR) || 0) : 0, // admin만 원가 조회 가능
      price: parseInt(rows[0].DPRC_SOPR) || 0,
      stock: parseInt(rows[0].CURRENT_STOCK) || 0,
      salesInfo: rows[0].SALES_INFO || '',
      cash_status: rows[0].cash_status === '1',        // 현금세팅!
      discontinued: rows[0].discontinued_status === '1',
      stockManaged: rows[0].stock_managed === '1',        // 통일!
      imagePath: rows[0].imagePath || '',
      isOnline: rows[0].online_status === '1'
    };

    console.log('변환된 제품 데이터:', product);
    console.log('=== Product Detail API 성공 완료 ===');

    return json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('=== Product Detail API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '제품 조회 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}