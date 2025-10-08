import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const slip = url.searchParams.get('slip');
    const company_code = url.searchParams.get('company_code'); // 추가
    const registration_code = url.searchParams.get('registration_code'); // 추가
    
    console.log('매출 상세 조회 요청:', { 
      slip, 
      company_code, 
      registration_code, 
      user: user.username 
    });
    
    if (!slip || !company_code || !registration_code) {
      return json({
        success: false,
        message: '매출번호, 회사구분, 등록구분이 필요합니다.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    const sql = `
        SELECT DNDT_SLIP, DNDT_SENO, DNDT_ITEM, DNDT_HYGB, DNDT_QTY1,
                DNDT_TAMT, PROH_NAME, PROH_BIGO, DPRC_SOPR, DPRC_DCPR,
                DPRC_DEPR, DNHD_RAND, IFNULL(HYUN_QTY1,0) AS HYUN_QTY1,
                IFNULL(PROH_QRCD,'') AS PROH_QRCD,
                IFNULL(YOUL_QTY1,0) AS YOUL_QTY1,
                IFNULL(YOUL_AMT1,0) AS YOUL_AMT1,
                DNHD_DATE, DNHD_SLGB, MINR_NAME, DNHD_SHOP, DNHD_BPCD,
                IFNULL(BPCD_NAME,'') AS BPCD_NAME,
                IFNULL(SHOP_NAME,'') AS SHOP_NAME, DNHD_BIGO,
                (SELECT IFNULL(MIN(PROD_TXT1),'')
                FROM ASSE_PROD
                WHERE PROD_CODE = DNDT_ITEM
                    AND PROD_GUB1 = ?
                    AND PROD_GUB2 = ?
                    AND PROD_COD2 = 'L3'
                ) AS HYGB,
                (SELECT IFNULL(MIN(PROD_TXT1),'')
                FROM ASSE_PROD
                WHERE PROD_CODE = DNDT_ITEM
                    AND PROD_GUB1 = ?
                    AND PROD_GUB2 = ?
                    AND PROD_COD2 = 'L6'
                ) AS HYUN,
                (SELECT IFNULL(MIN(PROD_TXT1),'')
                FROM ASSE_PROD
                WHERE PROD_CODE = DNDT_ITEM
                    AND PROD_GUB1 = ?
                    AND PROD_GUB2 = ?
                    AND PROD_COD2 = 'L7'
                ) AS ONLINE_STATUS,
                IFNULL(YOUL_GUBN,0) AS YOUL_GUBN,
                IFNULL(POST_MESS,'') AS POST_MESS
        FROM SALE_DNDT
      INNER JOIN SALE_DNHD ON DNHD_SLIP = DNDT_SLIP
      INNER JOIN ASSE_PROH ON PROH_CODE = DNDT_ITEM
      INNER JOIN BISH_MINR ON MINR_MJCD = 'D0001' AND MINR_CODE = DNHD_SLGB
      INNER JOIN BISH_SHOP ON SHOP_CODE = DNHD_SHOP
      INNER JOIN BISH_DPRC ON DPRC_CODE = DNDT_ITEM
      LEFT JOIN BISH_YOUL ON YOUL_ITEM = DNDT_ITEM
      LEFT JOIN BISH_BPCD ON BPCD_CODE = DNHD_BPCD
      LEFT JOIN SALE_POST ON DNHD_SLIP = POST_SLIP
      LEFT JOIN STOK_HYUN ON HYUN_ITEM = DNDT_ITEM
      WHERE DNDT_SLIP = ?
      ORDER BY DNDT_SENO ASC
    `;
    
    // 파라미터 순서: company_code(2번), registration_code(2번), slip(1번)
    const [rows] = await db.execute(sql, [
        company_code, registration_code,  // L3 서브쿼리
        company_code, registration_code,  // L6 서브쿼리  
        company_code, registration_code,  // L7 서브쿼리 (추가) 
      slip                              // WHERE 조건
    ]);
    console.log('DB 조회 결과:', rows.length, '개 행');
    
    if (rows.length === 0) {
      return json({
        success: false,
        message: '매출 데이터를 찾을 수 없습니다.'
      }, { status: 404 });
    }
    
    // 기본정보 (첫 번째 행에서 추출)
    const firstRow = rows[0];
    const basicInfo = {
      slip: firstRow.DNDT_SLIP,
      date: firstRow.DNHD_DATE,
      categoryCode: firstRow.DNHD_SLGB,
      categoryName: firstRow.MINR_NAME,
      shopCode: firstRow.DNHD_SHOP,
      shopName: firstRow.SHOP_NAME,
      customerCode: firstRow.DNHD_BPCD,
      customerName: firstRow.BPCD_NAME,
      memo: firstRow.DNHD_BIGO,
      rand: firstRow.DNHD_RAND
    };
    
    // 상세내역 (모든 행)
    const detailItems = rows.map(row => ({
        seq: row.DNDT_SENO,
        itemCode: row.DNDT_ITEM,
        itemName: row.PROH_NAME,
        itemDescription: row.PROH_BIGO,
        isCash: row.DNDT_HYGB === '1',
        quantity: parseInt(row.DNDT_QTY1) || 0,
        amount: parseInt(row.DNDT_TAMT) || 0,
        cardPrice: parseInt(row.DPRC_SOPR) || 0,
        cashPrice: parseInt(row.DPRC_DCPR) || 0,
        deliveryPrice: parseInt(row.DPRC_DEPR) || 0,
        currentStock: parseInt(row.HYUN_QTY1) || 0,
        stockManaged: row.HYUN === '1',  // 추가: 재고 관리 여부
        isOnline: row.ONLINE_STATUS === '1',  // 추가: 온라인 관리여부
        qrCode: row.PROH_QRCD,
        discountQty: parseInt(row.YOUL_QTY1) || 0,
        discountAmount: parseInt(row.YOUL_AMT1) || 0,
        discountType: row.YOUL_GUBN,
        image: row.IMAGE || '',
        postMessage: row.POST_MESS,
        cash_status: row.HYGB,
        hyunCode: row.HYUN
    }));
    
    // 합계 계산
    const summary = {
      totalQty: detailItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: detailItems.reduce((sum, item) => sum + item.amount, 0),
      cashQty: detailItems.filter(item => item.isCash).reduce((sum, item) => sum + item.quantity, 0),
      cashAmount: detailItems.filter(item => item.isCash).reduce((sum, item) => sum + item.amount, 0),
      cardQty: detailItems.filter(item => !item.isCash).reduce((sum, item) => sum + item.quantity, 0),
      cardAmount: detailItems.filter(item => !item.isCash).reduce((sum, item) => sum + item.amount, 0)
    };

    console.log('매출 상세 조회 완료:', {
      기본정보: basicInfo.slip,
      상세항목수: detailItems.length,
      합계금액: summary.totalAmount
    });
    
    console.log('=== 매출 상세 조회 API 성공 완료 ===');

    return json({
      success: true,
      basicInfo: basicInfo,
      detailItems: detailItems,
      summary: summary
    });

  } catch (error) {
    console.error('=== 매출 상세 조회 API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '매출 상세 조회 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}