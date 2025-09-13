import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const db = getDb();
    
    // BISH_SHOP 테이블에서 매장 목록 조회
    const [rows] = await db.execute(`
      SELECT SHOP_CODE, SHOP_NAME 
      FROM BISH_SHOP 
      ORDER BY SHOP_CODE ASC
    `);
    
    return json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('매장 목록 조회 오류:', error);
    return json({
      success: false,
      message: `매장 목록 조회 중 오류가 발생했습니다: ${error.message}`
    }, { status: 500 });
  }
}