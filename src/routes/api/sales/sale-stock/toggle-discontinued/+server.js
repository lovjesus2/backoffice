import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    console.log('=== Toggle Discontinued API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { product_code } = await request.json();
    console.log('단종 처리 요청:', { product_code, user: user.username });
    
    if (!product_code) {
      return json({ success: false, message: '제품 코드가 필요합니다.' });
    }

    const db = getDb();
    
    // 트랜잭션 시작
    await db.beginTransaction();
    console.log('트랜잭션 시작');
    
    try {
      // 현재 단종 상태 확인
      const [currentStatus] = await db.execute(
        `SELECT PROD_TXT1 FROM ASSE_PROD 
         WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
         AND PROD_CODE = ? AND PROD_COD2 = 'L5'`,
        [product_code]
      );
      
      if (currentStatus.length === 0) {
        await db.rollback();
        return json({ success: false, message: '제품을 찾을 수 없습니다.' });
      }
      
      const oldStatus = currentStatus[0].PROD_TXT1;
      const newStatus = (oldStatus === '1') ? '0' : '1';
      console.log('상태 변경:', oldStatus, '->', newStatus);
      
      // 1. ASSE_PROD 테이블 업데이트
      await db.execute(
        `UPDATE ASSE_PROD 
         SET PROD_TXT1 = ?, PROD_IDAT = NOW(), PROD_IUSR = ?
         WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
         AND PROD_CODE = ? AND PROD_COD2 = 'L5'`,
        [newStatus, user.username, product_code]
      );
      
      // 2. ASSE_PROT 이력 테이블 처리
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      const [existingProt] = await db.execute(
        `SELECT PROT_CODE FROM ASSE_PROT 
         WHERE PROT_GUB1 = 'A1' AND PROT_GUB2 = 'AK' 
         AND PROT_CODE = ? AND PROT_COD2 = 'L5' AND PROT_DATE = ?`,
        [product_code, today]
      );
      
      if (existingProt.length === 0) {
        // 새로 삽입
        await db.execute(
          `INSERT INTO ASSE_PROT 
           (PROT_GUB1, PROT_GUB2, PROT_CODE, PROT_COD2, PROT_DATE, PROT_TXT1, PROT_NUM1, PROT_IUSR) 
           VALUES ('A1', 'AK', ?, 'L5', ?, ?, 0, ?)`,
          [product_code, today, newStatus, user.username]
        );
      } else {
        // 기존 업데이트
        await db.execute(
          `UPDATE ASSE_PROT 
           SET PROT_TXT1 = ?, PROT_NUM1 = 0, PROT_IDAT = NOW(), PROT_IUSR = ? 
           WHERE PROT_GUB1 = 'A1' AND PROT_GUB2 = 'AK' 
           AND PROT_CODE = ? AND PROT_COD2 = 'L5' AND PROT_DATE = ?`,
          [newStatus, user.username, product_code, today]
        );
      }
      
      await db.commit();
      console.log('트랜잭션 커밋 완료');
      
      const message = (newStatus === '1') ? '단종 처리되었습니다.' : '단종이 취소되었습니다.';
      const action = (newStatus === '1') ? 'discontinued' : 'normal';
      
      console.log('처리 결과:', { action, message });
      console.log('=== Toggle Discontinued API 성공 완료 ===');
      
      return json({
        success: true,
        action: action,
        message: message,
        new_status: newStatus
      });
      
    } catch (error) {
      await db.rollback();
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