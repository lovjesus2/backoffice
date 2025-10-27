// src/routes/api/product-management/product-registration/delete/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function DELETE({ request, locals }) {
  try {
    console.log('=== 제품등록 삭제 API 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { product_code, company_code, registration_code } = await request.json();
    
    console.log('제품 삭제 요청:', { 
      product_code, 
      company_code, 
      registration_code,
      user: user.username 
    });
    
    // 입력값 검증
    if (!product_code || !company_code || !registration_code) {
      return json({
        success: false,
        message: '필수 정보가 누락되었습니다. (제품코드, 회사구분, 등록구분)'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 제품 존재 여부 확인
    const [productRows] = await db.execute(`
      SELECT PROH_CODE, PROH_NAME 
      FROM ASSE_PROH 
      WHERE PROH_GUB1 = ? AND PROH_GUB2 = ? AND PROH_CODE = ?
    `, [company_code, registration_code, product_code]);
    
    if (productRows.length === 0) {
      return json({
        success: false,
        message: '존재하지 않는 제품입니다.'
      }, { status: 404 });
    }
    
    const product = productRows[0];
    console.log('삭제할 제품 정보:', product);
    
    // 삭제 안전장치: 매출내역(SALE_DNDT) 확인
    console.log('매출내역 확인 중...');
    const [salesRows] = await db.execute(`
      SELECT COUNT(*) as sales_count 
      FROM SALE_DNDT 
      WHERE DNDT_ITEM = ?
    `, [product_code]);
    
    const salesCount = salesRows[0]?.sales_count || 0;
    console.log('매출내역 건수:', salesCount);
    
    if (salesCount > 0) {
      return json({
        success: false,
        message: `해당 제품은 매출내역이 ${salesCount}건 존재하여 삭제할 수 없습니다.\n매출내역을 먼저 정리한 후 삭제해주세요.`
      }, { status: 400 });
    }
    
    // 삭제 안전장치: 재고 데이터(STOK_HYUN) 존재 여부 확인
    console.log('재고 데이터 존재 여부 확인 중...');
    const [stockRows] = await db.execute(`
      SELECT COUNT(*) as stock_count 
      FROM STOK_HYUN 
      WHERE HYUN_ITEM = ?
    `, [product_code]);
    
    const stockCount = stockRows[0]?.stock_count || 0;
    console.log('재고 데이터 건수:', stockCount);
    
    if (stockCount > 0) {
      return json({
        success: false,
        message: `해당 제품의 재고 데이터가 존재하여 삭제할 수 없습니다.\n재고 데이터를 먼저 정리한 후 삭제해주세요.`
      }, { status: 400 });
    }
    
    console.log('✅ 삭제 안전장치 통과: 매출내역 없음, 재고 없음');
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    console.log('트랜잭션 시작');
    
    try {
      // 1. ASSE_IMAG (이미지 정보) 삭제
      await db.execute(`
        DELETE FROM ASSE_IMAG 
        WHERE IMAG_GUB1 = ? AND IMAG_GUB2 = ? AND IMAG_CODE = ?
      `, [company_code, registration_code, product_code]);
      console.log('이미지 정보 삭제 완료');
      
      // 2. BISH_DPRC_HIST (가격 히스토리) 삭제
      await db.execute(`
        DELETE FROM BISH_DPRC_HIST WHERE DPRC_CODE = ?
      `, [product_code]);
      console.log('가격 히스토리 삭제 완료');
      
      // 3. BISH_DPRC (현재 가격정보) 삭제
      await db.execute(`
        DELETE FROM BISH_DPRC WHERE DPRC_CODE = ?
      `, [product_code]);
      console.log('현재 가격정보 삭제 완료');
      
      // 4. ASSE_PROT (제품 상세정보 히스토리) 삭제
      await db.execute(`
        DELETE FROM ASSE_PROT 
        WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? AND PROT_CODE = ?
      `, [company_code, registration_code, product_code]);
      console.log('제품 상세정보 히스토리 삭제 완료');
      
      // 5. ASSE_PROD (제품 상세정보) 삭제
      await db.execute(`
        DELETE FROM ASSE_PROD 
        WHERE PROD_GUB1 = ? AND PROD_GUB2 = ? AND PROD_CODE = ?
      `, [company_code, registration_code, product_code]);
      console.log('제품 상세정보 삭제 완료');
      
      // 6. ASSE_PROH (기본 제품정보) 삭제
      await db.execute(`
        DELETE FROM ASSE_PROH 
        WHERE PROH_GUB1 = ? AND PROH_GUB2 = ? AND PROH_CODE = ?
      `, [company_code, registration_code, product_code]);
      console.log('기본 제품정보 삭제 완료');
      
      // 트랜잭션 커밋
      await db.execute('COMMIT');
      console.log('트랜잭션 커밋 완료');
      
      const message = `${product.PROH_NAME} (${product_code}) 제품이 완전히 삭제되었습니다.`;
      
      console.log('삭제 결과:', { message });
      console.log('=== 제품등록 삭제 API 성공 완료 ===');
      
      return json({
        success: true,
        message: message,
        deleted_product: {
          code: product.PROH_CODE,
          name: product.PROH_NAME
        }
      });
      
    } catch (error) {
      // 트랜잭션 롤백
      await db.execute('ROLLBACK');
      console.log('트랜잭션 롤백');
      throw error;
    }

  } catch (error) {
    console.error('=== 제품등록 삭제 API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '제품 삭제 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}