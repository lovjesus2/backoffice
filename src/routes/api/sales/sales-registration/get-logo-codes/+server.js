// src/routes/api/sales/sales-registration/get-logo-codes/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url, locals }) {
  try {

    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }
    
    const gub1 = url.searchParams.get('gub1') || 'A1';
    const gub2 = url.searchParams.get('gub2') || 'LG';

    const db = await getDb();

    const [rows] = await db.query(`
      SELECT PROH_CODE as code
        , MAX(CASE WHEN PROD_COD2 = 'L1' THEN PROD_TXT1 ELSE '' END) AS qrx
        , MAX(CASE WHEN PROD_COD2 = 'L2' THEN PROD_TXT1 ELSE '' END) AS qry
        , MAX(CASE WHEN PROD_COD2 = 'L5' THEN PROD_TXT1 ELSE '' END) AS l5_value
        , IFNULL(img.IMAG_PCPH, '') as imagePath
      FROM ASSE_PROH
      INNER JOIN ASSE_PROD
        ON PROH_GUB1 = PROD_GUB1
      AND PROH_GUB2 = PROD_GUB2
      AND PROH_CODE = PROD_CODE
      LEFT JOIN ASSE_IMAG img
        ON PROH_CODE = img.IMAG_CODE
      AND img.IMAG_GUB1 = ?
      AND img.IMAG_GUB2 = ?
      AND img.IMAG_GUB3 = '0'
      AND img.IMAG_CNT1 = 1
      WHERE PROH_GUB1 = ?
        AND PROH_GUB2 = ?
      GROUP BY PROH_CODE, img.IMAG_PCPH
      HAVING MAX(CASE WHEN PROD_COD2 = 'L5' THEN PROD_TXT1 ELSE '' END) = '1'
      ORDER BY PROH_CODE
    `, [gub1, gub2, gub1, gub2]);
    
    return json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('로고 코드 조회 오류:', error);
    return json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}