// src/routes/api/sale-stock/discontinue/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function POST({ request }) {
    try {
        const { product_code } = await request.json();
        
        // 입력값 검증
        if (!product_code) {
            return json({
                success: false,
                message: '제품코드를 입력해주세요.'
            }, { status: 400 });
        }
        
        const db = getDb();
        
        // 제품 정보 조회
        const [productRows] = await db.execute(`
            SELECT PROH_CODE, PROH_NAME, PROD_TXT1 
            FROM PROD_HEAD 
            WHERE PROH_CODE = ?
        `, [product_code]);
        
        if (productRows.length === 0) {
            return json({
                success: false,
                message: '존재하지 않는 제품코드입니다.'
            }, { status: 404 });
        }
        
        const product = productRows[0];
        
        // 현재 단종 상태 확인 및 토글
        const currentStatus = product.PROD_TXT1 || '0';
        const newStatus = currentStatus === '1' ? '0' : '1';
        
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        // 트랜잭션 시작
        await db.execute('START TRANSACTION');
        
        try {
            // PROD_HEAD 테이블 업데이트
            await db.execute(`
                UPDATE PROD_HEAD 
                SET PROD_TXT1 = ?, PROD_IDAT = NOW(), PROD_IUSR = '김호준'
                WHERE PROH_CODE = ?
            `, [newStatus, product_code]);
            
            // PROT_HIST 테이블에 이력 저장
            const pGub1 = 'PRODUCT';
            const pGub2 = 'DISCONTINUE';
            const pCode = product_code;
            const pCod2 = '';
            const pDate = today;
            const pTxt1 = newStatus === '1' ? '단종 처리' : '단종 취소';
            const pNum1 = newStatus === '1' ? 1 : 0;
            const pIusr = '김호준';
            
            // 기존 이력 확인
            const [existingRows] = await db.execute(`
                SELECT COUNT(*) as count 
                FROM PROT_HIST 
                WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? 
                AND PROT_CODE = ? AND PROT_COD2 = ? AND PROT_DATE = ?
            `, [pGub1, pGub2, pCode, pCod2, pDate]);
            
            if (existingRows[0].count > 0) {
                // 기존 이력 업데이트
                await db.execute(`
                    UPDATE PROT_HIST 
                    SET PROT_TXT1 = ?, PROT_NUM1 = ?, PROT_IDAT = NOW(), PROT_IUSR = ?
                    WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? 
                    AND PROT_CODE = ? AND PROT_COD2 = ? AND PROT_DATE = ?
                `, [pTxt1, pNum1, pIusr, pGub1, pGub2, pCode, pCod2, pDate]);
            } else {
                // 새 이력 삽입
                await db.execute(`
                    INSERT INTO PROT_HIST 
                    (PROT_GUB1, PROT_GUB2, PROT_CODE, PROT_COD2, PROT_DATE, PROT_TXT1, PROT_NUM1, PROT_IUSR, PROT_IDAT)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [pGub1, pGub2, pCode, pCod2, pDate, pTxt1, pNum1, pIusr]);
            }
            
            // 트랜잭션 커밋
            await db.execute('COMMIT');
            
            const message = newStatus === '1' ? 
                `${product.PROH_NAME} 제품이 단종 처리되었습니다.` : 
                `${product.PROH_NAME} 제품의 단종이 취소되었습니다.`;
            
            const action = newStatus === '1' ? 'discontinued' : 'normal';
            
            return json({
                success: true,
                action: action,
                message: message,
                product_code: product_code,
                new_status: newStatus
            });
            
        } catch (error) {
            // 트랜잭션 롤백
            await db.execute('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('단종 처리 오류:', error);
        return json({
            success: false,
            message: '단종 처리 중 오류가 발생했습니다.',
            error: error.message
        }, { status: 500 });
    }
}