// src/routes/api/sales/sales-registration/delete/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';
import { sendSaleNotification } from '$lib/utils/pushSender.js';


// 수불 전표번호 생성
async function generateMoveSlip(db, date, user) {
  const [rows] = await db.execute(`
    SELECT COALESCE(MAX(SLIP_SENO), 0) + 1 AS SENO 
    FROM BISH_SLIP WHERE SLIP_GUBN = 'MV' AND SLIP_DATE = ?
  `, [date]);
  
  const iSeno = rows[0].SENO;
  const moveSlip = 'MV' + date + iSeno.toString().padStart(5, '0');
  
  await db.execute(`
    INSERT INTO BISH_SLIP (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR) 
    VALUES ('MV', ?, ?, ?, ?)
  `, [date, iSeno, moveSlip, user]);
  
  return moveSlip;
}

// 수불 저장
async function addStockMove(db, moveSlip, seno, shop, date, item, qty, reno, menu, user) {
  await db.execute(`
    INSERT INTO STOK_MOVE 
    (MOVE_SLIP, MOVE_SENO, MOVE_SHOP, MOVE_DATE, MOVE_ITEM, MOVE_QTY1, MOVE_RENO, MOVE_MENU, MOVE_IUSR) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [moveSlip, seno, shop, date, item, qty, reno, menu, user]);
}

// 현재고 업데이트 (변화량만 적용)
async function updateCurrentStock(db, item, shop, changeQty, user) {
  const [rows] = await db.execute(`
    SELECT HYUN_QTY1 FROM STOK_HYUN WHERE HYUN_ITEM = ?
  `, [item]);
  
  if (rows.length > 0) {
    const currentStock = parseInt(rows[0].HYUN_QTY1 || 0);
    const newStock = currentStock + changeQty;
    
    await db.execute(`
      UPDATE STOK_HYUN 
      SET HYUN_QTY1 = ?, HYUN_IDAT = NOW(), HYUN_IUSR = ? 
      WHERE HYUN_ITEM = ? 
    `, [newStock, user, item]);
    
    return newStock;
  } else {
    await db.execute(`
      INSERT INTO STOK_HYUN (HYUN_ITEM, HYUN_SHOP, HYUN_QTY1, HYUN_IUSR) 
      VALUES (?, ?, ?, ?)
    `, [item, shop, changeQty, user]);
    
    return changeQty;
  }
}

// 재고관리 여부 확인
async function isStockManaged(db, item, companyCode, registrationCode) {
  const [rows] = await db.execute(`
    SELECT PROD_TXT1 FROM ASSE_PROD 
    WHERE PROD_GUB1 = ? AND PROD_GUB2 = ? AND PROD_CODE = ? AND PROD_COD2 = 'L6'
  `, [companyCode, registrationCode, item]);
  
  return rows.length > 0 && rows[0].PROD_TXT1 == '1';
}

// 매출 삭제 시 수불 반제 (재고 복원)
async function reverseStockMoveForDelete(db, salesSlip, moveSlip, shop, companyCode, registrationCode, user) {
  try {
    const [rows] = await db.execute(`
      SELECT DNDT_ITEM, DNDT_QTY1 FROM SALE_DNDT WHERE DNDT_SLIP = ?
    `, [salesSlip]);
    
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let seno = 1;
    let processedCount = 0;
    
    for (const row of rows) {
      const item = row.DNDT_ITEM;
      const qty = parseInt(row.DNDT_QTY1);
      
      // 재고관리 대상인지 확인
      if (!await isStockManaged(db, item, companyCode, registrationCode)) {
        console.log(`수불 반제 스킵 (재고관리 대상 아님): ${item}`);
        continue;
      }
      
      // 삭제시 반제는 양수로 처리 (재고 복원)
      await addStockMove(db, moveSlip, seno++, shop, date, item, qty, salesSlip, 'SALES_DELETE', user);
      
      // 현재고에 수량 복원
      await updateCurrentStock(db, item, shop, qty, user);
      
      processedCount++;
    }
    
    console.log(`삭제 수불 반제 완료: 매출전표=${salesSlip}, 수불전표=${moveSlip}, 처리건수=${processedCount}`);
    
  } catch (error) {
    console.error('삭제 수불 반제 실패:', error);
    throw error;
  }
}

// 시제 테이블 업데이트 (삭제 후 재계산)
async function updateSijeTableAfterDelete(db, date, shop, user) {
  try {
    // 삭제 후 당일 현금 매출 합계 재계산
    const [salesResult] = await db.execute(`
      SELECT COALESCE(SUM(DNDT_TAMT), 0) AS AMT2 
      FROM SALE_DNHD h
      INNER JOIN SALE_DNDT d ON h.DNHD_SLIP = d.DNDT_SLIP 
      WHERE h.DNHD_SHOP = ? AND d.DNDT_HYGB = '1' AND h.DNHD_DATE = ?
    `, [shop, date]);
    
    const dailySalesTotal = parseInt(salesResult[0].AMT2);

    // 기존 시제 데이터 확인
    const [sijeRows] = await db.execute(`
      SELECT SIJE_AMT1 FROM BISH_SIJE WHERE SIJE_DATE = ? AND SIJE_SHOP = ?
    `, [date, shop]);

    if (sijeRows.length > 0) {
      // 시제 자료 있으면: AMT1=등록된값 유지, AMT2=매출합계, AMT3=등록된값+매출합계
      const existingAmt1 = parseInt(sijeRows[0].SIJE_AMT1);
      const newAmt3 = existingAmt1 + dailySalesTotal;
      
      await db.execute(`
        UPDATE BISH_SIJE SET SIJE_AMT2 = ?, SIJE_AMT3 = ?, SIJE_IUSR = ?, SIJE_UDAT = NOW() 
        WHERE SIJE_DATE = ? AND SIJE_SHOP = ?
      `, [dailySalesTotal, newAmt3, user, date, shop]);
    } else {
      // 시제 자료 없으면: 매출이 0이므로 시제 데이터도 생성하지 않음
      if (dailySalesTotal > 0) {
        await db.execute(`
          INSERT INTO BISH_SIJE (SIJE_DATE, SIJE_SHOP, SIJE_AMT1, SIJE_AMT2, SIJE_AMT3, SIJE_IUSR) 
          VALUES (?, ?, 0, ?, ?, ?)
        `, [date, shop, dailySalesTotal, dailySalesTotal, user]);
      }
    }
    
    console.log(`삭제 후 시제 테이블 업데이트 완료: ${date} / ${shop} / 매출: ${dailySalesTotal}`);
    
  } catch (error) {
    console.error('삭제 후 시제 테이블 업데이트 실패:', error);
    throw error;
  }
}

// 매출 삭제 API
export async function DELETE({ request, locals }) {
  const db = getDb();
  
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const username = user.username;
    const { saleSlip, companyCode, registrationCode } = await request.json();

    console.log('=== 매출 삭제 시작 ===');
    console.log('사용자:', username);
    console.log('매출번호:', saleSlip);

    // 입력값 검증
    if (!saleSlip) {
      return json({ 
        success: false, 
        message: '삭제할 매출번호가 없습니다.' 
      }, { status: 400 });
    }

    // 삭제할 매출이 존재하는지 확인
    const [existingRows] = await db.execute(`
      SELECT DNHD_SLIP, DNHD_SHOP, DNHD_DATE FROM SALE_DNHD WHERE DNHD_SLIP = ?
    `, [saleSlip]);
    
    if (existingRows.length === 0) {
      return json({ 
        success: false, 
        message: '삭제할 매출을 찾을 수 없습니다.' 
      }, { status: 404 });
    }

    const saleData = existingRows[0];
    const shop = saleData.DNHD_SHOP;
    const saleDate = saleData.DNHD_DATE;
    
    let reverseSlip = null;

    // 재고관리가 필요한 경우 반제용 수불 전표번호 생성 (트랜잭션 외부)
    if (companyCode && registrationCode) {
      reverseSlip = await generateMoveSlip(db, saleDate, username);
    }

    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    
    try {
        // 1. 재고 반제 처리 (매출 삭제 전에 수행)
        if (reverseSlip) {
            await reverseStockMoveForDelete(db, saleSlip, reverseSlip, shop, companyCode, registrationCode, username);
            console.log(`재고 반제 완료: 매출=${saleSlip}, 수불=${reverseSlip}`);
        }
        
        // 2. 매출 상세 삭제
        await db.execute(`DELETE FROM SALE_DNDT WHERE DNDT_SLIP = ?`, [saleSlip]);
        console.log('매출 상세 삭제 완료');
        
        // 3. 매출 헤더 삭제
        await db.execute(`DELETE FROM SALE_DNHD WHERE DNHD_SLIP = ?`, [saleSlip]);
        console.log('매출 헤더 삭제 완료');
        
        // 4. 매출번호는 삭제하지 않음 (중복 방지 및 일련번호 관리를 위해 유지)
        // BISH_SLIP 테이블은 그대로 둠
        
        // 5. 시제 테이블 업데이트 (삭제 후 당일 매출 합계 재계산)
        await updateSijeTableAfterDelete(db, saleDate, shop, username);
        console.log('시제 테이블 업데이트 완료');
        
        // 트랜잭션 커밋
        await db.execute('COMMIT');
        
        console.log('=== 매출 삭제 완료 ===');

        // 🔥 시스템 설정 확인 후 푸시 알림 발송
        const { getSystemSetting } = await import('$lib/utils/systemSettings.js');
        const isMessageEnabled = await getSystemSetting('sales_message_enabled', false);

        if (isMessageEnabled) {
          console.log('🔄 매출 삭제 푸시 알림 시작 (설정 활성화):', { slipNo: saleSlip });
          sendSaleNotification(
            '매출 삭제 완료',
            `매출번호: ${saleSlip}이 삭제되었습니다.`,
            { 
              type: 'sale_deleted', 
              slipNo: saleSlip,
              shop: shop,
              date: saleDate
            }
          ).catch(error => {
            console.error('푸시 알림 전송 실패:', error);
          });
        } else {
          console.log('⏸️ 매출 삭제 푸시 알림 비활성화됨 (sales_message_enabled: false)');
        }

        return json({
            success: true, 
            message: '매출이 성공적으로 삭제되었습니다.',
            deletedSlip: saleSlip,
            shop: shop,
            date: saleDate
        });
      
    } catch (error) {
      // 트랜잭션 롤백
      await db.execute('ROLLBACK');
      console.error('트랜잭션 오류:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('매출 삭제 실패:', error);
    return json({
      success: false, 
      message: '삭제 실패: ' + error.message
    }, { status: 500 });
  }
}