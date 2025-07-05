// src/routes/api/common-codes/minr/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';
import { verifyToken } from '$lib/middleware/auth.js';

// BISH_MINR 조회 (GET) - 특정 대분류의 소분류들
export async function GET({ url, cookies }) {
  try {
    // 인증 확인
    const tokenResult = verifyToken(cookies);
    if (!tokenResult.success) {
      return json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const db = getDb();
    const majrCode = url.searchParams.get('majr_code');
    const searchTerm = url.searchParams.get('search') || '';
    
    if (!majrCode) {
      return json({
        success: false,
        message: '대분류 코드가 필요합니다.'
      }, { status: 400 });
    }
    
    let sql = `
      SELECT MINR_MJCD, MINR_CODE, MINR_NAME, MINR_BIGO, MINR_BIG2,
             MINR_IDAT, MINR_IUSR, MINR_UDAT, MINR_UUSR
      FROM BISH_MINR
      WHERE MINR_MJCD = ?
    `;
    const params = [majrCode];
    
    if (searchTerm) {
      sql += ` AND (MINR_CODE LIKE ? OR MINR_NAME LIKE ?)`;
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    sql += ` ORDER BY MINR_CODE`;
    
    const [rows] = await db.execute(sql, params);
    
    return json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('BISH_MINR 조회 오류:', error);
    return json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// BISH_MINR 저장/수정 (POST)
export async function POST({ request, cookies }) {
  try {
    // 인증 확인
    const tokenResult = verifyToken(cookies);
    if (!tokenResult.success) {
      return json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const currentUser = tokenResult.user; // 로그인한 사용자 정보
    const db = getDb();
    const data = await request.json();
    const { MINR_MJCD, MINR_CODE, MINR_NAME, MINR_BIGO, MINR_BIG2, isUpdate, originalCode } = data;
    
    if (!MINR_MJCD || !MINR_CODE || !MINR_NAME) {
      return json({
        success: false,
        message: '대분류코드, 소분류코드, 명칭은 필수 입력항목입니다.'
      }, { status: 400 });
    }
    
    // 대분류 코드 존재 확인
    const [majrExists] = await db.execute(
      'SELECT MAJR_CODE FROM BISH_MAJR WHERE MAJR_CODE = ?',
      [MINR_MJCD]
    );
    
    if (majrExists.length === 0) {
      return json({
        success: false,
        message: '존재하지 않는 대분류 코드입니다.'
      }, { status: 400 });
    }
    
    if (isUpdate) {
      // 수정 - 로그인한 사용자로 MINR_UUSR 설정
      const whereCondition = originalCode ? 
        'MINR_MJCD = ? AND MINR_CODE = ?' : 
        'MINR_MJCD = ? AND MINR_CODE = ?';
      const whereParams = originalCode ? 
        [MINR_MJCD, originalCode] : 
        [MINR_MJCD, MINR_CODE];
      
      await db.execute(`
        UPDATE BISH_MINR 
        SET MINR_CODE = ?, MINR_NAME = ?, MINR_BIGO = ?, MINR_BIG2 = ?,
            MINR_UDAT = NOW(), MINR_UUSR = ?
        WHERE ${whereCondition}
      `, [MINR_CODE, MINR_NAME, MINR_BIGO || '', MINR_BIG2 || '', currentUser.username, ...whereParams]);
      
    } else {
      // 신규 등록 - 중복 체크
      const [existing] = await db.execute(
        'SELECT MINR_CODE FROM BISH_MINR WHERE MINR_MJCD = ? AND MINR_CODE = ?',
        [MINR_MJCD, MINR_CODE]
      );
      
      if (existing.length > 0) {
        return json({
          success: false,
          message: '이미 존재하는 소분류 코드입니다.'
        }, { status: 400 });
      }
      
      // 신규 등록 - 로그인한 사용자로 MINR_IUSR 설정
      await db.execute(`
        INSERT INTO BISH_MINR (MINR_MJCD, MINR_CODE, MINR_NAME, MINR_BIGO, MINR_BIG2, MINR_IUSR)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [MINR_MJCD, MINR_CODE, MINR_NAME, MINR_BIGO || '', MINR_BIG2 || '', currentUser.username]);
    }
    
    return json({
      success: true,
      message: isUpdate ? '수정되었습니다.' : '등록되었습니다.'
    });
    
  } catch (error) {
    console.error('BISH_MINR 저장 오류:', error);
    return json({
      success: false,
      message: '저장 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// BISH_MINR 삭제 (DELETE)
export async function DELETE({ url, cookies }) {
  try {
    // 인증 확인
    const tokenResult = verifyToken(cookies);
    if (!tokenResult.success) {
      return json({
        success: false,
        message: '인증이 필요합니다.'
      }, { status: 401 });
    }

    const db = getDb();
    const majrCode = url.searchParams.get('majr_code');
    const minrCode = url.searchParams.get('minr_code');
    
    if (!majrCode || !minrCode) {
      return json({
        success: false,
        message: '대분류코드와 소분류코드가 필요합니다.'
      }, { status: 400 });
    }
    
    await db.execute(
      'DELETE FROM BISH_MINR WHERE MINR_MJCD = ? AND MINR_CODE = ?',
      [majrCode, minrCode]
    );
    
    return json({
      success: true,
      message: '삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('BISH_MINR 삭제 오류:', error);
    return json({
      success: false,
      message: '삭제 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}