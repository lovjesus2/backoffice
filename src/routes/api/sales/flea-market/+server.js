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
        
        productQuery += ' ORDER BY p.PROH_CODE LIMIT 50';
        
        const [products] = await db.execute(productQuery, params);
        
        return json({
          success: true,
          data: products.map(product => ({
            code: product.PROH_CODE,
            name: product.PROH_NAME,
            price: parseInt(product.DPRC_SOPR || 0),
            cost: parseInt(product.DPRC_BAPR || 0),
            category_code: product.category_code,
            category_name: product.category_name,
            image_url: `https://image.kungkungne.synology.me/${product.PROH_CODE}.jpg`
          }))
        });

      case 'search_products':
        // 상품 검색 (기존 PHP와 동일한 로직)
        const searchTerm = url.searchParams.get('searchTerm') || '';
        const searchType = url.searchParams.get('searchType') || 'name';
        const productFilter = url.searchParams.get('productFilter') || 'all';
        const discontinuedFilter = url.searchParams.get('discontinuedFilter') || 'normal';
        
        let searchParams = {};
        let searchSQL = '';
        
        if (searchType === 'code') {
          searchSQL = 'PROH_CODE LIKE :search_term';
          searchParams.search_term = '%' + searchTerm + '%';
        } else {
          // 제품명 검색 - 각 문자를 분리하여 모두 포함
          const searchTermNoSpace = searchTerm.replace(/\s/g, '');
          const searchChars = [...searchTermNoSpace];
          
          const nameSearchConditions = [];
          searchChars.forEach((char, index) => {
            const paramName = `char_${index}`;
            nameSearchConditions.push(`PROH_NAME LIKE :${paramName}`);
            searchParams[paramName] = '%' + char + '%';
          });
          
          searchSQL = nameSearchConditions.join(' AND ');
        }
        
        // 상품 구분 필터
        let joinSQL = '';
        let productSQL = '';
        if (productFilter === 'flea') {
          joinSQL = 'INNER JOIN ASSE_FLEA ON PROH_CODE = FLEA_ITEM';
        } else if (productFilter === 'normal') {
          joinSQL = 'LEFT JOIN ASSE_FLEA ON PROH_CODE = FLEA_ITEM';
          productSQL = 'AND FLEA_ITEM IS NULL';
        } else {
          joinSQL = 'LEFT JOIN ASSE_FLEA ON PROH_CODE = FLEA_ITEM';
        }
        
        // 단종 필터
        let discontinuedSQL = '';
        if (discontinuedFilter === 'discontinued') {
          discontinuedSQL = 'AND PROD_TXT1 = :discontinued_status';
          searchParams.discontinued_status = '1';
        } else if (discontinuedFilter === 'normal') {
          discontinuedSQL = 'AND (PROD_TXT1 = :normal_status OR PROD_TXT1 IS NULL)';
          searchParams.normal_status = '0';
        }
        
        const searchQuery = `
          SELECT PROH_CODE, PROH_NAME, DPRC_SOPR, DPRC_BAPR, PROD_TXT1,
                 (CASE WHEN FLEA_ITEM IS NOT NULL THEN 1 ELSE 0 END) as IS_FLEA
          FROM ASSE_PROH
          INNER JOIN ASSE_PROD
             ON PROH_GUB1 = PROD_GUB1
            AND PROH_GUB2 = PROD_GUB2
            AND PROH_CODE = PROD_CODE
            AND PROD_COD2 = 'L5'
          INNER JOIN BISH_DPRC
             ON PROH_CODE = DPRC_CODE
          ${joinSQL}
          WHERE PROH_GUB1 = 'A1'
            AND PROH_GUB2 = 'AK'
            AND (${searchSQL})
            ${discontinuedSQL}
            ${productSQL}
          ORDER BY PROH_CODE ASC
          LIMIT 50
        `;
        
        const [searchResults] = await db.execute(searchQuery, searchParams);
        
        return json({
          success: true,
          data: searchResults.map(product => ({
            code: product.PROH_CODE,
            name: product.PROH_NAME,
            price: parseInt(product.DPRC_SOPR || 0),
            cost: parseInt(product.DPRC_BAPR || 0),
            discontinued: product.PROD_TXT1,
            is_flea: product.IS_FLEA > 0,
            image_url: `https://image.kungkungne.synology.me/${product.PROH_CODE}.jpg`
          }))
        });

      case 'get_sije_amt3':
        // 시제 금액 조회
        const date = url.searchParams.get('date');
        if (!date) {
          return json({ error: '날짜가 필요합니다.' }, { status: 400 });
        }
        
        const [sijeRows] = await db.execute(`
          SELECT IFNULL(SIJE_AMT3, 0) AS SIJE_AMT3 
          FROM BISH_SIJE 
          WHERE SIJE_DATE = ? AND SIJE_SHOP = 'F1' 
          LIMIT 1
        `, [date]);
        
        const sijeAmt3 = sijeRows.length > 0 ? parseInt(sijeRows[0].SIJE_AMT3) : 0;
        
        return json({
          success: true,
          sije_amt3: sijeAmt3
        });

      case 'get_sales_list':
        // 매출 목록 조회
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        
        if (!startDate || !endDate) {
          return json({ error: '조회 기간을 선택해주세요.' }, { status: 400 });
        }
        
        const [salesList] = await db.execute(`
          SELECT h.DNHD_SLIP, h.DNHD_DATE, h.DNHD_QTY1, h.DNHD_TAMT, h.DNHD_IDAT, h.DNHD_RAND
          FROM SALE_DNHD h
          WHERE h.DNHD_DATE BETWEEN ? AND ?
            AND h.DNHD_SHOP = 'F1'
          ORDER BY h.DNHD_DATE DESC, h.DNHD_SLIP DESC
        `, [startDate, endDate]);
        
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

      case 'register_sije':
        if (!date || sijeAmount === undefined) {
          return json({ error: '날짜와 시제 금액이 필요합니다.' }, { status: 400 });
        }
        
        // 기존 시제 데이터 확인
        const [existingSije] = await db.execute(
          'SELECT SIJE_AMT1, SIJE_AMT2 FROM BISH_SIJE WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
          [date]
        );
        
        if (existingSije.length > 0) {
          const currentAmt2 = parseInt(existingSije[0].SIJE_AMT2 || 0);
          const newAmt3 = parseInt(sijeAmount) + currentAmt2;
          
          // 업데이트
          await db.execute(
            'UPDATE BISH_SIJE SET SIJE_AMT1 = ?, SIJE_AMT3 = ?, SIJE_IDAT = NOW(), SIJE_IUSR = ? WHERE SIJE_DATE = ? AND SIJE_SHOP = "F1"',
            [sijeAmount, newAmt3, decoded.username, date]
          );
        } else {
          // 신규 등록
          await db.execute(
            'INSERT INTO BISH_SIJE (SIJE_DATE, SIJE_SHOP, SIJE_AMT1, SIJE_AMT2, SIJE_AMT3, SIJE_IDAT, SIJE_IUSR) VALUES (?, "F1", ?, 0, ?, NOW(), ?)',
            [date, sijeAmount, sijeAmount, decoded.username]
          );
        }
        
        return json({
          success: true,
          message: '시제가 등록되었습니다.'
        });

      case 'save_sales':
        // 매출 저장 (기존 PHP 로직과 동일)
        if (!items || !Array.isArray(items) || items.length === 0) {
          return json({ error: '매출 항목을 추가해주세요.' }, { status: 400 });
        }

        const sDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        let slipNo = sSlip;
        let randomStr = null;
        let reverseSlip = null;
        let salesSlip = null;

        // 1. 매출번호 생성 (없을 경우)
        if (!slipNo) {
          const [senoRows] = await db.execute(
            'SELECT IFNULL(MAX(SLIP_SENO), 0) + 1 AS SENO FROM BISH_SLIP WHERE SLIP_GUBN = "SL" AND SLIP_DATE = ?',
            [sDate]
          );
          const iSeno = senoRows[0].SENO;
          
          slipNo = 'SL' + sDate + iSeno.toString().padStart(5, '0');
          
          await db.execute(
            'INSERT INTO BISH_SLIP (SLIP_GUBN, SLIP_DATE, SLIP_SENO, SLIP_SLIP, SLIP_IUSR) VALUES ("SL", ?, ?, ?, ?)',
            [sDate, iSeno, slipNo, decoded.username]
          );
        }

        // 2. 기존 매출 확인 및 수불 전표번호 생성
        const [existingSales] = await db.execute(
          'SELECT DNHD_SLIP FROM SALE_DNHD WHERE DNHD_SLIP = ?',
          [slipNo]
        );
        
        if (existingSales.length > 0) {
          reverseSlip = await generateMoveSlip(db, sDate, decoded.username);
        }
        
        salesSlip = await generateMoveSlip(db, sDate, decoded.username);

        // 트랜잭션 시작
        await db.execute('START TRANSACTION');

        try {
          // 3. 기존 매출 반제 처리 (생략 - 복잡한 재고 로직)
          
          // 4. 기존 매출 상세 삭제
          await db.execute('DELETE FROM SALE_DNDT WHERE DNDT_SLIP = ?', [slipNo]);
          
          // 5. 총 수량, 총 금액 계산
          const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
          const totalAmt = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
          
          // 6. 매출 헤더 저장/업데이트
          const [existingHeader] = await db.execute(
            'SELECT DNHD_SLIP, DNHD_RAND FROM SALE_DNHD WHERE DNHD_SLIP = ?',
            [slipNo]
          );
          
          if (existingHeader.length > 0) {
            randomStr = existingHeader[0].DNHD_RAND;
            await db.execute(
              'UPDATE SALE_DNHD SET DNHD_DATE = ?, DNHD_QTY1 = ?, DNHD_TAMT = ?, DNHD_IUSR = ?, DNHD_UDAT = NOW() WHERE DNHD_SLIP = ?',
              [sDate, totalQty, totalAmt, decoded.username, slipNo]
            );
          } else {
            randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
            await db.execute(
              'INSERT INTO SALE_DNHD (DNHD_SLIP, DNHD_DATE, DNHD_SHOP, DNHD_BPCD, DNHD_SLGB, DNHD_QTY1, DNHD_TAMT, DNHD_BIGO, DNHD_RAND, DNHD_IUSR) VALUES (?, ?, "F1", "", "SL", ?, ?, "", ?, ?)',
              [slipNo, sDate, totalQty, totalAmt, randomStr, decoded.username]
            );
          }
          
          // 7. 매출 상세 저장
          for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const hygb = item.isCash ? '1' : '0';
            
            await db.execute(
              'INSERT INTO SALE_DNDT (DNDT_SLIP, DNDT_SENO, DNDT_ITEM, DNDT_HYGB, DNDT_QTY1, DNDT_TAMT, DNDT_IUSR) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [slipNo, index + 1, item.code, hygb, item.quantity, item.quantity * item.price, decoded.username]
            );
          }
          
          // 8. 시제 업데이트 (당일 매출 합계 재계산)
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
          } else {
            await db.execute(
              'INSERT INTO BISH_SIJE (SIJE_DATE, SIJE_SHOP, SIJE_AMT1, SIJE_AMT2, SIJE_AMT3, SIJE_IUSR) VALUES (?, "F1", 0, ?, ?, ?)',
              [sDate, dailySalesTotal, dailySalesTotal, decoded.username]
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