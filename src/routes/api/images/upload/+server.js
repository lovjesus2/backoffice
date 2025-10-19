// src/routes/api/images/upload/+server.js (캐시 무효화 추가 버전)
import { json } from '@sveltejs/kit';
import { writeFile, mkdir, access, stat } from 'fs/promises';
import path from 'path';
import { getDb } from '$lib/database.js';


const IMAGE_BASE_DIR = '/volume1/image'; // NAS 이미지 저장소

// 🔍 GET: 기존 이미지 목록 조회
export async function GET({ url, locals }) {
  try {
    console.log('🔍 이미지 조회 API 호출됨');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
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

// POST: 수정된 업로드 로직 - 파일명 충돌 해결
export async function POST({ request, locals }) {
  try {
    console.log('📤 이미지 업로드 API 호출됨');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    
    // 파라미터 추출
    const imagGub1 = formData.get('IMAG_GUB1');
    const imagGub2 = formData.get('IMAG_GUB2'); 
    const imagCode = formData.get('IMAG_CODE');
    const imagGub3 = '0';
    const imagIusr = user.username;
    
    // 최종 순서 정보 받기
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

      // 2단계: 🔥 핵심 해결 - 기존 파일들을 임시명으로 먼저 복사
      const tempFileMap = new Map(); // 임시 파일명 매핑
      const timestamp = Date.now();
      
      for (let i = 0; i < finalOrder.length; i++) {
        const item = finalOrder[i];
        
        if (item.isExisting) {
          const oldFileName = item.name;
          const tempFileName = `temp_${timestamp}_${i}_${oldFileName}`;
          
          try {
            const oldPath = path.join(IMAGE_BASE_DIR, oldFileName);
            const tempPath = path.join(IMAGE_BASE_DIR, tempFileName);
            
            const { copyFile } = await import('fs/promises');
            await copyFile(oldPath, tempPath);
            
            tempFileMap.set(i, {
              tempFileName: tempFileName,
              originalFileName: oldFileName
            });
            
            console.log(`🔄 임시 복사: ${oldFileName} → ${tempFileName}`);
            
          } catch (copyError) {
            console.error(`❌ 임시 파일 복사 실패: ${oldFileName}`, copyError);
            throw new Error(`임시 파일 복사 실패: ${oldFileName}`);
          }
        }
      }

      // 3단계: 순서대로 최종 파일명으로 저장
      const savedFiles = [];
      let newFileIndex = 0;
      
      for (let i = 0; i < finalOrder.length; i++) {
        const item = finalOrder[i];
        const imagCnt1 = i + 1; // 최종 순서 번호
        const imagPcph = `${imagCode}_${imagCnt1}.jpg`;
        
        if (item.isExisting) {
          // 기존 이미지: 임시 파일에서 최종 파일명으로 이동
          const tempInfo = tempFileMap.get(i);
          if (!tempInfo) {
            throw new Error(`임시 파일 정보를 찾을 수 없습니다: ${i}`);
          }
          
          try {
            const tempPath = path.join(IMAGE_BASE_DIR, tempInfo.tempFileName);
            const finalPath = path.join(IMAGE_BASE_DIR, imagPcph);
            
            const { rename } = await import('fs/promises');
            await rename(tempPath, finalPath);
            
            console.log(`✅ 최종 이동: ${tempInfo.tempFileName} → ${imagPcph}`);
            
          } catch (moveError) {
            console.error(`❌ 최종 파일 이동 실패: ${tempInfo.tempFileName}`, moveError);
            throw new Error(`최종 파일 이동 실패: ${tempInfo.tempFileName}`);
          }
          
        } else {
          // 새 이미지: 업로드된 파일에서 저장
          if (newFileIndex >= newFiles.length) {
            throw new Error(`새 파일 인덱스 초과: ${newFileIndex}/${newFiles.length}`);
          }
          
          const file = newFiles[newFileIndex];
          const fullPath = path.join(IMAGE_BASE_DIR, imagPcph);
          
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(fullPath, buffer);

          // 3. 추가 안전장치: 100ms 후 한번 더 동기화
          setTimeout(async () => {
            try {
              const { open, fsync } = await import('fs/promises');
              const fd = await open(fullPath, 'r');
              await fsync(fd);
              await fd.close();
              console.log(`🔄 지연 동기화 완료: ${imagPcph}`);
            } catch (error) {
              console.warn('⚠️ 지연 동기화 실패:', error.message);
            }
          }, 100);
          
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
      
      // 4단계: 남은 임시 파일 정리 (안전장치)
      try {
        for (const [index, tempInfo] of tempFileMap.entries()) {
          const tempPath = path.join(IMAGE_BASE_DIR, tempInfo.tempFileName);
          try {
            const { unlink, access } = await import('fs/promises');
            await access(tempPath); // 파일 존재 확인
            await unlink(tempPath); // 파일 삭제
            console.log(`🗑️ 임시 파일 정리: ${tempInfo.tempFileName}`);
          } catch (cleanupError) {
            // 이미 처리된 파일이거나 없는 파일 - 무시
            console.log(`ℹ️ 임시 파일 정리 스킵: ${tempInfo.tempFileName} (이미 처리됨)`);
          }
        }
      } catch (cleanupError) {
        console.warn('⚠️ 임시 파일 정리 중 오류 (무시됨):', cleanupError.message);
      }
      
      await db.execute('COMMIT');
      console.log('✅ 트랜잭션 커밋 완료');
      
      return json({
        success: true,
        message: `${finalOrder.length}개 이미지가 순서대로 저장되었습니다.`,
        files: savedFiles,
        invalidate_cache: imagCode, // 캐시 무효화 신호
        debug: {
          finalOrderCount: finalOrder.length,
          newFilesCount: newFiles.length,
          existingCount: finalOrder.filter(item => item.isExisting).length,
          tempFilesProcessed: tempFileMap.size,
          user: imagIusr,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      console.error('❌ 트랜잭션 롤백:', error);
      
      // 오류 발생 시 임시 파일들 정리
      try {
        console.log('🧹 오류로 인한 임시 파일 정리 시작...');
        const { readdir, unlink } = await import('fs/promises');
        const files = await readdir(IMAGE_BASE_DIR);
        
        const tempFiles = files.filter(file => 
          file.startsWith(`temp_${timestamp || ''}_`) || 
          file.includes('temp_')
        );
        
        for (const tempFile of tempFiles) {
          try {
            await unlink(path.join(IMAGE_BASE_DIR, tempFile));
            console.log(`🗑️ 임시 파일 삭제: ${tempFile}`);
          } catch (deleteError) {
            console.warn(`⚠️ 임시 파일 삭제 실패: ${tempFile}`);
          }
        }
        
      } catch (cleanupError) {
        console.warn('⚠️ 오류 후 임시 파일 정리 실패:', cleanupError.message);
      }
      
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