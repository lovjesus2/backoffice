// src/routes/api/images/upload/+server.js (최종 수정 버전)
import { json } from '@sveltejs/kit';
import { writeFile, mkdir, access, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { getDb } from '$lib/database.js';

// ✅ JWT_SECRET 문제 해결
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const IMAGE_BASE_DIR = '/volume1/image'; // NAS 이미지 저장소

// 🔍 GET: 기존 이미지 목록 조회
export async function GET({ url, cookies }) {
  try {
    console.log('🔍 이미지 조회 API 호출됨');
    
    // 인증 확인
    const token = cookies.get('token');
    if (!token) {
      console.log('❌ 토큰이 없습니다');
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ JWT 토큰 검증 성공:', decoded.username);
    } catch (jwtError) {
      console.error('❌ JWT 토큰 검증 실패:', jwtError.message);
      return json({ 
        error: '토큰이 유효하지 않습니다. 다시 로그인해주세요.' 
      }, { status: 401 });
    }
    
    // 쿼리 파라미터 추출
    const imagGub1 = url.searchParams.get('IMAG_GUB1');
    const imagGub2 = url.searchParams.get('IMAG_GUB2');
    const imagCode = url.searchParams.get('IMAG_CODE');
    
    console.log('🔍 조회 파라미터:', { imagGub1, imagGub2, imagCode });
    
    if (!imagGub1 || !imagGub2 || !imagCode) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const db = getDb();
    
    // ✅ DB에서 이미지 목록 조회 (IMAG_GUB3='0' 조건 추가)
    const [rows] = await db.execute(
      `SELECT IMAG_CNT1, IMAG_PCPH, IMAG_IUSR, IMAG_IDAT
       FROM ASSE_IMAG 
       WHERE IMAG_GUB1 = ? AND IMAG_GUB2 = ? AND IMAG_CODE = ? AND IMAG_GUB3 = '0'
       ORDER BY CAST(IMAG_CNT1 AS UNSIGNED) ASC `,
      [imagGub1, imagGub2, imagCode]
    );

    console.log(`📋 DB 조회 결과: ${rows.length}개 이미지 발견`);

    // 파일 존재 여부 확인
    const images = [];
    
    for (const row of rows) {
      const filePath = path.join(IMAGE_BASE_DIR, row.IMAG_PCPH);
      
      try {
        // 실제 파일이 존재하는지 확인
        const fileStats = await stat(filePath);
        
        images.push({
          id: `${imagCode}_${row.IMAG_CNT1}`,
          name: row.IMAG_PCPH,
          url: `/proxy-images/${row.IMAG_PCPH}`,
          cnt: row.IMAG_CNT1,
          uploadedBy: row.IMAG_IUSR,
          uploadedAt: row.IMAG_IDAT,
          size: fileStats.size,
          exists: true
        });
        
        console.log(`✅ 파일 존재 확인: ${row.IMAG_PCPH} (${fileStats.size} bytes)`);
        
      } catch (fileError) {
        console.warn(`⚠️ 파일 누락: ${row.IMAG_PCPH} - DB에는 있지만 실제 파일 없음`);
        
        images.push({
          id: `${imagCode}_${row.IMAG_CNT1}`,
          name: row.IMAG_PCPH,
          url: `/proxy-images/${row.IMAG_PCPH}`,
          cnt: row.IMAG_CNT1,
          uploadedBy: row.IMAG_IUSR,
          uploadedAt: row.IMAG_IDAT,
          size: 0,
          exists: false
        });
      }
    }

    console.log(`📷 최종 응답: ${images.length}개 이미지 (존재: ${images.filter(img => img.exists).length}개)`);

    return json({
      success: true,
      images: images,
      count: images.length
    });

  } catch (error) {
    console.error('❌ 이미지 목록 조회 오류:', error);
    return json({ 
      success: false,
      error: '이미지 목록 조회에 실패했습니다.', 
      details: error.message
    }, { status: 500 });
  }
}

// POST: 수정된 업로드 로직
export async function POST({ request, cookies }) {
  try {
    console.log('📤 이미지 업로드 API 호출됨');
    
    // 인증 확인
    const token = cookies.get('token');
    if (!token) {
      console.log('❌ 토큰이 없습니다');
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ JWT 토큰 검증 성공:', decoded.username);
    } catch (jwtError) {
      console.error('❌ JWT 토큰 검증 실패:', jwtError.message);
      return json({ 
        error: '토큰이 유효하지 않습니다. 다시 로그인해주세요.' 
      }, { status: 401 });
    }

    const formData = await request.formData();
    
    // 파라미터 추출
    const imagGub1 = formData.get('IMAG_GUB1');
    const imagGub2 = formData.get('IMAG_GUB2'); 
    const imagCode = formData.get('IMAG_CODE');
    const imagGub3 = '0';
    const imagIusr = decoded.username;
    
    // 🔥 핵심: 최종 순서 정보 받기
    const finalOrderData = formData.get('finalOrder');
    if (!finalOrderData) {
      return json({ error: '이미지 순서 정보가 누락되었습니다.' }, { status: 400 });
    }
    
    const finalOrder = JSON.parse(finalOrderData);
    console.log('📋 최종 순서:', finalOrder);
    
    const newFiles = formData.getAll('files');
    console.log('📁 새 파일:', newFiles.length, '개');

    if (!imagGub1 || !imagGub2 || !imagCode) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    if (finalOrder.length === 0) {
      return json({ error: '저장할 이미지가 없습니다.' }, { status: 400 });
    }

    const db = getDb();
    await db.execute('START TRANSACTION');
    
    try {
      // 1단계: 기존 이미지 모두 삭제 (DB만)
      const deleteResult = await db.execute(
        `DELETE FROM ASSE_IMAG 
         WHERE IMAG_GUB1 = ? AND IMAG_GUB2 = ? AND IMAG_CODE = ? AND IMAG_GUB3 = ?`,
        [imagGub1, imagGub2, imagCode, imagGub3]
      );
      
      console.log(`🗑️ 기존 DB 레코드 ${deleteResult[0].affectedRows}개 삭제됨`);

      const savedFiles = [];
      let newFileIndex = 0;
      
      // 2단계: finalOrder 순서대로 저장
      for (let i = 0; i < finalOrder.length; i++) {
        const item = finalOrder[i];
        const imagCnt1 = i + 1; // 최종 순서 번호
        
        let imagPcph;
        let shouldSaveFile = false;
        
        if (item.isExisting) {
          // 기존 이미지: 파일명 그대로 유지, 파일은 복사
          const oldFileName = item.name;
          imagPcph = `${imagCode}_${imagCnt1}.jpg`; // 새로운 순서번호로 파일명 생성
          
          // 기존 파일을 새 이름으로 복사
          const oldPath = path.join(IMAGE_BASE_DIR, oldFileName);
          const newPath = path.join(IMAGE_BASE_DIR, imagPcph);
          
          try {
            // Node.js fs 모듈의 copyFile 사용
            const { copyFile } = await import('fs/promises');
            await copyFile(oldPath, newPath);
            console.log(`📋 기존 파일 복사: ${oldFileName} → ${imagPcph}`);
          } catch (copyError) {
            console.error(`❌ 파일 복사 실패: ${oldFileName}`, copyError);
            // 복사 실패해도 계속 진행 (DB 레코드는 저장)
          }
          
        } else {
          // 새 이미지: 업로드된 파일에서 가져옴
          if (newFileIndex >= newFiles.length) {
            throw new Error(`새 파일 인덱스 초과: ${newFileIndex}/${newFiles.length}`);
          }
          
          const file = newFiles[newFileIndex];
          imagPcph = `${imagCode}_${imagCnt1}.jpg`;
          
          // 새 파일 저장
          const fullPath = path.join(IMAGE_BASE_DIR, imagPcph);
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(fullPath, buffer);
          
          // 파일 권한 설정
          try {
            const { chmod } = await import('fs/promises');
            await chmod(fullPath, 0o644);
          } catch (chmodError) {
            console.warn('⚠️ 권한 설정 실패 (무시됨):', chmodError.message);
          }
          
          console.log(`💾 새 파일 저장: ${imagPcph} (${buffer.length} bytes)`);
          newFileIndex++;
        }
        
        // DB에 정보 저장 (순서대로)
        await db.execute(
          `INSERT INTO ASSE_IMAG 
           (IMAG_GUB1, IMAG_GUB2, IMAG_CODE, IMAG_GUB3, IMAG_CNT1, IMAG_PCPH, IMAG_IUSR) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [imagGub1, imagGub2, imagCode, imagGub3, imagCnt1, imagPcph, imagIusr]
        );
        
        savedFiles.push({
          fileName: imagPcph,
          path: `/proxy-images/${imagPcph}`,
          cnt: imagCnt1,
          isExisting: item.isExisting
        });
        
        console.log(`✅ 순서 ${imagCnt1}: ${imagPcph} ${item.isExisting ? '(기존)' : '(신규)'}`);
      }
      
      await db.execute('COMMIT');
      console.log('✅ 트랜잭션 커밋 완료');
      
      return json({
        success: true,
        message: `${finalOrder.length}개 이미지가 순서대로 저장되었습니다.`,
        files: savedFiles,
        debug: {
          finalOrderCount: finalOrder.length,
          newFilesCount: newFiles.length,
          existingCount: finalOrder.filter(item => item.isExisting).length,
          user: imagIusr,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      console.error('❌ 트랜잭션 롤백:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ 이미지 업로드 오류:', error);
    return json({ 
      success: false,
      error: '이미지 업로드에 실패했습니다.', 
      details: error.message
    }, { status: 500 });
  }
}