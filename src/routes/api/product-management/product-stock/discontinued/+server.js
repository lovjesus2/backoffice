// src/routes/api/sales/sale-stock/discontinued/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    console.log('=== Toggle Discontinued API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      console.log('인증되지 않은 사용자');
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { product_code } = await request.json();
    
    console.log('단종 처리 요청:', { product_code, user: user.username });
    
    // 입력값 검증
    if (!product_code) {
      return json({
        success: false,
        message: '제품코드를 입력해주세요.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 제품 정보 조회 (현재 단종 상태 확인)
    const [productRows] = await db.execute(`
      SELECT p.PROH_CODE, p.PROH_NAME, prod.PROD_TXT1 
      FROM ASSE_PROH p
      INNER JOIN ASSE_PROD prod
         ON p.PROH_GUB1 = prod.PROD_GUB1
        AND p.PROH_GUB2 = prod.PROD_GUB2
        AND p.PROH_CODE = prod.PROD_CODE
        AND prod.PROD_COD2 = 'L5'
      WHERE p.PROH_CODE = ?
    `, [product_code]);
    
    if (productRows.length === 0) {
      return json({
        success: false,
        message: '존재하지 않는 제품코드입니다.'
      }, { status: 404 });
    }
    
    const product = productRows[0];
    console.log('제품 정보:', product);
    
    // 현재 단종 상태 확인 및 토글
    const currentStatus = product.PROD_TXT1 || '0';
    const newStatus = currentStatus === '1' ? '0' : '1';
    
    console.log('상태 변경:', currentStatus, '→', newStatus);
    
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    console.log('트랜잭션 시작');
    
    try {
      // 1. ASSE_PROD 테이블 업데이트 (L5: 단종 상태)
      await db.execute(`
        UPDATE ASSE_PROD 
        SET PROD_TXT1 = ?, PROD_IDAT = NOW(), PROD_IUSR = ?
        WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
        AND PROD_CODE = ? AND PROD_COD2 = 'L5'
      `, [newStatus, user.username, product_code]);
      
      console.log('ASSE_PROD 테이블 업데이트 완료');
      
      // ✅ 2. ASSE_PROT 이력 테이블 처리 (L5: 단종 상태 이력)
      const pGub1 = 'A1';
      const pGub2 = 'AK';
      const pCode = product_code;
      const pCod2 = 'L5';  // 단종 상태
      const pDate = today;
      const pTxt1 = newStatus;  // 새로운 단종 상태
      const pNum1 = 0;
      
      // ASSE_PROT 테이블에서 해당 레코드 존재 확인
      const [existingProt] = await db.execute(`
        SELECT PROT_CODE FROM ASSE_PROT 
        WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? 
        AND PROT_CODE = ? AND PROT_COD2 = ? AND PROT_DATE = ?
      `, [pGub1, pGub2, pCode, pCod2, pDate]);
      
      if (existingProt.length === 0) {
        // 레코드가 없으면 INSERT
        await db.execute(`
          INSERT INTO ASSE_PROT 
          (PROT_GUB1, PROT_GUB2, PROT_CODE, PROT_COD2, PROT_DATE, PROT_TXT1, PROT_NUM1, PROT_IUSR) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [pGub1, pGub2, pCode, pCod2, pDate, pTxt1, pNum1, user.username]);
        
        console.log(`단종 이력 생성: ${product_code} / ${pDate} / 상태: ${newStatus}`);
      } else {
        // 레코드가 있으면 UPDATE
        await db.execute(`
          UPDATE ASSE_PROT 
          SET PROT_TXT1 = ?, PROT_NUM1 = ?, PROT_IDAT = NOW(), PROT_IUSR = ? 
          WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? 
          AND PROT_CODE = ? AND PROT_COD2 = ? AND PROT_DATE = ?
        `, [pTxt1, pNum1, user.username, pGub1, pGub2, pCode, pCod2, pDate]);
        
        console.log(`단종 이력 업데이트: ${product_code} / ${pDate} / 상태: ${newStatus}`);
      }
      
      console.log('ASSE_PROT 이력 테이블 처리 완료');
      
      // 트랜잭션 커밋
      await db.execute('COMMIT');
      console.log('트랜잭션 커밋 완료');
      
      const message = (newStatus === '1') ? 
        `${product.PROH_NAME} 제품이 단종 처리되었습니다.` : 
        `${product.PROH_NAME} 제품의 단종이 취소되었습니다.`;
      const action = (newStatus === '1') ? 'discontinued' : 'normal';
      
      console.log('처리 결과:', { action, message });
      console.log('=== Toggle Discontinued API 성공 완료 ===');
      
      return json({
        success: true,
        action: action,
        message: message,
        new_status: newStatus,
        product_name: product.PROH_NAME
      });
      
    } catch (error) {
      // 트랜잭션 롤백
      await db.execute('ROLLBACK');
      console.log('트랜잭션 롤백');
      throw error;
    }

  } catch (error) {
    console.error('=== Toggle Discontinued API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '단종 처리 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}