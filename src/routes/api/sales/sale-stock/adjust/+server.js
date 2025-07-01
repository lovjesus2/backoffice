import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    console.log('=== Adjust API 호출 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { product_code, quantity } = await request.json();
    console.log('재고 조정 요청:', { product_code, quantity, user: user.username });
    
    if (!product_code) {
      return json({ success: false, message: '제품 코드가 필요합니다.' });
    }
    
    const qty = parseInt(quantity);
    if (!qty || qty === 0) {
      return json({ success: false, message: '수량을 입력해주세요.' });
    }

    const db = getDb();
    
    // 트랜잭션 시작
    await db.beginTransaction();
    console.log('트랜잭션 시작');
    
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      // 1. 수불 전표번호 생성
      const [slipResult] = await db.execute(
        `SELECT IFNULL(MAX(SLIP_SENO), 0) + 1 AS SENO 
         FROM BISH_SLIP 
         WHERE SLIP_GUBN = 'MV' AND SLIP_DATE = ? 
         LIMIT 1`,
        [today]
      );
      
      const seno = slipResult[0].SENO;
      const moveSlip = `MV${today}${String(seno).padStart(5, '0')}`;
      console.log('생성된 전표번호:', moveSlip);
      
      // 2. 수불 전표번호 저장
      await db.execute(
        `INSERT INTO BISH_SLIP 
         (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR) 
         VALUES ('MV', ?, ?, ?, ?)`,
        [today, seno, moveSlip, user.username]
      );
      
      // 3. 수불 저장
      await db.execute(
        `INSERT INTO STOK_MOVE 
         (MOVE_SLIP, MOVE_SENO, MOVE_SHOP, MOVE_DATE, MOVE_ITEM, MOVE_QTY1, MOVE_RENO, MOVE_MENU, MOVE_IUSR) 
         VALUES (?, 1, 'F1', ?, ?, ?, '', 'STOCK_ADJ', ?)`,
        [moveSlip, today, product_code, qty, user.username]
      );
      
      // 4. 현재고 계산 및 업데이트
      const [stockResult] = await db.execute(
        `SELECT IFNULL(SUM(MOVE_QTY1), 0) as TOTAL_QTY 
         FROM STOK_MOVE 
         WHERE MOVE_ITEM = ? AND MOVE_SHOP = 'F1'`,
        [product_code]
      );
      
      const newStock = parseInt(stockResult[0].TOTAL_QTY);
      console.log('새로운 재고량:', newStock);
      
      // 5. 현재고 테이블 업데이트/삽입
      const [existingStock] = await db.execute(
        `SELECT HYUN_ITEM FROM STOK_HYUN WHERE HYUN_ITEM = ?`,
        [product_code]
      );
      
      if (existingStock.length > 0) {
        await db.execute(
          `UPDATE STOK_HYUN 
           SET HYUN_QTY1 = ?, HYUN_IDAT = NOW(), HYUN_IUSR = ? 
           WHERE HYUN_ITEM = ?`,
          [newStock, user.username, product_code]
        );
      } else {
        await db.execute(
          `INSERT INTO STOK_HYUN (HYUN_ITEM, HYUN_QTY1, HYUN_IUSR) 
           VALUES (?, ?, ?)`,
          [product_code, newStock, user.username]
        );
      }
      
      // 6. 재고관리 설정 (L6)
      const [stockMgmt] = await db.execute(
        `SELECT PROD_CODE FROM ASSE_PROD 
         WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
         AND PROD_CODE = ? AND PROD_COD2 = 'L6'`,
        [product_code]
      );
      
      if (stockMgmt.length > 0) {
        await db.execute(
          `UPDATE ASSE_PROD 
           SET PROD_TXT1 = '1', PROD_IDAT = NOW(), PROD_IUSR = ?
           WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
           AND PROD_CODE = ? AND PROD_COD2 = 'L6'`,
          [user.username, product_code]
        );
      } else {
        await db.execute(
          `INSERT INTO ASSE_PROD 
           (PROD_GUB1, PROD_GUB2, PROD_CODE, PROD_COD2, PROD_TXT1, PROD_NUM1, PROD_IUSR) 
           VALUES ('A1', 'AK', ?, 'L6', '1', 0, ?)`,
          [product_code, user.username]
        );
      }
      
      await db.commit();
      console.log('트랜잭션 커밋 완료');
      console.log('=== Adjust API 성공 완료 ===');
      
      return json({
        success: true,
        message: '재고가 조정되었습니다.',
        new_stock: newStock,
        move_slip: moveSlip
      });
      
    } catch (error) {
      await db.rollback();
      console.log('트랜잭션 롤백');
      throw error;
    }

  } catch (error) {
    console.error('=== Adjust API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '재고 조정 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}