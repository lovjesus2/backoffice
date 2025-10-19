// src/routes/api/common-codes/majr/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';


// BISH_MAJR 조회 (GET)
export async function GET({ url, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const db = getDb();
    const searchTerm = url.searchParams.get('search') || '';
    
    let sql = `
      SELECT MAJR_CODE, MAJR_NAME, MAJR_BIGO, MAJR_BIG2,
             MAJR_IDAT, MAJR_IUSR, MAJR_UDAT, MAJR_UUSR
      FROM BISH_MAJR
    `;
    const params = [];
    
    if (searchTerm) {
      sql += ` WHERE MAJR_CODE LIKE ? OR MAJR_NAME LIKE ?`;
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    sql += ` ORDER BY MAJR_CODE`;
    
    const [rows] = await db.execute(sql, params);
    
    return json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('BISH_MAJR 조회 오류:', error);
    return json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// BISH_MAJR 저장/수정 (POST)
export async function POST({ request, locals }) {
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const currentUser = user; // 로그인한 사용자 정보
    const db = getDb();
    const data = await request.json();
    const { MAJR_CODE, MAJR_NAME, MAJR_BIGO, MAJR_BIG2, isUpdate } = data;
    
    if (!MAJR_CODE || !MAJR_NAME) {
      return json({
        success: false,
        message: '코드와 명칭은 필수 입력항목입니다.'
      }, { status: 400 });
    }
    
    if (isUpdate) {
      // 수정 - 로그인한 사용자로 MAJR_UUSR 설정
      await db.execute(`
        UPDATE BISH_MAJR 
        SET MAJR_NAME = ?, MAJR_BIGO = ?, MAJR_BIG2 = ?,
            MAJR_UDAT = NOW(), MAJR_UUSR = ?
        WHERE MAJR_CODE = ?
      `, [MAJR_NAME, MAJR_BIGO || '', MAJR_BIG2 || '', currentUser.username, MAJR_CODE]);
      
    } else {
      // 신규 등록 - 중복 체크
      const [existing] = await db.execute(
        'SELECT MAJR_CODE FROM BISH_MAJR WHERE MAJR_CODE = ?',
        [MAJR_CODE]
      );
      
      if (existing.length > 0) {
        return json({
          success: false,
          message: '이미 존재하는 코드입니다.'
        }, { status: 400 });
      }
      
      // 신규 등록 - 로그인한 사용자로 MAJR_IUSR 설정
      await db.execute(`
        INSERT INTO BISH_MAJR (MAJR_CODE, MAJR_NAME, MAJR_BIGO, MAJR_BIG2, MAJR_IUSR)
        VALUES (?, ?, ?, ?, ?)
      `, [MAJR_CODE, MAJR_NAME, MAJR_BIGO || '', MAJR_BIG2 || '', currentUser.username]);
    }
    
    return json({
      success: true,
      message: isUpdate ? '수정되었습니다.' : '등록되었습니다.'
    });
    
  } catch (error) {
    console.error('BISH_MAJR 저장 오류:', error);
    return json({
      success: false,
      message: '저장 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// BISH_MAJR 삭제 (DELETE)
export async function DELETE({ url, locals }) { 
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const db = getDb();
    const majrCode = url.searchParams.get('code');
    
    if (!majrCode) {
      return json({
        success: false,
        message: '코드가 필요합니다.'
      }, { status: 400 });
    }
    
    // 하위 소분류 데이터 확인
    const [minrRows] = await db.execute(
      'SELECT COUNT(*) as count FROM BISH_MINR WHERE MINR_MJCD = ?',
      [majrCode]
    );
    
    if (minrRows[0].count > 0) {
      return json({
        success: false,
        message: '하위 소분류가 존재하여 삭제할 수 없습니다.'
      }, { status: 400 });
    }
    
    await db.execute(
      'DELETE FROM BISH_MAJR WHERE MAJR_CODE = ?',
      [majrCode]
    );
    
    return json({
      success: true,
      message: '삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('BISH_MAJR 삭제 오류:', error);
    return json({
      success: false,
      message: '삭제 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}