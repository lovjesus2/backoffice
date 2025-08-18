// src/routes/api/sales/sale-stock/product-detail/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== Product Detail API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      console.log('인증되지 않은 사용자');
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const productCode = url.searchParams.get('code');
    
    console.log('제품 조회 요청:', { productCode, user: user.username });
    
    // 입력값 검증
    if (!productCode) {
      return json({
        success: false,
        message: '제품코드를 입력해주세요.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 제품 정보 조회 (기존 search API와 동일한 구조)
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
        AND p.PROH_CODE = ?
    `;
    
    console.log('실행할 SQL:', sql);
    console.log('파라미터:', [productCode]);
    
    const [rows] = await db.execute(sql, [productCode]);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    if (rows.length === 0) {
      return json({
        success: false,
        message: '제품을 찾을 수 없습니다.'
      }, { status: 404 });
    }
    
    const product = {
      code: rows[0].PROH_CODE,
      name: rows[0].PROH_NAME,
      cost: parseInt(rows[0].DPRC_BAPR) || 0,
      price: parseInt(rows[0].DPRC_SOPR) || 0,
      stock: parseInt(rows[0].CURRENT_STOCK) || 0,
      discontinued: rows[0].PROD_TXT1 === '1'
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