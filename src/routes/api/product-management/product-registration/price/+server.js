// src/routes/api/product-management/product-registration/price/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { productCode, priceData, discountData } = await request.json();
    
    console.log('=== 가격 전용 API 호출 ===');
    console.log('제품코드:', productCode);
    console.log('가격데이터:', priceData);
    console.log('할인데이터:', discountData);
    console.log('사용자:', user.username);
    
    if (!productCode) {
      return json({ 
        success: false, 
        message: '제품 코드가 필요합니다.' 
      }, { status: 400 });
    }
    
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    console.log('🔄 가격 저장 트랜잭션 시작');
    
    try {
      // 1. BISH_DPRC (현재 가격) 저장/수정 - 체크박스 확인
      if (priceData && priceData.priceEnabled) {
        console.log('💰 가격정보 처리 시작 (체크박스 체크됨)');
        
        // 기존 가격 확인
        const [existingPrice] = await db.execute(`
          SELECT DPRC_CODE FROM BISH_DPRC WHERE DPRC_CODE = ?
        `, [productCode]);
        
        if (existingPrice.length > 0) {
          // 기존 가격 수정
          await db.execute(`
            UPDATE BISH_DPRC 
            SET DPRC_BAPR = ?, DPRC_SOPR = ?, DPRC_DCPR = ?, DPRC_DEPR = ?, 
                DPRC_IDAT = NOW(), DPRC_IUSR = ?
            WHERE DPRC_CODE = ?
          `, [
            priceData.basePrice || 0,
            priceData.cardPrice || 0,
            priceData.cashPrice || 0,
            priceData.deliveryPrice || 0,
            user.username,
            productCode
          ]);
          console.log('📝 기존 가격정보 수정 완료');
        } else {
          // 신규 가격 생성
          await db.execute(`
            INSERT INTO BISH_DPRC 
            (DPRC_CODE, DPRC_BAPR, DPRC_SOPR, DPRC_DCPR, DPRC_DEPR, DPRC_IUSR)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            productCode,
            priceData.basePrice || 0,
            priceData.cardPrice || 0,
            priceData.cashPrice || 0,
            priceData.deliveryPrice || 0,
            user.username
          ]);
          console.log('🆕 신규 가격정보 생성 완료');
        }
        
        // 2. BISH_DPRC_HIST (가격 히스토리) 추가
        console.log('📜 가격 히스토리 저장 시작');
        
        // 히스토리 연번 생성
        const [seqResult] = await db.execute(`
          SELECT IFNULL(MAX(DPRC_SENO), 0) + 1 AS SENO
          FROM BISH_DPRC_HIST
          WHERE DPRC_CODE = ? AND DPRC_DATE = ?
        `, [productCode, today]);
        
        const seqNo = seqResult[0]?.SENO || 1;
        
        await db.execute(`
          INSERT INTO BISH_DPRC_HIST 
          (DPRC_CODE, DPRC_DATE, DPRC_SENO, DPRC_CDNM, DPRC_BAPR, DPRC_SOPR, DPRC_DCPR, DPRC_DEPR, DPRC_IUSR)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          productCode,
          today,
          seqNo,
          productCode,  // DPRC_CDNM에 제품코드 저장
          priceData.basePrice || 0,
          priceData.cardPrice || 0,
          priceData.cashPrice || 0,
          priceData.deliveryPrice || 0,
          user.username
        ]);
        
        console.log('✅ 가격 히스토리 저장 완료 - 연번:', seqNo);
      } else if (priceData && !priceData.priceEnabled) {
        console.log('🚫 가격정보 체크박스 해제됨 - 가격 저장 건너뜀');
      }
      
      // 3. BISH_YOUL (수량할인) 저장/수정 - 체크박스 확인
      if (discountData && discountData.isChecked) {
        console.log('🎯 할인정보 처리 시작 (체크박스 체크됨)');
        
        // 기존 할인정보 확인
        const [existingDiscount] = await db.execute(`
          SELECT YOUL_ITEM FROM BISH_YOUL WHERE YOUL_ITEM = ?
        `, [productCode]);
        
        if (existingDiscount.length > 0) {
          // 기존 할인정보 수정
          await db.execute(`
            UPDATE BISH_YOUL 
            SET YOUL_GUBN = ?, YOUL_QTY1 = ?, YOUL_AMT1 = ?, 
                YOUL_IDAT = NOW(), YOUL_IUSR = ?
            WHERE YOUL_ITEM = ?
          `, [
            discountData.discountType || '0',
            discountData.quantity || 0,
            discountData.amount || 0,
            user.username,
            productCode
          ]);
          console.log('📝 기존 할인정보 수정 완료');
        } else {
          // 신규 할인정보 생성
          await db.execute(`
            INSERT INTO BISH_YOUL 
            (YOUL_ITEM, YOUL_GUBN, YOUL_QTY1, YOUL_AMT1, YOUL_IUSR)
            VALUES (?, ?, ?, ?, ?)
          `, [
            productCode,
            discountData.discountType || '0',
            discountData.quantity || 0,
            discountData.amount || 0,
            user.username
          ]);
          console.log('🆕 신규 할인정보 생성 완료');
        }
      } else if (discountData && !discountData.isChecked) {
        // 할인정보 체크 해제 시 삭제
        console.log('🗑️ 할인정보 체크박스 해제됨 - 할인정보 삭제');
        await db.execute(`
          DELETE FROM BISH_YOUL WHERE YOUL_ITEM = ?
        `, [productCode]);
        console.log('✅ 할인정보 삭제 완료');
      }
      
      // 트랜잭션 커밋
      await db.execute('COMMIT');
      console.log('✅ 가격 저장 트랜잭션 커밋 완료');
      
      return json({
        success: true,
        message: '가격 정보가 저장되었습니다.',
        productCode
      });
      
    } catch (error) {
      // 트랜잭션 롤백
      await db.execute('ROLLBACK');
      console.log('❌ 가격 저장 트랜잭션 롤백');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 가격 저장 API 오류:', error);
    return json({
      success: false,
      message: '가격 저장 중 오류가 발생했습니다: ' + error.message
    }, { status: 500 });
  }
}