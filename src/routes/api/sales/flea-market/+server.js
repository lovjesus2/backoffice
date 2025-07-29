// src/routes/api/sales/flea-market/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your-secret-key';

// 수불 전표번호 생성 함수
async function generateMoveSlip(db, date, user) {
  const [rows] = await db.execute(`
    SELECT COALESCE(MAX(SLIP_SENO), 0) + 1 AS SENO 
    FROM BISH_SLIP 
    WHERE SLIP_GUBN = 'MV' AND SLIP_DATE = ?
  `, [date]);
  
  const seno = rows[0].SENO;
  const moveSlip = 'MV' + date + seno.toString().padStart(5, '0');
  
  await db.execute(`
    INSERT INTO BISH_SLIP (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR, SLIP_IDAT) 
    VALUES ('MV', ?, ?, ?, ?, NOW())
  `, [date, seno, moveSlip, user]);
  
  return moveSlip;
}

// 프리마켓 데이터 조회
export async function GET({ url, cookies }) {
  try {
    console.log('🛍️ 프리마켓 API 호출');
    
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const action = url.searchParams.get('action');
    const db = getDb();

    switch (action) {
      case 'get_flea_categories':
        // 프리마켓에 등록된 상품의 카테고리만 조회
        const [categories] = await db.execute(`
          SELECT DISTINCT m.MINR_CODE, m.MINR_NAME 
          FROM ASSE_FLEA f
          INNER JOIN ASSE_PROD prod ON (f.FLEA_ITEM = prod.PROD_CODE AND prod.PROD_COD2 = 'L1')
          INNER JOIN BISH_MINR m ON (prod.PROD_TXT1 = m.MINR_CODE AND m.MINR_MJCD = 'CD001')
          WHERE f.FLEA_ITEM IS NOT NULL 
            AND prod.PROD_TXT1 IS NOT NULL 
            AND prod.PROD_TXT1 != ''
          ORDER BY m.MINR_CODE
        `);
        
        return json({
          success: true,
          data: categories.map(row => ({
            code: row.MINR_CODE,
            name: row.MINR_NAME
          }))
        });

      case 'get_flea_products':
        // 프리마켓 상품 조회
        const categoryCode = url.searchParams.get('category') || 'ALL';
        
        let productQuery = `
          SELECT 
            f.FLEA_ITEM as PROH_CODE,
            p.PROH_NAME,
            d.DPRC_SOPR,
            d.DPRC_BAPR,
            prod.PROD_TXT1 as category_code,
            m.MINR_NAME as category_name
          FROM ASSE_FLEA f
          INNER JOIN ASSE_PROH p ON f.FLEA_ITEM = p.PROH_CODE
          INNER JOIN ASSE_PROD prod ON (p.PROH_GUB1 = prod.PROD_GUB1 
                                   AND p.PROH_GUB2 = prod.PROD_GUB2 
                                   AND p.PROH_CODE = prod.PROD_CODE 
                                   AND prod.PROD_COD2 = 'L1')
          INNER JOIN BISH_DPRC d ON p.PROH_CODE = d.DPRC_CODE
          LEFT JOIN BISH_MINR m ON (prod.PROD_TXT1 = m.MINR_CODE AND m.MINR_MJCD = 'CD001')
          WHERE p.PROH_GUB1 = 'A1' AND p.PROH_GUB2 = 'AK'
        `;
        
        let params = [];
        if (categoryCode !== 'ALL') {
          productQuery += ' AND prod.PROD_TXT1 = ?';
          params.push(categoryCode);
        }
        
        productQuery += ' ORDER BY p.PROH_CODE';
        
        const [products] = await db.execute(productQuery, params);
        
        return json({
          success: true,
          data: products
        });

      case 'get_product_by_barcode':
        // 바코드로 상품 조회
        const barcode = url.searchParams.get('barcode');
        if (!barcode) {
          return json({ error: '바코드가 필요합니다.' }, { status: 400 });
        }

        const [barcodeProducts] = await db.execute(`
          SELECT 
            p.PROH_CODE,
            p.PROH_NAME,
            d.DPRC_SOPR,
            d.DPRC_BAPR,
            f.FLEA_ITEM
          FROM ASSE_PROH p
          INNER JOIN BISH_DPRC d ON p.PROH_CODE = d.DPRC_CODE
          LEFT JOIN ASSE_FLEA f ON p.PROH_CODE = f.FLEA_ITEM
          WHERE p.PROH_GUB1 = 'A1' AND p.PROH_GUB2 = 'AK' 
            AND (p.PROH_CODE = ? OR p.PROH_BACO = ?)
          LIMIT 1
        `, [barcode, barcode]);

        if (barcodeProducts.length === 0) {
          return json({
            success: false,
            message: '바코드에 해당하는 상품을 찾을 수 없습니다.'
          });
        }

        const product = barcodeProducts[0];
        
        // FLEA에 등록되지 않은 상품은 추가할지 물어봄
        if (!product.FLEA_ITEM) {
          return json({
            success: false,
            message: '이 상품은 FLEA에 등록되지 않았습니다. FLEA에 추가하시겠습니까?',
            productData: product,
            needFleaRegistration: true
          });
        }

        return json({
          success: true,
          data: product
        });

      case 'search_products':
        // 상품 검색
        const searchTerm = url.searchParams.get('searchTerm') || '';
        const searchType = url.searchParams.get('searchType') || 'name';
        const productFilter = url.searchParams.get('productFilter') || 'all';
        const discontinuedFilter = url.searchParams.get('discontinuedFilter') || 'all';

        if (!searchTerm.trim()) {
          return json({
            success: true,
            data: []
          });
        }

        let searchQuery = `
          SELECT DISTINCT
            p.PROH_CODE,
            p.PROH_NAME,
            d.DPRC_SOPR,
            d.DPRC_BAPR,
            prod.PROD_COD2,
            f.FLEA_ITEM,
            CASE WHEN f.FLEA_ITEM IS NOT NULL THEN 1 ELSE 0 END as is_flea
          FROM ASSE_PROH p
          INNER JOIN BISH_DPRC d ON p.PROH_CODE = d.DPRC_CODE
          INNER JOIN ASSE_PROD prod ON (p.PROH_GUB1 = prod.PROD_GUB1 
                                    AND p.PROH_GUB2 = prod.PROD_GUB2 
                                    AND p.PROH_CODE = prod.PROD_CODE)
          LEFT JOIN ASSE_FLEA f ON p.PROH_CODE = f.FLEA_ITEM
          WHERE p.PROH_GUB1 = 'A1' AND p.PROH_GUB2 = 'AK'
        `;

        let searchParams = [];
        
        // 검색 조건 추가 - PHP 방식과 동일
        if (searchType === 'name') {
          // 공백 제거 후 문자 분리
          const searchTermNoSpace = searchTerm.replace(/\s/g, '');
          const searchChars = [...searchTermNoSpace]; // 유니코드 문자 분리
          
          if (searchChars.length > 0) {
            // 각 문자에 대한 LIKE 조건 생성
            const nameSearchConditions = [];
            searchChars.forEach((char, index) => {
              nameSearchConditions.push('p.PROH_NAME LIKE ?');
              searchParams.push(`%${char}%`);
            });
            
            // AND로 연결 (모든 문자가 포함되어야 함)
            searchQuery += ` AND (${nameSearchConditions.join(' AND ')})`;
          }
        } else if (searchType === 'code') {
          searchQuery += ' AND p.PROH_CODE LIKE ?';
          searchParams.push(`%${searchTerm}%`);
        }

        // 상품 필터 추가
        if (productFilter === 'flea') {
          searchQuery += ' AND f.FLEA_ITEM IS NOT NULL';
        } else if (productFilter === 'non_flea') {
          searchQuery += ' AND f.FLEA_ITEM IS NULL';
        }

        // 단종 필터 추가
        if (discontinuedFilter === 'normal') {
          searchQuery += ' AND prod.PROD_COD2 = "L1"';
        } else if (discontinuedFilter === 'discontinued') {
          searchQuery += ' AND prod.PROD_COD2 = "L2"';
        }

        searchQuery += ' ORDER BY p.PROH_CODE LIMIT 100';

        const [searchResults] = await db.execute(searchQuery, searchParams);

        return json({
          success: true,
          data: searchResults
        });

      case 'get_sije_amount':
        // 시제 금액 조회
        const date = url.searchParams.get('date');
        if (!date) {
          return json({ error: '날짜가 필요합니다.' }, { status: 400 });
        }

        const sDate = date.replace(/-/g, '');
        const [sijeRows] = await db.execute(`
          SELECT SIJE_AMT1 FROM BISH_SIJE 
          WHERE SIJE_DATE = ? AND SIJE_SHOP = 'F1'
        `, [sDate]);

        const sijeAmount = sijeRows.length > 0 ? parseInt(sijeRows[0].SIJE_AMT1) : 0;

        return json({
          success: true,
          amount: sijeAmount
        });

      case 'get_sales_list':
        // 매출 목록 조회
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        
        if (!startDate || !endDate) {
          return json({ error: '시작일과 종료일이 필요합니다.' }, { status: 400 });
        }

        const sStartDate = startDate.replace(/-/g, '');
        const sEndDate = endDate.replace(/-/g, '');

        const [salesList] = await db.execute(`
          SELECT 
            h.DNHD_SLIP,
            h.DNHD_DATE,
            SUM(d.DNDT_QTY1) as DNHD_QTY1,
            SUM(d.DNDT_TAMT) as DNHD_TAMT,
            h.DNHD_IDAT,
            h.DNHD_RAND
          FROM SALE_DNHD h
          INNER JOIN SALE_DNDT d ON h.DNHD_SLIP = d.DNDT_SLIP
          WHERE h.DNHD_DATE BETWEEN ? AND ?
            AND h.DNHD_SHOP = 'F1'
          GROUP BY h.DNHD_SLIP, h.DNHD_DATE, h.DNHD_IDAT, h.DNHD_RAND
          ORDER BY h.DNHD_DATE DESC, h.DNHD_SLIP DESC
        `, [sStartDate, sEndDate]);
        
        return json({
          success: true,
          data: salesList.map(row => ({
            slipNo: row.DNHD_SLIP,
            date: row.DNHD_DATE,
            qty: parseInt(row.DNHD_QTY1),
            amount: parseInt(row.DNHD_TAMT),
            regTime: row.DNHD_IDAT ? new Date(row.DNHD_IDAT).toTimeString().split(' ')[0] : '',
            rand: row.DNHD_RAND
          }))
        });

      case 'get_current_stock':
        // 현재고 조회
        const productCode = url.searchParams.get('productCode');
        if (!productCode) {
          return json({ error: '제품 코드가 필요합니다.' }, { status: 400 });
        }
        
        const [stockRows] = await db.execute(`
          SELECT HYUN_QTY1 FROM STOK_HYUN WHERE HYUN_ITEM = ?
        `, [productCode]);
        
        const currentStock = stockRows.length > 0 ? parseInt(stockRows[0].HYUN_QTY1) : 0;
        
        return json({
          success: true,
          stock: currentStock
        });

      default:
        return json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ 프리마켓 GET API 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 프리마켓 데이터 저장/수정/삭제
export async function POST({ request, cookies }) {
  try {
    console.log('💾 프리마켓 POST API 호출');
    
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { action, productCode, date, sijeAmount, items, sSlip } = await request.json();

    const db = getDb();

    switch (action) {
      case 'add_flea_product':
        if (!productCode) {
          return json({ error: '제품 코드가 필요합니다.' }, { status: 400 });
        }
        
        // 이미 FLEA에 있는지 확인
        const [existingProduct] = await db.execute(
          'SELECT FLEA_ITEM FROM ASSE_FLEA WHERE FLEA_ITEM = ?',
          [productCode]
        );
        
        if (existingProduct.length > 0) {
          return json({ error: '이미 FLEA에 등록된 상품입니다.' }, { status: 400 });
        }
        
        // FLEA에 추가
        await db.execute(
          'INSERT INTO ASSE_FLEA (FLEA_ITEM, FLEA_IDAT) VALUES (?, NOW())',
          [productCode]
        );
        
        return json({
          success: true,
          message: 'FLEA에 추가되었습니다.'
        });

      case 'remove_flea_product':
        if (!productCode) {
          return json({ error: '제품 코드가 필요합니다.' }, { status: 400 });
        }
        
        const [deleteResult] = await db.execute(
          'DELETE FROM ASSE_FLEA WHERE FLEA_ITEM = ?',
          [productCode]
        );
        
        if (deleteResult.affectedRows === 0) {
          return json({ error: '제품을 찾을 수 없습니다.' }, { status: 404 });
        }
        
        return json({
          success: true,
          message: 'FLEA에서 제거되었습니다.'
        });

      case 'save_sije_amount':
        if (!date || sijeAmount === undefined) {
          return json({ error: '날짜와 시제 금액이 필요합니다.' }, { status: 400 });
        }

        const sDate = date.replace(/-/g, '');
        
        // 기존 시제 데이터 확인
        const [existingSije] = await db.execute(
          'SELECT SIJE_AMT1 FROM BISH_SIJE WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
          [sDate]
        );

        if (existingSije.length > 0) {
          // 업데이트
          await db.execute(
            'UPDATE BISH_SIJE SET SIJE_AMT1 = ?, SIJE_IUSR = ?, SIJE_UDAT = NOW() WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
            [sijeAmount, decoded.username, sDate]
          );
        } else {
          // 새로 삽입
          await db.execute(
            'INSERT INTO BISH_SIJE (SIJE_DATE, SIJE_SHOP, SIJE_AMT1, SIJE_AMT2, SIJE_AMT3, SIJE_IUSR) VALUES (?, "F1", ?, 0, ?, ?)',
            [sDate, sijeAmount, sijeAmount, decoded.username]
          );
        }

        return json({
          success: true,
          message: '시제 금액이 저장되었습니다.'
        });

      case 'save_sales':
        if (!date || !items || items.length === 0) {
          return json({ error: '날짜와 매출 항목이 필요합니다.' }, { status: 400 });
        }

        const salesDate = date.replace(/-/g, '');
        
        // 트랜잭션 시작
        await db.execute('START TRANSACTION');

        try {
          // 1. 전표번호 생성
          const [slipRows] = await db.execute(`
            SELECT COALESCE(MAX(DNHD_SENO), 0) + 1 AS SENO 
            FROM SALE_DNHD 
            WHERE DNHD_SHOP = 'F1' AND DNHD_DATE = ?
          `, [salesDate]);
          
          const seno = slipRows[0].SENO;
          const slipNo = 'F1' + salesDate + seno.toString().padStart(5, '0');
          
          // 2. 랜덤 문자열 생성
          const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
          
          // 3. 총 금액 계산
          const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
          const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          
          // 4. 수불 전표 생성 (재고 차감용)
          const moveSlip = await generateMoveSlip(db, salesDate, decoded.username);
          
          // 5. 재고 차감
          for (let item of items) {
            // 현재고 확인
            const [stockCheck] = await db.execute(
              'SELECT HYUN_QTY1 FROM STOK_HYUN WHERE HYUN_ITEM = ?',
              [item.code]
            );
            
            const currentStock = stockCheck.length > 0 ? parseInt(stockCheck[0].HYUN_QTY1) : 0;
            const newStock = currentStock - item.quantity;
            
            // 재고 차감 (음수 허용)
            if (stockCheck.length > 0) {
              await db.execute(
                'UPDATE STOK_HYUN SET HYUN_QTY1 = ?, HYUN_UDAT = NOW() WHERE HYUN_ITEM = ?',
                [newStock, item.code]
              );
            }
            
            // 수불 내역 추가
            await db.execute(
              'INSERT INTO STOK_SUBUL (SUBUL_SLIP, SUBUL_DATE, SUBUL_ITEM, SUBUL_CGBN, SUBUL_QTY1, SUBUL_IUSR) VALUES (?, ?, ?, "4", ?, ?)',
              [moveSlip, salesDate, item.code, item.quantity, decoded.username]
            );
          }
          
          // 6. 매출 헤더 저장
          await db.execute(
            'INSERT INTO SALE_DNHD (DNHD_SLIP, DNHD_DATE, DNHD_SENO, DNHD_SHOP, DNHD_QTY1, DNHD_TAMT, DNHD_RAND, DNHD_IUSR) VALUES (?, ?, ?, "F1", ?, ?, ?, ?)',
            [slipNo, salesDate, seno, totalQuantity, totalAmount, randomStr, decoded.username]
          );
          
          // 7. 매출 상세 저장
          for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const hygb = item.isCash ? '1' : '0';
            
            await db.execute(
              'INSERT INTO SALE_DNDT (DNDT_SLIP, DNDT_SENO, DNDT_ITEM, DNDT_HYGB, DNDT_QTY1, DNDT_TAMT, DNDT_IUSR) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [slipNo, index + 1, item.code, hygb, item.quantity, item.totalAmount, decoded.username]
            );
          }
          
          // 8. 시제 업데이트 (당일 매출 합계 재계산)
          const [dailySales] = await db.execute(`
            SELECT IFNULL(SUM(DNDT_TAMT), 0) AS AMT2 
            FROM SALE_DNHD 
            INNER JOIN SALE_DNDT ON DNHD_SLIP = DNDT_SLIP 
            WHERE DNHD_SHOP = 'F1' AND DNDT_HYGB = '1' AND DNHD_DATE = ?
          `, [salesDate]);
          
          const dailySalesTotal = parseInt(dailySales[0].AMT2);
          
          const [existingSijeData] = await db.execute(
            'SELECT SIJE_AMT1 FROM BISH_SIJE WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
            [salesDate]
          );
          
          if (existingSijeData.length > 0) {
            const existingAmt1 = parseInt(existingSijeData[0].SIJE_AMT1);
            const newAmt3 = existingAmt1 + dailySalesTotal;
            
            await db.execute(
              'UPDATE BISH_SIJE SET SIJE_AMT2 = ?, SIJE_AMT3 = ?, SIJE_IUSR = ?, SIJE_UDAT = NOW() WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
              [dailySalesTotal, newAmt3, decoded.username, salesDate]
            );
          } else {
            await db.execute(
              'INSERT INTO BISH_SIJE (SIJE_DATE, SIJE_SHOP, SIJE_AMT1, SIJE_AMT2, SIJE_AMT3, SIJE_IUSR) VALUES (?, "F1", 0, ?, ?, ?)',
              [salesDate, dailySalesTotal, dailySalesTotal, decoded.username]
            );
          }
          
          await db.execute('COMMIT');
          
          return json({
            success: true,
            message: '매출이 저장되었습니다.',
            slipNo: slipNo,
            rand: randomStr
          });
          
        } catch (error) {
          await db.execute('ROLLBACK');
          throw error;
        }

      default:
        return json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ 프리마켓 POST API 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 매출 삭제
export async function DELETE({ url, cookies }) {
  try {
    console.log('🗑️ 프리마켓 DELETE API 호출');
    
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const sSlip = url.searchParams.get('sSlip');
    
    if (!sSlip) {
      return json({ error: '삭제할 매출 전표번호가 필요합니다.' }, { status: 400 });
    }

    const db = getDb();
    const sDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 트랜잭션 시작
    await db.execute('START TRANSACTION');

    try {
      // 1. 매출 상세 삭제
      await db.execute('DELETE FROM SALE_DNDT WHERE DNDT_SLIP = ?', [sSlip]);
      
      // 2. 매출 헤더 삭제
      await db.execute('DELETE FROM SALE_DNHD WHERE DNHD_SHOP = "F1" AND DNHD_SLIP = ?', [sSlip]);
      
      // 3. 시제 업데이트 (삭제 후 당일 매출 합계 재계산)
      const [dailySales] = await db.execute(`
        SELECT IFNULL(SUM(DNDT_TAMT), 0) AS AMT2 
        FROM SALE_DNHD 
        INNER JOIN SALE_DNDT ON DNHD_SLIP = DNDT_SLIP 
        WHERE DNHD_SHOP = 'F1' AND DNDT_HYGB = '1' AND DNHD_DATE = ?
      `, [sDate]);
      
      const dailySalesTotal = parseInt(dailySales[0].AMT2);
      
      const [existingSijeData] = await db.execute(
        'SELECT SIJE_AMT1 FROM BISH_SIJE WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
        [sDate]
      );
      
      if (existingSijeData.length > 0) {
        const existingAmt1 = parseInt(existingSijeData[0].SIJE_AMT1);
        const newAmt3 = existingAmt1 + dailySalesTotal;
        
        await db.execute(
          'UPDATE BISH_SIJE SET SIJE_AMT2 = ?, SIJE_AMT3 = ?, SIJE_IUSR = ?, SIJE_UDAT = NOW() WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
          [dailySalesTotal, newAmt3, decoded.username, sDate]
        );
      }
      
      await db.execute('COMMIT');
      
      return json({
        success: true,
        message: '매출이 삭제되었습니다.'
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ 프리마켓 DELETE API 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}