// src/routes/api/images/delete/+server.js
import { json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE({ request, locals }) {
  try {
    console.log('=== 불필요한 이미지 삭제 API 시작 ===');
    
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { product_code, keep_count } = await request.json();
    
    console.log('이미지 삭제 요청:', { 
      product_code,
      keep_count, // 유지할 이미지 개수
      user: user.username 
    });
    
    // 입력값 검증
    if (!product_code) {
      return json({
        success: false,
        message: '제품코드를 입력해주세요.'
      }, { status: 400 });
    }
    
    if (keep_count == null || keep_count < 0 || keep_count > 10) {
      return json({
        success: false,
        message: '유지할 이미지 개수가 올바르지 않습니다.'
      }, { status: 400 });
    }
    
    // 이미지 저장 경로 설정 (기존 업로드 API와 동일한 경로)
    const uploadDir = '/volume1/image';
    
    try {
      // 디렉토리 존재 확인
      await fs.access(uploadDir);
    } catch (error) {
      console.log('업로드 디렉토리가 존재하지 않음:', uploadDir);
      return json({
        success: true,
        message: '삭제할 이미지가 없습니다.',
        deleted_files: []
      });
    }
    
    // 삭제할 이미지 번호 범위 계산 (keep_count + 1 부터 10까지)
    const deleteStartIndex = keep_count + 1;
    const deleteEndIndex = 10;
    
    console.log(`${deleteStartIndex}번부터 ${deleteEndIndex}번까지 이미지 삭제 예정`);
    
    let deletedFiles = [];
    let failedFiles = [];
    
    // 지정된 범위의 이미지 파일들 삭제
    for (let i = deleteStartIndex; i <= deleteEndIndex; i++) {
      const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      for (const ext of extensions) {
        const fileName = `${product_code}_${i}.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        
        try {
          // 파일 존재 확인
          await fs.access(filePath);
          // 파일 삭제
          await fs.unlink(filePath);
          deletedFiles.push(fileName);
          console.log('✅ 파일 삭제 성공:', fileName);
        } catch (error) {
          // 파일이 없는 경우는 에러가 아님 (조용히 넘김)
          if (error.code !== 'ENOENT') {
            console.error('❌ 파일 삭제 실패:', fileName, error.message);
            failedFiles.push({ file: fileName, error: error.message });
          }
        }
      }
    }
    
    console.log('삭제 완료:', {
      삭제범위: `${deleteStartIndex}-${deleteEndIndex}번`,
      성공: deletedFiles.length,
      실패: failedFiles.length
    });
    
    // 결과 반환
    const result = {
      success: true,
      message: `${deletedFiles.length}개 불필요한 이미지 파일이 삭제되었습니다.`,
      deleted_files: deletedFiles,
      failed_files: failedFiles,
      delete_range: `${deleteStartIndex}-${deleteEndIndex}`
    };
    
    if (failedFiles.length > 0) {
      result.message += ` (${failedFiles.length}개 파일 삭제 실패)`;
    }
    
    console.log('=== 불필요한 이미지 삭제 API 완료 ===');
    
    return json(result);

  } catch (error) {
    console.error('=== 이미지 삭제 API 에러 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('========================');
    
    return json({ 
      success: false, 
      message: '이미지 삭제 중 오류가 발생했습니다: ' + error.message 
    }, { status: 500 });
  }
}