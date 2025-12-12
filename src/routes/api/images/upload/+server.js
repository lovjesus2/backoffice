// src/routes/api/images/upload/+server.js (운영 안전 버전 - 트랜잭션 분리 + WebP 변환)
import { json } from '@sveltejs/kit';
import { writeFile, mkdir, access, stat, copyFile, rename, unlink, readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getDb } from '$lib/database.js';
import sharp from 'sharp';  // ✅ 추가: Sharp 라이브러리

const IMAGE_BASE_DIR = '/volume1/image'; // NAS 이미지 저장소

// ✅ 추가: WebP 변환 함수
async function convertImage(buffer, filename, format) {
  try {
    console.log(`🔄 ${format.toUpperCase()} 변환: ${filename}`);
    
    let outputBuffer;
    if (format === 'webp') {
      outputBuffer = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();
    } else {
      outputBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
    }
    
    const reduction = ((1 - outputBuffer.length / buffer.length) * 100).toFixed(1);
    console.log(`✅ ${filename}: ${(buffer.length/1024).toFixed(1)}KB → ${(outputBuffer.length/1024).toFixed(1)}KB (${reduction}% 감소)`);
    
    return outputBuffer;
  } catch (error) {
    console.error(`❌ 변환 실패: ${filename}`, error.message);
    throw error;
  }
}

// 🔍 GET: 기존 이미지 목록 조회 (기존 코드 유지)
export async function GET({ url, locals }) {
  try {
    console.log('🔍 이미지 조회 API 호출됨');
    
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }
    
    const imagGub1 = url.searchParams.get('IMAG_GUB1');
    const imagGub2 = url.searchParams.get('IMAG_GUB2');
    const imagCode = url.searchParams.get('IMAG_CODE');
    
    console.log('🔍 조회 파라미터:', { imagGub1, imagGub2, imagCode });
    
    if (!imagGub1 || !imagGub2 || !imagCode) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const db = getDb();
    
    const [rows] = await db.execute(
      `SELECT IMAG_CNT1, IMAG_PCPH, IMAG_IUSR, IMAG_IDAT
       FROM ASSE_IMAG 
       WHERE IMAG_GUB1 = ? AND IMAG_GUB2 = ? AND IMAG_CODE = ? AND IMAG_GUB3 = '0'
       ORDER BY CAST(IMAG_CNT1 AS UNSIGNED) ASC `,
      [imagGub1, imagGub2, imagCode]
    );

    console.log(`📋 DB 조회 결과: ${rows.length}개 이미지 발견`);

    const images = [];
    
    for (const row of rows) {
      const filePath = path.join(IMAGE_BASE_DIR, row.IMAG_PCPH);
      
      try {
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

// POST: 트랜잭션 분리된 안전한 업로드 로직 + WebP 변환
export async function POST({ request, locals }) {
  const timestamp = Date.now();
  const processedFiles = []; // 처리 완료된 파일 정보
  const tempFiles = []; // 정리할 임시 파일 목록
  console.log('🔥🔥🔥 업로드 API 진입!'); // ← 추가
  
  try {
    console.log('📤 이미지 업로드 API 호출됨 (WebP 변환 버전)');
    
    // 1. 인증 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    
    // 2. 파라미터 추출 및 검증
    const imagGub1 = formData.get('IMAG_GUB1');
    const imagGub2 = formData.get('IMAG_GUB2'); 
    const imagCode = formData.get('IMAG_CODE');
    const imagGub3 = '0';
    const imagIusr = user.username;
    
    const finalOrderData = formData.get('finalOrder');
    if (!finalOrderData) {
      return json({ error: '이미지 순서 정보가 누락되었습니다.' }, { status: 400 });
    }
    
    const finalOrder = JSON.parse(finalOrderData);
    const newFiles = formData.getAll('files');

    const imageFormat = formData.get('format') || 'jpg';
    const fileExtension = imageFormat === 'webp' ? '.webp' : '.jpg';

    
    console.log('📋 처리 정보:', {
      finalOrderCount: finalOrder.length,
      newFilesCount: newFiles.length,
      imagCode,
      user: imagIusr
    });

    if (!imagGub1 || !imagGub2 || !imagCode) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    if (finalOrder.length === 0) {
      return json({ error: '저장할 이미지가 없습니다.' }, { status: 400 });
    }

    // ========================================
    // 🔧 1단계: 파일 처리 (트랜잭션 외부)
    // ========================================
    console.log('📁 1단계: 파일 처리 시작 (WebP 변환 포함)');
    
    // 1-1. 기존 파일을 안전한 임시명으로 백업
    const tempFileMap = new Map();
    
    for (let i = 0; i < finalOrder.length; i++) {
      const item = finalOrder[i];
      
      if (item.isExisting) {
        const oldFileName = item.name;
        const tempFileName = `backup_${timestamp}_${i}_${oldFileName}`;
        const oldPath = path.join(IMAGE_BASE_DIR, oldFileName);
        const tempPath = path.join(IMAGE_BASE_DIR, tempFileName);
        
        try {
          // 원본 파일이 존재하는지 확인
          await access(oldPath);
          
          // 안전한 백업 복사
          await copyFile(oldPath, tempPath);
          
          tempFileMap.set(i, {
            tempFileName: tempFileName,
            originalFileName: oldFileName,
            tempPath: tempPath,
            finalPath: path.join(IMAGE_BASE_DIR, `${imagCode}_${i + 1}${fileExtension}`)
          });
          
          tempFiles.push(tempFileName);
          console.log(`💾 백업 생성: ${oldFileName} → ${tempFileName}`);
          
        } catch (copyError) {
          console.error(`❌ 파일 백업 실패: ${oldFileName}`, copyError.message);
          throw new Error(`파일 백업 실패: ${oldFileName} - ${copyError.message}`);
        }
      }
    }

    // 1-2. 최종 파일명으로 순서대로 저장 (WebP 변환 포함)
    let newFileIndex = 0;
    
    for (let i = 0; i < finalOrder.length; i++) {
      const item = finalOrder[i];
      const imagCnt1 = i + 1;
      const imagPcph = `${imagCode}_${imagCnt1}${fileExtension}`;
      const finalPath = path.join(IMAGE_BASE_DIR, imagPcph);
      
      if (item.isExisting) {
        // 기존 이미지: 백업에서 최종 위치로 복사 (WebP 변환)
        const tempInfo = tempFileMap.get(i);
        if (!tempInfo) {
          throw new Error(`백업 파일 정보를 찾을 수 없습니다: 순서 ${i + 1}`);
        }
        
        try {
          // ✅ 추가: 기존 이미지도 WebP로 변환
          const originalBuffer = await readFile(tempInfo.tempPath);
          const outputBuffer = await convertImage(originalBuffer, tempInfo.originalFileName, imageFormat);
          await writeFile(finalPath, outputBuffer);
          
          console.log(`📋 기존 파일 WebP 변환 배치: ${tempInfo.tempFileName} → ${imagPcph}`);
          
        } catch (moveError) {
          console.error(`❌ 파일 배치 실패: ${tempInfo.tempFileName}`, moveError.message);
          throw new Error(`파일 배치 실패: ${tempInfo.tempFileName} - ${moveError.message}`);
        }
        
      } else {
        // 새 이미지: 업로드된 파일 저장 (WebP 변환)
        if (newFileIndex >= newFiles.length) {
          throw new Error(`새 파일 부족: 필요 ${newFileIndex + 1}개, 실제 ${newFiles.length}개`);
        }
        
        const file = newFiles[newFileIndex];
        
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // ✅ 추가: WebP 변환
          const outputBuffer = await convertImage(buffer, file.name, imageFormat);
          await writeFile(finalPath, outputBuffer);
          
          // 파일 무결성 검증
          const savedStats = await stat(finalPath);
          if (savedStats.size !== outputBuffer.length) {
            throw new Error(`파일 크기 불일치: 예상 ${outputBuffer.length}, 실제 ${savedStats.size}`);
          }
          
          console.log(`💾 새 파일 ${imageFormat.toUpperCase()} 저장: ${imagPcph} (${outputBuffer.length} bytes)`);
          newFileIndex++;
          
        } catch (saveError) {
          console.error(`❌ 새 파일 저장 실패: ${imagPcph}`, saveError.message);
          throw new Error(`새 파일 저장 실패: ${imagPcph} - ${saveError.message}`);
        }
      }
      
      // 처리 완료된 파일 정보 저장
      processedFiles.push({
        fileName: imagPcph,
        path: `/proxy-images/${imagPcph}`,
        cnt: imagCnt1,
        isExisting: item.isExisting,
        imagGub1,
        imagGub2,
        imagCode,
        imagGub3,
        imagIusr
      });
    }
    
    // 🗑️ 1-3. 방금 저장한 파일 제외하고 옛날 확장자 파일 삭제
    console.log('🗑️ 1-3단계: 옛날 확장자 파일 정리');

    // 방금 저장한 파일명 목록 생성
    const savedFileNames = new Set(processedFiles.map(f => f.fileName));

    for (let i = 1; i <= 10; i++) {
      const oldExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      for (const ext of oldExtensions) {
        const oldFile = path.join(IMAGE_BASE_DIR, `${imagCode}_${i}${ext}`);
        const oldFileName = `${imagCode}_${i}${ext}`;
        
        // 방금 저장한 파일은 건너뛰기!
        if (savedFileNames.has(oldFileName)) {
          console.log(`⏭️ 건너뛰기 (방금 저장): ${oldFileName}`);
          continue;
        }
        
        try {
          await access(oldFile);
          await unlink(oldFile);
          console.log(`🗑️ 옛날 파일 삭제: ${imagCode}_${i}${ext}`);
        } catch (err) {
          // 파일 없으면 무시 (정상)
        }
      }
    }

    // ========================================
    // 🗄️ 2단계: DB 트랜잭션 (빠른 처리)
    // ========================================
    console.log('🗄️ 2단계: DB 트랜잭션 시작');
    
    const db = getDb();
    await db.execute('START TRANSACTION');
    
    try {
      // 2-1. 기존 이미지 정보 삭제 (DB만)
      const deleteResult = await db.execute(
        `DELETE FROM ASSE_IMAG 
         WHERE IMAG_GUB1 = ? AND IMAG_GUB2 = ? AND IMAG_CODE = ? AND IMAG_GUB3 = ?`,
        [imagGub1, imagGub2, imagCode, imagGub3]
      );
      
      console.log(`🗑️ 기존 DB 레코드 ${deleteResult[0].affectedRows}개 삭제`);

      // 2-2. 새 이미지 정보 저장
      for (const fileInfo of processedFiles) {
        await db.execute(
          `INSERT INTO ASSE_IMAG 
           (IMAG_GUB1, IMAG_GUB2, IMAG_CODE, IMAG_GUB3, IMAG_CNT1, IMAG_PCPH, IMAG_IUSR) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [fileInfo.imagGub1, fileInfo.imagGub2, fileInfo.imagCode, fileInfo.imagGub3, 
           fileInfo.cnt, fileInfo.fileName, fileInfo.imagIusr]
        );
        
        console.log(`✅ DB 저장: 순서 ${fileInfo.cnt} - ${fileInfo.fileName} ${fileInfo.isExisting ? '(기존)' : '(신규)'}`);
      }
      
      // 2-3. 트랜잭션 커밋
      await db.execute('COMMIT');
      console.log('✅ DB 트랜잭션 커밋 완료');
      
    } catch (dbError) {
      // DB 실패 시 롤백
      await db.execute('ROLLBACK');
      console.error('❌ DB 트랜잭션 롤백:', dbError.message);
      
      // 저장된 파일들 정리 (원상복구)
      console.log('🔄 DB 실패로 인한 파일 원상복구 시작...');
      
      for (const fileInfo of processedFiles) {
        try {
          const filePath = path.join(IMAGE_BASE_DIR, fileInfo.fileName);
          await access(filePath);
          await unlink(filePath);
          console.log(`🗑️ 롤백 파일 삭제: ${fileInfo.fileName}`);
        } catch (deleteError) {
          console.warn(`⚠️ 롤백 파일 삭제 실패: ${fileInfo.fileName} - ${deleteError.message}`);
        }
      }
      
      throw new Error(`DB 저장 실패: ${dbError.message}`);
    }

    // ========================================
    // 🧹 3단계: 정리 작업
    // ========================================
    console.log('🧹 3단계: 임시 파일 정리');
    await cleanupTempFiles(tempFiles);
    
    // 성공 응답
    return json({
      success: true,
      message: `${finalOrder.length}개 이미지가 WebP 형식으로 저장되었습니다.`,
      files: processedFiles.map(f => ({
        fileName: f.fileName,
        path: f.path,
        cnt: f.cnt,
        isExisting: f.isExisting
      })),
      invalidate_cache: imagCode,
      debug: {
        finalOrderCount: finalOrder.length,
        newFilesCount: newFiles.length,
        existingCount: finalOrder.filter(item => item.isExisting).length,
        processedFilesCount: processedFiles.length,
        user: imagIusr,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 이미지 업로드 총 오류:', error.message);
    
    // 모든 임시 파일 정리
    await cleanupTempFiles(tempFiles);
    
    // 처리된 파일들도 정리 (에러 발생 시)
    if (processedFiles.length > 0) {
      console.log('🔄 에러로 인한 처리 파일 정리...');
      for (const fileInfo of processedFiles) {
        try {
          const filePath = path.join(IMAGE_BASE_DIR, fileInfo.fileName);
          await access(filePath);
          await unlink(filePath);
          console.log(`🗑️ 에러 정리: ${fileInfo.fileName}`);
        } catch (cleanupError) {
          console.warn(`⚠️ 에러 정리 실패: ${fileInfo.fileName}`);
        }
      }
    }
    
    return json({ 
      success: false,
      error: '이미지 업로드에 실패했습니다.', 
      details: error.message
    }, { status: 500 });
  }
}

// 🧹 임시 파일 정리 함수
async function cleanupTempFiles(tempFiles) {
  if (!tempFiles || tempFiles.length === 0) {
    return;
  }
  
  console.log(`🧹 임시 파일 정리: ${tempFiles.length}개`);
  
  for (const tempFile of tempFiles) {
    try {
      const tempPath = path.join(IMAGE_BASE_DIR, tempFile);
      await access(tempPath);
      await unlink(tempPath);
      console.log(`🗑️ 임시 파일 삭제: ${tempFile}`);
    } catch (cleanupError) {
      // 이미 삭제되었거나 없는 파일 - 정상적인 상황
      console.log(`ℹ️ 임시 파일 정리 완료: ${tempFile} (이미 처리됨)`);
    }
  }
  
  console.log('✅ 임시 파일 정리 완료');
}