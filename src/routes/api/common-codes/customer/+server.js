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
    
    // BISH_BPCD 테이블에서 납품처 목록 조회
    const [rows] = await db.execute(`
      SELECT BPCD_CODE, BPCD_NAME 
      FROM BISH_BPCD 
      ORDER BY BPCD_CODE ASC
    `);
    
    return json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('납품처 목록 조회 오류:', error);
    return json({
      success: false,
      message: `납품처 목록 조회 중 오류가 발생했습니다: ${error.message}`
    }, { status: 500 });
  }
}