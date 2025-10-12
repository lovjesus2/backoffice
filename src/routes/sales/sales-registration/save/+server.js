// src/routes/api/sales/sales-registration/save/+server.js
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
      INSERT INTO STOK_HYUN (HYUN_ITEM, HYUN_QTY1, HYUN_IUSR) 
      VALUES (?, ?, ?)
    `, [item, changeQty, user]);
    
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

// 기존 매출 수불 반제
async function reverseStockMove(db, salesSlip, moveSlip, shop, companyCode, registrationCode, user) {
  const [rows] = await db.execute(`
    SELECT DNDT_ITEM, DNDT_QTY1 FROM SALE_DNDT WHERE DNDT_SLIP = ?
  `, [salesSlip]);
  
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let seno = 1;
  
  for (const row of rows) {
    const item = row.DNDT_ITEM;
    const qty = parseInt(row.DNDT_QTY1);
    
    if (await isStockManaged(db, item, companyCode, registrationCode)) {
      await addStockMove(db, moveSlip, seno++, shop, date, item, qty, salesSlip, 'SALES_REVERSE', user);
      await updateCurrentStock(db, item, shop, qty, user);
    }
  }
}

// 매출 수불 처리
async function processStockMove(db, salesSlip, detailItems, moveSlip, shop, companyCode, registrationCode, user) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let seno = 1;
  
  for (const item of detailItems) {
    if (await isStockManaged(db, item.itemCode, companyCode, registrationCode)) {
      await addStockMove(db, moveSlip, seno++, shop, date, item.itemCode, -parseInt(item.quantity), salesSlip, 'SALES_REG', user);
      await updateCurrentStock(db, item.itemCode, shop, -parseInt(item.quantity), user);
    }
  }
}

// 시제 테이블 업데이트
async function updateSijeTable(db, date, shop, user) {
  const [salesResult] = await db.execute(`
    SELECT COALESCE(SUM(DNDT_TAMT), 0) AS AMT2 
    FROM SALE_DNHD h
    INNER JOIN SALE_DNDT d ON h.DNHD_SLIP = d.DNDT_SLIP 
    WHERE h.DNHD_SHOP = ? AND d.DNDT_HYGB = '1' AND h.DNHD_DATE = ?
  `, [shop, date]);
  
  const dailySalesTotal = parseInt(salesResult[0].AMT2);
  
  const [sijeRows] = await db.execute(`
    SELECT SIJE_AMT1 FROM BISH_SIJE WHERE SIJE_DATE = ? AND SIJE_SHOP = ?
  `, [date, shop]);

  if (sijeRows.length > 0) {
    const existingAmt1 = parseInt(sijeRows[0].SIJE_AMT1);
    const newAmt3 = existingAmt1 + dailySalesTotal;
    
    await db.execute(`
      UPDATE BISH_SIJE SET SIJE_AMT2 = ?, SIJE_AMT3 = ?, SIJE_IUSR = ?, SIJE_UDAT = NOW() 
      WHERE SIJE_DATE = ? AND SIJE_SHOP = ?
    `, [dailySalesTotal, newAmt3, user, date, shop]);
  } else {
    await db.execute(`
      INSERT INTO BISH_SIJE (SIJE_DATE, SIJE_SHOP, SIJE_AMT1, SIJE_AMT2, SIJE_AMT3, SIJE_IUSR, SIJE_IDAT, SIJE_UDAT) 
      VALUES (?, ?, 0, ?, ?, ?,NOW(), NOW())
    `, [date, shop, dailySalesTotal, dailySalesTotal, user]);
  }
}

export async function POST({ request, locals }) {
  const db = getDb();
  
  try {
    const user = locals.user;
    if (!user?.username) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const username = user.username;
    const { saleInfo, detailItems, summaryData, selectedSaleSlip, companyCode, registrationCode } = await request.json();

    // 입력값 검증
    if (!saleInfo?.date) {
      return json({ success: false, message: '매출일자를 입력해주세요.' }, { status: 400 });
    }
    if (!saleInfo?.shopCode) {
      return json({ success: false, message: '매장을 선택해주세요.' }, { status: 400 });
    }
    if (!saleInfo?.categoryCode) {
      return json({ success: false, message: '매출구분을 선택해주세요.' }, { status: 400 });
    }
    if (!detailItems?.length) {
      return json({ success: false, message: '매출 상세내역이 없습니다.' }, { status: 400 });
    }

    const saleDate = saleInfo.date.replace(/-/g, '');
    const totalQty = parseInt(summaryData.totalQty || 0);
    const totalAmt = parseInt(summaryData.totalAmount || 0);
    
    let sSlip = selectedSaleSlip;
    let randomStr = null;
    let reverseSlip = null;
    let salesSlip = null;

    // 로직 분기: 신규 vs 수정
    if (!sSlip) {
      // 신규 매출: 새 번호 생성 (트랜잭션 외부)
      const [senoRows] = await db.execute(`
        SELECT COALESCE(MAX(SLIP_SENO), 0) + 1 AS SENO 
        FROM BISH_SLIP WHERE SLIP_GUBN = ? AND SLIP_DATE = ?
      `, [saleInfo.categoryCode, saleDate]);
      
      const iSeno = senoRows[0].SENO;
      sSlip = saleInfo.categoryCode + saleDate + iSeno.toString().padStart(5, '0');
      
      await db.execute(`
        INSERT INTO BISH_SLIP (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR) 
        VALUES (?, ?, ?, ?, ?)
      `, [saleInfo.categoryCode, saleDate, iSeno, sSlip, username]);
      
    } else {
      // 기존 매출 수정: 반제용 수불 번호 생성
      if (companyCode && registrationCode) {
        reverseSlip = await generateMoveSlip(db, saleDate, username);
      }
    }
    
    // 신규 수불 번호 생성 (신규/수정 공통)
    if (companyCode && registrationCode) {
      salesSlip = await generateMoveSlip(db, saleDate, username);
    }

    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    
    try {
      // 기존 매출 수정인 경우: 수불 반제
      if (reverseSlip) {
        await reverseStockMove(db, sSlip, reverseSlip, saleInfo.shopCode, companyCode, registrationCode, username);
      }
      
      // 기존 매출 상세 삭제
      await db.execute(`DELETE FROM SALE_DNDT WHERE DNDT_SLIP = ?`, [sSlip]);
      
      // 매출 헤더 저장/업데이트
      const [existingRows] = await db.execute(`
        SELECT DNHD_RAND FROM SALE_DNHD WHERE DNHD_SLIP = ?
      `, [sSlip]);
      
      if (existingRows.length > 0) {
        // 수정 모드
        randomStr = existingRows[0].DNHD_RAND;
        await db.execute(`
          UPDATE SALE_DNHD SET 
          DNHD_DATE = ?, DNHD_SHOP = ?, DNHD_BPCD = ?, DNHD_SLGB = ?,
          DNHD_QTY1 = ?, DNHD_TAMT = ?, DNHD_BIGO = ?, DNHD_IUSR = ?, DNHD_UDAT = NOW() 
          WHERE DNHD_SLIP = ?
        `, [saleDate, saleInfo.shopCode, saleInfo.customerCode || '', 
            saleInfo.categoryCode, totalQty, totalAmt, saleInfo.memo || '', username, sSlip]);
      } else {
        // 신규 모드
        randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        await db.execute(`
          INSERT INTO SALE_DNHD 
          (DNHD_SLIP, DNHD_DATE, DNHD_SHOP, DNHD_BPCD, DNHD_SLGB, 
           DNHD_QTY1, DNHD_TAMT, DNHD_BIGO, DNHD_RAND, DNHD_IUSR) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [sSlip, saleDate, saleInfo.shopCode, saleInfo.customerCode || '',
            saleInfo.categoryCode, totalQty, totalAmt, saleInfo.memo || '', randomStr, username]);
      }
      
      // 매출 상세 저장
      for (let index = 0; index < detailItems.length; index++) {
        const item = detailItems[index];
        const hygb = item.isCash ? '1' : '0';
        
        await db.execute(`
          INSERT INTO SALE_DNDT 
          (DNDT_SLIP, DNDT_SENO, DNDT_ITEM, DNDT_HYGB, DNDT_QTY1, DNDT_TAMT, DNDT_IUSR) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [sSlip, index + 1, item.itemCode, hygb, parseInt(item.quantity), parseInt(item.amount), username]);
      }
      
      // 새로운 매출 수불 처리
      if (salesSlip) {
        await processStockMove(db, sSlip, detailItems, salesSlip, saleInfo.shopCode, companyCode, registrationCode, username);
      }
      
      // 시제 테이블 업데이트
      await updateSijeTable(db, saleDate, saleInfo.shopCode, username);
      
      await db.execute('COMMIT');
      
      //신규 저장만 푸시 알림
      if (existingRows.length <= 0) {
        console.log('🔄 푸시 알림 시작:', { slipNo: sSlip, totalAmt });
        // 🔥 여기에 푸시 알림 함수 호출
        sendSaleNotification(
          '매출 저장 완료',
          `매출번호: ${sSlip}\n금액: ${totalAmt.toLocaleString()}원`,
          { 
            type: 'sale_saved', 
            slipNo: sSlip,
            amount: totalAmt.toString()
          }
        ).catch(error => {
          console.error('푸시 알림 전송 실패:', error);
        });
      }
      return json({
        success: true, 
        message: '매출이 저장되었습니다.', 
        slipNo: sSlip,
        rand: randomStr,
        shop: saleInfo.shopCode,
        date: saleDate
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('매출등록 저장 실패:', error);
    return json({ success: false, message: '저장 실패: ' + error.message }, { status: 500 });
  }
}