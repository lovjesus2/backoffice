import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== 바코드 검색 API 호출 시작 ===');
    
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const productCode = url.searchParams.get('code');
    
    console.log('바코드 검색 요청:', { productCode, user: user.username });
    
    if (!productCode || productCode.trim() === '') {
      return json({
        success: false,
        message: '제품코드를 입력해주세요.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // product-stock/search와 동일한 쿼리 구조, 하지만 정확한 코드 매칭
    const sql = `
      SELECT p.PROH_CODE, 
             p.PROH_NAME, 
             p.PROH_BIGO,
             d.DPRC_SOPR, 
             d.DPRC_BAPR,
             d.DPRC_DCPR,
             d.DPRC_DEPR,
             COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
             MAX(CASE WHEN prod.PROD_COD2 = 'L3' THEN prod.PROD_TXT1 END) as cash_status,
             MAX(CASE WHEN prod.PROD_COD2 = 'L5' THEN prod.PROD_TXT1 END) as discontinued_status,
             MAX(CASE WHEN prod.PROD_COD2 = 'L6' THEN prod.PROD_TXT1 END) as stock_managed,
             MAX(CASE WHEN prod.PROD_COD2 = 'L7' THEN prod.PROD_TXT1 END) as online_status
      FROM ASSE_PROH p
      INNER JOIN ASSE_PROD prod
         ON p.PROH_GUB1 = prod.PROD_GUB1
        AND p.PROH_GUB2 = prod.PROD_GUB2
        AND p.PROH_CODE = prod.PROD_CODE
      LEFT JOIN BISH_DPRC d
         ON p.PROH_CODE = d.DPRC_CODE
      LEFT JOIN STOK_HYUN h
        ON p.PROH_CODE = h.HYUN_ITEM
      WHERE p.PROH_GUB1 = 'A1'
        AND p.PROH_GUB2 = 'AK'
        AND prod.PROD_COD2 IN ('L3', 'L5', 'L6', 'L7')
        AND p.PROH_CODE = ?
      GROUP BY p.PROH_CODE, p.PROH_NAME, p.PROH_BIGO, d.DPRC_SOPR, d.DPRC_BAPR, d.DPRC_DCPR, d.DPRC_DEPR, h.HYUN_QTY1
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터:', [productCode.trim().toUpperCase()]);
    
    const [rows] = await db.execute(sql, [productCode.trim().toUpperCase()]);
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
      cost: parseInt(rows[0].DPRC_BAPR) || 0,
      cardPrice: parseInt(rows[0].DPRC_SOPR) || 0,
      cashPrice: parseInt(rows[0].DPRC_DCPR) || 0,
      deliveryPrice: parseInt(rows[0].DPRC_DEPR) || 0,
      stock: parseInt(rows[0].CURRENT_STOCK) || 0,
      cash_status : rows[0].cash_status === '1',
      discontinued: rows[0].discontinued_status === '1',
      stockManaged: rows[0].stock_managed === '1',
      isOnline: rows[0].online_status === '1'
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