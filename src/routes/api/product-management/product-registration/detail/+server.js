// src/routes/api/product-management/product-registration/detail/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {
    console.log('=== 제품 상세 정보 조회 API 호출 시작 ===');
    
    const user = locals.user;
    if (!user) {
      console.log('인증되지 않은 사용자');
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const companyCode = url.searchParams.get('company_code');
    const registrationCode = url.searchParams.get('registration_code');
    const productCode = url.searchParams.get('product_code');
    const categoryCode = url.searchParams.get('category_code');
    
    console.log('조회 파라미터:', {
      companyCode,
      registrationCode,
      productCode,
      categoryCode,  // 추가
      user: user.username
    });
    
    // 필수 파라미터 검증 (productCode 제외)
    if (!companyCode || !registrationCode) {
      return json({
        success: false,
        message: '필수 파라미터가 누락되었습니다.'
      }, { status: 400 });
    }
    
    const db = getDb();
    
    // 1. 기본 제품 정보 조회 (제품 코드가 있을 때만)
    let productInfo = null;
    if (productCode) {
      const [productResult] = await db.execute(`
        SELECT PROH_CODE, PROH_NAME, PROH_CDOT, PROH_BIGO, PROH_QRCD
        FROM ASSE_PROH 
        WHERE PROH_GUB1 = ? AND PROH_GUB2 = ? AND PROH_CODE = ?
      `, [companyCode, registrationCode, productCode]);
      
      productInfo = productResult[0] || null;
      console.log('기본 제품 정보 조회 완료:', productInfo);
    }

    // 2. 단가 정보 조회 (제품 코드가 있을 때만)
    let priceInfo = null;
    let priceHistory = [];
    if (productCode) {
      const [priceResult] = await db.execute(`
        SELECT DPRC_CODE, DPRC_BAPR, DPRC_SOPR, DPRC_DCPR, DPRC_DEPR
        FROM BISH_DPRC
        WHERE DPRC_CODE = ?
      `, [productCode]);

      priceInfo = priceResult[0] || null;
      console.log('단가 정보 조회 완료:', priceInfo);

      // 3. 단가 히스토리 조회
      const [historyResult] = await db.execute(`
        SELECT DPRC_CODE, DPRC_DATE, DPRC_SENO, DPRC_CDNM, DPRC_BAPR, DPRC_SOPR, DPRC_DCPR, DPRC_DEPR,
               DPRC_IDAT, DPRC_IUSR
        FROM BISH_DPRC_HIST
        WHERE DPRC_CODE = ?
        ORDER BY DPRC_DATE DESC, DPRC_SENO DESC
      `, [productCode]);

      priceHistory = historyResult || [];
      console.log('단가 히스토리 조회 완료:', priceHistory.length + '건');
    }
    
    // 4. 수량 할인 정보 조회 (제품 코드가 있을 때만)
    let discountInfo = [];
    if (productCode) {
      const [discountResult] = await db.execute(`
        SELECT YOUL_GUBN, MINR_NAME, YOUL_QTY1, YOUL_AMT1, YOUL_ITEM
        FROM BISH_YOUL
        INNER JOIN BISH_MINR
          ON MINR_MJCD = 'CD003'
         AND MINR_CODE = YOUL_GUBN
        WHERE YOUL_ITEM = ?
      `, [productCode]);  // companyMjcd 제거

      discountInfo = discountResult || [];
      console.log('수량 할인 정보 조회 완료:', discountInfo.length + '건');
    }

    // 5. 상세 항목 조회 (항상 조회)
    let detailItems = [];
    let detailHistory = [];

    if (categoryCode) {
      console.log('카테고리 코드:', categoryCode);
      
      // 상세 항목 조회
      const [details] = await db.execute(`
        SELECT T1.MINR_CODE, T1.MINR_NAME, T1.MINR_BIGO,
               T1.MINR_BIG2, IFNULL(T2.MINR_NAME,'') AS CODE_NAME,
               IFNULL(PROD_TXT1,'') AS PROD_TXT1, IFNULL(PROD_NUM1,0) AS PROD_NUM1
        FROM (SELECT MINR_CODE, MINR_NAME, MINR_BIGO, MINR_BIG2
              FROM BISH_MINR
              WHERE MINR_MJCD = ?
              ORDER BY MINR_SORT DESC) T1
        LEFT OUTER JOIN ASSE_PROD
          ON T1.MINR_CODE = PROD_COD2
         AND PROD_GUB1 = ?
         AND PROD_GUB2 = ?
         AND PROD_CODE = ?
        LEFT OUTER JOIN BISH_MINR T2
          ON T1.MINR_BIG2 = T2.MINR_MJCD
         AND T2.MINR_CODE = PROD_TXT1
      `, [categoryCode, companyCode, registrationCode, productCode || '']);
      
      detailItems = details;
      
      // 상세 히스토리 조회 (제품이 있을 때만)
      if (productCode) {
        const [history] = await db.execute(`
          SELECT T1.MINR_CODE, T1.MINR_NAME, T1.MINR_BIGO, PROT_DATE,
                 T1.MINR_BIG2, IFNULL(T2.MINR_NAME,'') AS CODE_NAME,
                 IFNULL(PROT_TXT1,'') AS PROT_TXT1, IFNULL(PROT_NUM1,0) AS PROT_NUM1
          FROM (SELECT MINR_CODE, MINR_NAME, MINR_BIGO, MINR_BIG2
                FROM BISH_MINR
                WHERE MINR_MJCD = ?
                ORDER BY MINR_SORT DESC) T1
          INNER JOIN ASSE_PROT
            ON MINR_CODE = PROT_COD2
           AND PROT_GUB1 = ?
           AND PROT_GUB2 = ?
           AND PROT_CODE = ?
          LEFT OUTER JOIN BISH_MINR T2
            ON T1.MINR_BIG2 = T2.MINR_MJCD
           AND T2.MINR_CODE = PROT_TXT1
          ORDER BY PROT_DATE DESC, T1.MINR_CODE
        `, [categoryCode, companyCode, registrationCode, productCode]);
        
        detailHistory = history;
      }
      
      console.log('상세 항목 조회 완료:', detailItems.length + '개');
    }
    
    return json({
      success: true,
      productInfo: productInfo,
      detailItems: detailItems,
      detailHistory: detailHistory,
      priceInfo: priceInfo,
      priceHistory: priceHistory,
      discountInfo: discountInfo,
      message: '제품 상세 정보 조회 완료'
    });
    
  } catch (error) {
    console.error('제품 상세 정보 조회 오류:', error);
    return json({
      success: false,
      message: '조회 중 오류가 발생했습니다: ' + error.message
    }, { status: 500 });
  }
}