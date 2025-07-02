// src/routes/api/sale-stock/adjust/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

// 수불 전표번호 생성 함수
async function generateMoveSlip(db, date) {
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
            VALUES ('MV', ?, ?, ?, '김호준', NOW())
        `, [date, seno, moveSlip]);
        
        return moveSlip;
        
    } catch (error) {
        console.error('수불 전표번호 생성 실패:', error);
        throw error;
    }
}

// 수불 저장 함수
async function addStockMove(db, moveSlip, seno, shop, date, item, qty, reno = '', menu = 'STOCK_ADJ', user = '김호준') {
    try {
        await db.execute(`
            INSERT INTO STOK_MOVE 
            (MOVE_SLIP, MOVE_SENO, MOVE_SHOP, MOVE_DATE, MOVE_ITEM, MOVE_QTY1, MOVE_RENO, MOVE_MENU, MOVE_IUSR, MOVE_IDAT) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [moveSlip, seno, shop, date, item, qty, reno, menu, user]);
        
        console.log(`수불 저장: ${item} / 수량: ${qty} / 전표: ${moveSlip}`);
        return true;
        
    } catch (error) {
        console.error('수불 저장 실패:', error);
        throw error;
    }
}

// 현재고 업데이트 함수
async function updateCurrentStock(db, productCode, quantity) {
    try {
        // 현재고 조회
        const [currentRows] = await db.execute(`
            SELECT COALESCE(SUM(STOK_QTY1), 0) as CURRENT_STOCK
            FROM STOK_KEEP
            WHERE STOK_SHOP = '001' AND STOK_ITEM = ?
        `, [productCode]);
        
        const currentStock = currentRows[0].CURRENT_STOCK;
        const newStock = currentStock + quantity;
        
        // STOK_KEEP 테이블 업데이트 또는 삽입
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        // 기존 레코드 확인
        const [existingRows] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM STOK_KEEP 
            WHERE STOK_SHOP = '001' AND STOK_ITEM = ?
        `, [productCode]);
        
        if (existingRows[0].count > 0) {
            // 업데이트
            await db.execute(`
                UPDATE STOK_KEEP 
                SET STOK_QTY1 = ?, STOK_IUSR = '김호준', STOK_IDAT = NOW()
                WHERE STOK_SHOP = '001' AND STOK_ITEM = ?
            `, [newStock, productCode]);
        } else {
            // 신규 삽입
            await db.execute(`
                INSERT INTO STOK_KEEP 
                (STOK_SHOP, STOK_DATE, STOK_ITEM, STOK_QTY1, STOK_IUSR, STOK_IDAT)
                VALUES ('001', ?, ?, ?, '김호준', NOW())
            `, [today, productCode, newStock]);
        }
        
        return newStock;
        
    } catch (error) {
        console.error('현재고 업데이트 실패:', error);
        throw error;
    }
}

export async function POST({ request }) {
    try {
        const { product_code, quantity } = await request.json();
        
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
        
        // 제품 존재 여부 확인
        const [productRows] = await db.execute(`
            SELECT PROH_CODE, PROH_NAME 
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
        
        // 트랜잭션 시작
        await db.execute('START TRANSACTION');
        
        try {
            // 수불 전표번호 생성
            const moveSlip = await generateMoveSlip(db, today);
            
            // 수불 저장
            await addStockMove(db, moveSlip, 1, '001', today, product_code, qty);
            
            // 현재고 업데이트
            const newStock = await updateCurrentStock(db, product_code, qty);
            
            // 트랜잭션 커밋
            await db.execute('COMMIT');
            
            const action = qty > 0 ? '입고' : '출고';
            const message = `${product.PROH_NAME} 제품의 ${action} 처리가 완료되었습니다. (${Math.abs(qty)}개)`;
            
            return json({
                success: true,
                message: message,
                new_stock: newStock,
                product_code: product_code
            });
            
        } catch (error) {
            // 트랜잭션 롤백
            await db.execute('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('재고 조정 오류:', error);
        return json({
            success: false,
            message: '재고 조정 중 오류가 발생했습니다.',
            error: error.message
        }, { status: 500 });
    }
}