// src/routes/api/product-management/product-stock/adjust/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

// 수불 전표번호 생성 함수
async function generateMoveSlip(db, date, user) {
    try {
        // 당일 수불 전표 최대 일련번호 조회
        const [rows] = await db.execute(`
            SELECT COALESCE(MAX(SLIP_SENO), 0) + 1 AS SENO 
            FROM BISH_SLIP 
            WHERE SLIP_GUBN = 'MV' AND SLIP_DATE = ?
        `, [date]);
        
        const seno = rows[0].SENO;
        const moveSlip = 'MV' + date + seno.toString().padStart(5, '0');
        
        // 수불 전표번호 테이블에 저장
        await db.execute(`
            INSERT INTO BISH_SLIP (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR, SLIP_IDAT) 
            VALUES ('MV', ?, ?, ?, ?, NOW())
        `, [date, seno, moveSlip, user]);
        
        return moveSlip;
        
    } catch (error) {
        console.error('수불 전표번호 생성 실패:', error);
        throw error;
    }
}

// 수불 저장 함수
async function addStockMove(db, moveSlip, seno, shop, date, item, qty, reno = '', menu = 'STOCK_ADJ', user) {
    try {
        await db.execute(`
            INSERT INTO STOK_MOVE 
            (MOVE_SLIP, MOVE_SENO, MOVE_SHOP, MOVE_DATE, MOVE_ITEM, MOVE_QTY1, MOVE_RENO, MOVE_MENU, MOVE_IUSR, MOVE_IDAT) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [moveSlip, seno, shop, date, item, qty, reno, menu, user]);
        
        console.log(`수불 저장: ${item} / 수량: ${qty} / 전표: ${moveSlip} / 사용자: ${user}`);
        return true;
        
    } catch (error) {
        console.error('수불 저장 실패:', error);
        throw error;
    }
}

// 현재고 업데이트 함수
async function updateCurrentStock(db, productCode, quantity, user) {
    try {
        // 현재고 조회 (STOK_HYUN 테이블 사용)
        const [currentRows] = await db.execute(`
            SELECT COALESCE(HYUN_QTY1, 0) as CURRENT_STOCK
            FROM STOK_HYUN
            WHERE HYUN_ITEM = ?
        `, [productCode]);
        
        const currentStock = currentRows.length > 0 ? currentRows[0].CURRENT_STOCK : 0;
        const newStock = currentStock + quantity;
        
        // STOK_HYUN 테이블 업데이트 또는 삽입
        const [existingRows] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM STOK_HYUN 
            WHERE HYUN_ITEM = ?
        `, [productCode]);
        
        if (existingRows[0].count > 0) {
            // 업데이트
            await db.execute(`
                UPDATE STOK_HYUN 
                SET HYUN_QTY1 = ?, HYUN_IUSR = ?, HYUN_IDAT = NOW()
                WHERE HYUN_ITEM = ?
            `, [newStock, user, productCode]);
        } else {
            // 신규 삽입
            await db.execute(`
                INSERT INTO STOK_HYUN 
                (HYUN_ITEM, HYUN_QTY1, HYUN_IUSR, HYUN_IDAT)
                VALUES (?, ?, ?, NOW())
            `, [productCode, newStock, user]);
        }
        
        return newStock;
        
    } catch (error) {
        console.error('현재고 업데이트 실패:', error);
        throw error;
    }
}

// ✅ 재고관리 설정 함수 (ASSE_PROD L6 처리)
async function setStockManagement(db, productCode, user) {
    try {
        // L6 레코드 존재 확인
        const [existingRows] = await db.execute(`
            SELECT PROD_CODE FROM ASSE_PROD 
            WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
            AND PROD_CODE = ? AND PROD_COD2 = 'L6'
        `, [productCode]);
        
        if (existingRows.length > 0) {
            // L6 레코드가 있으면 업데이트
            await db.execute(`
                UPDATE ASSE_PROD 
                SET PROD_TXT1 = '1', PROD_IDAT = NOW(), PROD_IUSR = ?
                WHERE PROD_GUB1 = 'A1' AND PROD_GUB2 = 'AK' 
                AND PROD_CODE = ? AND PROD_COD2 = 'L6'
            `, [user, productCode]);
            
            console.log(`재고관리 설정 업데이트: ${productCode}`);
        } else {
            // L6 레코드가 없으면 신규 생성
            await db.execute(`
                INSERT INTO ASSE_PROD 
                (PROD_GUB1, PROD_GUB2, PROD_CODE, PROD_COD2, PROD_TXT1, PROD_NUM1, PROD_IUSR) 
                VALUES ('A1', 'AK', ?, 'L6', '1', 0, ?)
            `, [productCode, user]);
            
            console.log(`재고관리 설정 신규 생성: ${productCode}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('재고관리 설정 실패:', error);
        throw error;
    }
}

// ✅ 재고관리 이력 저장 함수 (ASSE_PROT 처리)
async function saveStockManagementHistory(db, productCode, user, today) {
    try {
        const pGub1 = 'A1';
        const pGub2 = 'AK';
        const pCode = productCode;
        const pCod2 = 'L6';  // 재고관리 유무
        const pDate = today;
        const pTxt1 = '1';   // 재고관리 함
        const pNum1 = 0;
        
        // ASSE_PROT 테이블에서 해당 레코드 존재 확인
        const [existingRows] = await db.execute(`
            SELECT PROT_CODE FROM ASSE_PROT 
            WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? 
            AND PROT_CODE = ? AND PROT_COD2 = ? AND PROT_DATE = ?
        `, [pGub1, pGub2, pCode, pCod2, pDate]);
        
        if (existingRows.length === 0) {
            // 레코드가 없으면 INSERT
            await db.execute(`
                INSERT INTO ASSE_PROT 
                (PROT_GUB1, PROT_GUB2, PROT_CODE, PROT_COD2, PROT_DATE, PROT_TXT1, PROT_NUM1, PROT_IUSR) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [pGub1, pGub2, pCode, pCod2, pDate, pTxt1, pNum1, user]);
            
            console.log(`재고관리 이력 생성: ${productCode} / ${pDate}`);
        } else {
            // 레코드가 있으면 UPDATE
            await db.execute(`
                UPDATE ASSE_PROT 
                SET PROT_TXT1 = ?, PROT_NUM1 = ?, PROT_IDAT = NOW(), PROT_IUSR = ? 
                WHERE PROT_GUB1 = ? AND PROT_GUB2 = ? 
                AND PROT_CODE = ? AND PROT_COD2 = ? AND PROT_DATE = ?
            `, [pTxt1, pNum1, user, pGub1, pGub2, pCode, pCod2, pDate]);
            
            console.log(`재고관리 이력 업데이트: ${productCode} / ${pDate}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('재고관리 이력 저장 실패:', error);
        throw error;
    }
}

export async function POST({ request, locals }) {
    try {
        console.log('=== Stock Adjust API 호출 시작 ===');
        
        // 미들웨어에서 인증된 사용자 확인
        const user = locals.user;
        if (!user) {
        return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
        }
        
        const { product_code, quantity } = await request.json();
        
        console.log('재고 조정 요청:', { product_code, quantity, user: user.username });
        
        // 입력값 검증
        if (!product_code || !quantity || isNaN(quantity) || quantity === 0) {
            return json({
                success: false,
                message: '올바른 제품코드와 수량을 입력해주세요.'
            }, { status: 400 });
        }
        
        const qty = parseInt(quantity);
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        const db = getDb();
        
        // 제품 존재 여부 확인 (ASSE_PROH 테이블 사용)
        const [productRows] = await db.execute(`
            SELECT p.PROH_CODE, p.PROH_NAME 
            FROM ASSE_PROH p
            WHERE p.PROH_GUB1 = 'A1' AND p.PROH_GUB2 = 'AK' AND p.PROH_CODE = ?
        `, [product_code]);
        
        if (productRows.length === 0) {
            return json({
                success: false,
                message: '존재하지 않는 제품코드입니다.'
            }, { status: 404 });
        }
        
        const product = productRows[0];
        console.log('제품 정보:', product);
        
        // 트랜잭션 시작
        await db.execute('START TRANSACTION');
        console.log('트랜잭션 시작');
        
        try {
            // 1. 수불 전표번호 생성
            const moveSlip = await generateMoveSlip(db, today, user.username);
            console.log('수불 전표번호 생성:', moveSlip);
            
            // 2. 수불 저장
            await addStockMove(db, moveSlip, 1, 'A1', today, product_code, qty, '', 'STOCK_ADJ', user.username);
            console.log('수불 저장 완료');
            
            // 3. 현재고 업데이트
            const newStock = await updateCurrentStock(db, product_code, qty, user.username);
            console.log('현재고 업데이트 완료, 새 재고:', newStock);
            
            // ✅ 4. 재고관리 설정 (ASSE_PROD L6 처리)
            await setStockManagement(db, product_code, user.username);
            console.log('재고관리 설정 완료');
            
            // ✅ 5. 재고관리 이력 저장 (ASSE_PROT 처리)
            await saveStockManagementHistory(db, product_code, user.username, today);
            console.log('재고관리 이력 저장 완료');
            
            // 트랜잭션 커밋
            await db.execute('COMMIT');
            console.log('트랜잭션 커밋 완료');
            
            const action = qty > 0 ? '입고' : '출고';
            const message = `${product.PROH_NAME} 제품의 ${action} 처리가 완료되었습니다. (${Math.abs(qty)}개, 재고관리 설정 완료)`;
            
            console.log('재고 조정 성공:', { action, newStock, user: user.username });
            console.log('=== Stock Adjust API 성공 완료 ===');
            
            return json({
                success: true,
                message: message,
                new_stock: newStock,
                product_code: product_code,
                stock_management_set: true
            });
            
        } catch (error) {
            // 트랜잭션 롤백
            await db.execute('ROLLBACK');
            console.log('트랜잭션 롤백');
            throw error;
        }
        
    } catch (error) {
        console.error('=== Stock Adjust API 에러 ===');
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
        console.error('========================');
        
        return json({
            success: false,
            message: '재고 조정 중 오류가 발생했습니다: ' + error.message,
            error: error.message
        }, { status: 500 });
    }
}