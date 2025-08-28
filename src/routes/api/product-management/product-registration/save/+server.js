// src/routes/api/product-management/product-registration/save/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request, locals }) {
  const db = getDb();
  
  try {
    console.log('=== 제품등록 통합 저장 API 시작 ===');
    
    // 인증 확인
    const user = locals.user;
    if (!user) {
      console.log('❌ 인증되지 않은 사용자');
      return json({ 
        success: false, 
        message: '인증이 필요합니다.' 
      }, { status: 401 });
    }

    const data = await request.json();
    console.log('📝 받은 데이터:', data);
    
    const { 
      companyCode,      // 회사구분 코드
      registrationCode, // 등록구분 코드  
      basicInfo,        // 기본정보
      priceInfo,        // 가격정보 (제품정보일 때만)
      discountInfo,     // 할인정보 (제품정보일 때만)
      detailItems       // 상세내역 배열
    } = data;
    
    // 1단계: 입력 검증
    if (!basicInfo.code || !basicInfo.code.trim()) {
      return json({ 
        success: false, 
        message: '제품 코드를 입력해주세요.' 
      }, { status: 400 });
    }
    
    if (!basicInfo.name || !basicInfo.name.trim()) {
      return json({ 
        success: false, 
        message: '제품 명칭을 입력해주세요.' 
      }, { status: 400 });
    }
    
    if (!companyCode || !registrationCode) {
      return json({ 
        success: false, 
        message: '회사구분과 등록구분을 선택해주세요.' 
      }, { status: 400 });
    }
    
    if (!detailItems || !Array.isArray(detailItems) || detailItems.length === 0) {
      return json({ 
        success: false, 
        message: '상세내역 구조가 없습니다. 등록구분을 선택하여 상세내역을 조회해주세요.' 
      }, { status: 400 });
    }
    
    // 2단계: 기존 데이터 체크
    const [existingRows] = await db.execute(`
      SELECT PROH_CODE, PROH_NAME FROM ASSE_PROH 
      WHERE PROH_GUB1 = ? AND PROH_GUB2 = ? AND PROH_CODE = ?
    `, [companyCode, registrationCode, basicInfo.code.trim()]);
    
    const isUpdate = existingRows.length > 0;
    
    if (isUpdate) {
      console.log('📄 기존 제품 발견:', existingRows[0]);
      return json({
        success: false,
        needConfirm: true,
        message: `기존 제품이 있습니다.\n제품명: ${existingRows[0].PROH_NAME}\n수정하시겠습니까?`,
        existingProduct: existingRows[0]
      });
    }
    
    console.log('🆕 신규 제품 등록 진행');
    
    // 3단계: 가격정보 변경 시 연번 생성 (트랜잭션 외부)
    let priceSeqNo = null;
    if (priceInfo) {
      priceSeqNo = await generatePriceSeqNo(db, user.username);
      console.log('📊 가격 연번 생성:', priceSeqNo);
    }
    
    // 4단계: 트랜잭션 시작
    await db.execute('START TRANSACTION');
    console.log('🔄 트랜잭션 시작');
    
    try {
      // 5단계: 기본정보 저장 (ASSE_PROH)
      await saveBasicInfo(db, {
        companyCode,
        registrationCode,
        basicInfo,
        user: user.username,
        isUpdate: false
      });
      
      // 6단계: 가격정보 저장 (제품정보일 때만)
      if (priceInfo) {
        await savePriceInfo(db, {
          productCode: basicInfo.code.trim(),
          priceInfo,
          user: user.username,
          seqNo: priceSeqNo
        });
      }
      
      // 7단계: 할인정보 저장 (제품정보일 때만)
      if (discountInfo && discountInfo.discountType) {
        await saveDiscountInfo(db, {
          productCode: basicInfo.code.trim(),
          discountInfo,
          user: user.username
        });
      }
      
      // 8단계: 상세내역 저장 (ASSE_PROD)
      await saveDetailItems(db, {
        companyCode,
        registrationCode,
        productCode: basicInfo.code.trim(),
        detailItems,
        user: user.username
      });
      
      // 9단계: 상세내역 이력 저장 (ASSE_PROT)
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await saveDetailHistory(db, {
        companyCode,
        registrationCode,
        productCode: basicInfo.code.trim(),
        detailItems,
        user: user.username,
        date: today
      });
      
      // 트랜잭션 커밋
      await db.execute('COMMIT');
      console.log('✅ 트랜잭션 커밋 완료');
      
      return json({
        success: true,
        message: '제품이 성공적으로 등록되었습니다.',
        productCode: basicInfo.code.trim()
      });
      
    } catch (error) {
      // 트랜잭션 롤백
      await db.execute('ROLLBACK');
      console.log('❌ 트랜잭션 롤백');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 제품등록 저장 오류:', error);
    return json({
      success: false,
      message: '저장 중 오류가 발생했습니다: ' + error.message
    }, { status: 500 });
  }
}

// 확인 후 저장 (기존 제품 수정)
export async function PUT({ request, locals }) {
  const db = getDb();
  
  try {
    console.log('=== 제품등록 수정 저장 API 시작 ===');
    
    const user = locals.user;
    if (!user) {
      return json({ 
        success: false, 
        message: '인증이 필요합니다.' 
      }, { status: 401 });
    }

    const data = await request.json();
    const { companyCode, registrationCode, basicInfo, priceInfo, discountInfo, detailItems } = data;
    
    // 입력 검증 (수정 모드에서도 동일)
    if (!basicInfo.code || !basicInfo.code.trim()) {
      return json({ 
        success: false, 
        message: '제품 코드를 입력해주세요.' 
      }, { status: 400 });
    }
    
    if (!basicInfo.name || !basicInfo.name.trim()) {
      return json({ 
        success: false, 
        message: '제품 명칭을 입력해주세요.' 
      }, { status: 400 });
    }
    
    if (!companyCode || !registrationCode) {
      return json({ 
        success: false, 
        message: '회사구분과 등록구분을 선택해주세요.' 
      }, { status: 400 });
    }
    
    if (!detailItems || !Array.isArray(detailItems) || detailItems.length === 0) {
      return json({ 
        success: false, 
        message: '상세내역 구조가 없습니다. 등록구분을 선택하여 상세내역을 조회해주세요.' 
      }, { status: 400 });
    }
    
    // 가격정보 변경 시 연번 생성 (트랜잭션 외부)
    let priceSeqNo = null;
    if (priceInfo) {
      priceSeqNo = await generatePriceSeqNo(db, user.username);
      console.log('📊 수정 시 가격 연번 생성:', priceSeqNo);
    }
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    console.log('🔄 수정 트랜잭션 시작');
    
    try {
      // 기본정보 수정
      await saveBasicInfo(db, {
        companyCode,
        registrationCode,
        basicInfo,
        user: user.username,
        isUpdate: true
      });
      
      // 가격정보 저장
      if (priceInfo) {
        await savePriceInfo(db, {
          productCode: basicInfo.code.trim(),
          priceInfo,
          user: user.username,
          seqNo: priceSeqNo
        });
      }
      
      // 할인정보 저장
      if (discountInfo && discountInfo.discountType) {
        await saveDiscountInfo(db, {
          productCode: basicInfo.code.trim(),
          discountInfo,
          user: user.username
        });
      }
      
      // 상세내역 저장
      await saveDetailItems(db, {
        companyCode,
        registrationCode,
        productCode: basicInfo.code.trim(),
        detailItems,
        user: user.username
      });
      
      // 상세내역 이력 저장
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await saveDetailHistory(db, {
        companyCode,
        registrationCode,
        productCode: basicInfo.code.trim(),
        detailItems,
        user: user.username,
        date: today
      });
      
      await db.execute('COMMIT');
      console.log('✅ 수정 트랜잭션 커밋 완료');
      
      return json({
        success: true,
        message: '제품이 성공적으로 수정되었습니다.',
        productCode: basicInfo.code.trim()
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      console.log('❌ 수정 트랜잭션 롤백');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 제품등록 수정 오류:', error);
    return json({
      success: false,
      message: '수정 중 오류가 발생했습니다: ' + error.message
    }, { status: 500 });
  }
}

// 연번 생성 함수 (트랜잭션 외부)
async function generatePriceSeqNo(db, user) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const gubn = 'PRICE'; // 가격 구분
  
  console.log('🔢 연번 생성 시작:', { gubn, today });
  
  // 1. 최대 연번 조회
  const [seqResult] = await db.execute(`
    SELECT IFNULL(MAX(SLIP_SENO), 0) + 1 AS SENO
    FROM BISH_SLIP
    WHERE SLIP_GUBN = ? AND SLIP_DATE = ?
    LIMIT 1
  `, [gubn, today]);
  
  const seqNo = seqResult[0]?.SENO || 1;
  
  // 2. BISH_SLIP에 연번 등록 (트랜잭션 외부)
  await db.execute(`
    INSERT INTO BISH_SLIP 
    (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR)
    VALUES (?, ?, ?, '', ?)
  `, [gubn, today, seqNo, user]);
  
  console.log('✅ 연번 생성 완료:', seqNo);
  
  return seqNo;
}

// 기본정보 저장 함수 (기존과 동일)
async function saveBasicInfo(db, { companyCode, registrationCode, basicInfo, user, isUpdate }) {
  console.log('💾 기본정보 저장:', { isUpdate, code: basicInfo.code });
  
  if (isUpdate) {
    await db.execute(`
      UPDATE ASSE_PROH 
      SET PROH_NAME = ?, PROH_CDOT = ?, PROH_BIGO = ?, PROH_QRCD = ?,
          PROH_IDAT = NOW(), PROH_IUSR = ?
      WHERE PROH_GUB1 = ? AND PROH_GUB2 = ? AND PROH_CODE = ?
    `, [
      basicInfo.name.trim(),
      basicInfo.externalCode.trim() || '',
      basicInfo.description.trim() || '',
      basicInfo.qrCode.trim() || '',
      user,
      companyCode,
      registrationCode,
      basicInfo.code.trim()
    ]);
    
    console.log('✅ 기본정보 수정 완료');
  } else {
    await db.execute(`
      INSERT INTO ASSE_PROH 
      (PROH_GUB1, PROH_GUB2, PROH_CODE, PROH_NAME, PROH_CDOT, PROH_BIGO, PROH_QRCD, PROH_IUSR)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      companyCode,
      registrationCode,
      basicInfo.code.trim(),
      basicInfo.name.trim(),
      basicInfo.externalCode.trim() || '',
      basicInfo.description.trim() || '',
      basicInfo.qrCode.trim() || '',
      user
    ]);
    
    console.log('✅ 기본정보 신규 생성 완료');
  }
}

// 가격정보 저장 함수 (신규 추가)
async function savePriceInfo(db, { productCode, priceInfo, user, seqNo }) {
  console.log('💰 가격정보 저장:', productCode);
  
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // 1. 현재 가격정보 저장/수정 (BISH_DPRC)
  const [existingPrice] = await db.execute(`
    SELECT DPRC_CODE FROM BISH_DPRC WHERE DPRC_CODE = ?
  `, [productCode]);
  
  if (existingPrice.length > 0) {
    // 기존 가격 수정
    await db.execute(`
      UPDATE BISH_DPRC 
      SET DPRC_BAPR = ?, DPRC_SOPR = ?, DPRC_DCPR = ?, DPRC_DEPR = ?
      WHERE DPRC_CODE = ?
    `, [
      priceInfo.basePriceChecked ? priceInfo.basePrice : 0,
      priceInfo.cardPriceChecked ? priceInfo.cardPrice : 0,
      priceInfo.cashPriceChecked ? priceInfo.cashPrice : 0,
      priceInfo.deliveryPriceChecked ? priceInfo.deliveryPrice : 0,
      productCode
    ]);
    
    console.log('📝 가격정보 수정 완료');
  } else {
    // 신규 가격 생성
    await db.execute(`
      INSERT INTO BISH_DPRC 
      (DPRC_CODE, DPRC_BAPR, DPRC_SOPR, DPRC_DCPR, DPRC_DEPR)
      VALUES (?, ?, ?, ?, ?)
    `, [
      productCode,
      priceInfo.basePriceChecked ? priceInfo.basePrice : 0,
      priceInfo.cardPriceChecked ? priceInfo.cardPrice : 0,
      priceInfo.cashPriceChecked ? priceInfo.cashPrice : 0,
      priceInfo.deliveryPriceChecked ? priceInfo.deliveryPrice : 0
    ]);
    
    console.log('🆕 가격정보 생성 완료');
  }
  
  // 2. 가격 이력 저장 (BISH_DPRC_HIST) - 무조건 INSERT
  await db.execute(`
    INSERT INTO BISH_DPRC_HIST 
    (DPRC_CODE, DPRC_DATE, DPRC_SENO, DPRC_CDNM, DPRC_BAPR, DPRC_SOPR, DPRC_DCPR, DPRC_DEPR, DPRC_IUSR)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    productCode,
    today,
    seqNo,
    productCode, // DPRC_CDNM에 제품코드 저장
    priceInfo.basePriceChecked ? priceInfo.basePrice : 0,
    priceInfo.cardPriceChecked ? priceInfo.cardPrice : 0,
    priceInfo.cashPriceChecked ? priceInfo.cashPrice : 0,
    priceInfo.deliveryPriceChecked ? priceInfo.deliveryPrice : 0,
    user
  ]);
  
  console.log('📜 가격 이력 저장 완료 - 연번:', seqNo);
}

// 할인정보 저장 함수 (신규 추가)
async function saveDiscountInfo(db, { productCode, discountInfo, user }) {
  console.log('🎯 할인정보 저장:', productCode);
  
  // 기존 할인정보 확인
  const [existingDiscount] = await db.execute(`
    SELECT YOUL_ITEM FROM BISH_YOUL WHERE YOUL_ITEM = ?
  `, [productCode]);
  
  if (existingDiscount.length > 0) {
    // 기존 할인정보 수정
    await db.execute(`
      UPDATE BISH_YOUL 
      SET YOUL_GUBN = ?, YOUL_QTY1 = ?, YOUL_AMT1 = ?
      WHERE YOUL_ITEM = ?
    `, [
      discountInfo.discountType,
      discountInfo.quantity || 0,
      discountInfo.amount || 0,
      productCode
    ]);
    
    console.log('📝 할인정보 수정 완료');
  } else {
    // 신규 할인정보 생성
    await db.execute(`
      INSERT INTO BISH_YOUL 
      (YOUL_GUBN, YOUL_QTY1, YOUL_AMT1, YOUL_ITEM)
      VALUES (?, ?, ?, ?)
    `, [
      discountInfo.discountType,
      discountInfo.quantity || 0,
      discountInfo.amount || 0,
      productCode
    ]);
    
    console.log('🆕 할인정보 생성 완료');
  }
}

// 상세내역 저장 함수 (기존과 동일)
async function saveDetailItems(db, { companyCode, registrationCode, productCode, detailItems, user }) {
  console.log('💾 상세내역 저장:', detailItems.length + '개');
  
  if (!detailItems || detailItems.length === 0) {
    throw new Error('상세내역 구조가 없습니다.');
  }
  
  for (const item of detailItems) {
    const inputValue = item.inputValue || '';
    
    const [existingRows] = await db.execute(`
      SELECT PROD_COD2 FROM ASSE_PROD 
      WHERE PROD_GUB1 = ? AND PROD_GUB2 = ? AND PROD_CODE = ? AND PROD_COD2 = ?
    `, [companyCode, registrationCode, productCode, item.MINR_CODE]);
    
    if (existingRows.length > 0) {
      await db.execute(`
        UPDATE ASSE_PROD 
        SET PROD_TXT1 = ?, PROD_NUM1 = 0, PROD_IDAT = NOW(), PROD_IUSR = ?
        WHERE PROD_GUB1 = ? AND PROD_GUB2 = ? AND PROD_CODE = ? AND PROD_COD2 = ?
      `, [inputValue, user, companyCode, registrationCode, productCode, item.MINR_CODE]);
      
      console.log(`📝 상세내역 수정: ${item.MINR_CODE} = "${inputValue}"`);
    } else {
      await db.execute(`
        INSERT INTO ASSE_PROD 
        (PROD_GUB1, PROD_GUB2, PROD_CODE, PROD_COD2, PROD_TXT1, PROD_NUM1, PROD_IUSR)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `, [companyCode, registrationCode, productCode, item.MINR_CODE, inputValue, user]);
      
      console.log(`🆕 상세내역 생성: ${item.MINR_CODE} = "${inputValue}"`);
    }
  }
  
  console.log('✅ 상세내역 저장 완료');
}

// 상세내역 이력 저장 함수 (기존과 동일)
async function saveDetailHistory(db, { companyCode, registrationCode, productCode, detailItems, user, date }) {
  console.log('📜 상세내역 이력 저장:', date);
  
  if (!detailItems || detailItems.length === 0) {
    throw new Error('상세내역 구조가 없습니다.');
  }
  
  for (const item of detailItems) {
    const inputValue = item.inputValue || '';
    
    const [existingRows] = await db.execute(`
      SELECT PROT_DATE FROM ASSE_PROT 
      WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? AND PROT_CODE = ? 
      AND PROT_COD2 = ? AND PROT_DATE = ?
    `, [companyCode, registrationCode, productCode, item.MINR_CODE, date]);
    
    if (existingRows.length > 0) {
      await db.execute(`
        UPDATE ASSE_PROT 
        SET PROT_TXT1 = ?, PROT_NUM1 = '0', PROT_IDAT = NOW(), PROT_IUSR = ?
        WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? AND PROT_CODE = ? 
        AND PROT_COD2 = ? AND PROT_DATE = ?
      `, [inputValue, user, companyCode, registrationCode, productCode, item.MINR_CODE, date]);
      
      console.log(`📝 이력 수정: ${item.MINR_CODE} / ${date}`);
    } else {
      await db.execute(`
        INSERT INTO ASSE_PROT 
        (PROT_GUB1, PROT_GUB2, PROT_CODE, PROT_COD2, PROT_DATE, PROT_TXT1, PROT_NUM1, PROT_IUSR)
        VALUES (?, ?, ?, ?, ?, ?, '0', ?)
      `, [companyCode, registrationCode, productCode, item.MINR_CODE, date, inputValue, user]);
      
      console.log(`🆕 이력 생성: ${item.MINR_CODE} / ${date}`);
    }
  }
  
  console.log('✅ 상세내역 이력 저장 완료');
}