import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';


export async function GET({ url, locals }) { 
  try {
    // 미들웨어에서 인증된 사용자 확인
    const user = locals.user;
    if (!user) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const action = url.searchParams.get('action');
    const year = parseInt(url.searchParams.get('year')) || new Date().getFullYear();
    const month = parseInt(url.searchParams.get('month')) || (new Date().getMonth() + 1);
    const date = url.searchParams.get('date');

    const db = getDb();

    if (action === 'get_monthly_sales') {
      return await getMonthlySales(db, year, month);
    } else if (action === 'get_daily_sales_detail') {
      return await getDailySalesDetail(db, date);
    }

    return json({ error: '잘못된 요청입니다.' }, { status: 400 });

  } catch (error) {
    console.error('매출 캘린더 API 오류:', error);
    return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function getMonthlySales(db, year, month) {
  try {
    const startDate = `${year}${month.toString().padStart(2, '0')}01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}${month.toString().padStart(2, '0')}${daysInMonth.toString().padStart(2, '0')}`;
    
    const [rows] = await db.execute(`
      SELECT 
        DNHD_DATE as SALE_DATE,
        SUM(DNDT_TAMT) as TOTAL_AMT,
        COUNT(DISTINCT DNDT_SLIP) as SALES_COUNT
      FROM SALE_DNHD 
      INNER JOIN SALE_DNDT ON DNHD_SLIP = DNDT_SLIP
      WHERE DNHD_DATE BETWEEN ? AND ?
      GROUP BY DNHD_DATE
      ORDER BY DNHD_DATE
    `, [startDate, endDate]);

    const salesData = {};
    let totalAmount = 0;
    let totalCount = 0;

    rows.forEach(row => {
      const day = parseInt(row.SALE_DATE.toString().substring(6, 8));
      const amount = parseInt(row.TOTAL_AMT) || 0;
      const count = parseInt(row.SALES_COUNT) || 0;
      
      salesData[day] = { total: amount, count: count };
      totalAmount += amount;
      totalCount += count;
    });

    return json({
      success: true,
      year, month,
      dailySales: salesData,
      monthlyTotal: { total: totalAmount, count: totalCount }
    });

  } catch (error) {
    console.error('월별 매출 조회 오류:', error);
    return json({ 
      success: false, 
      message: '조회 실패: ' + error.message,
      dailySales: {},
      monthlyTotal: { total: 0, count: 0 }
    });
  }
}

async function getDailySalesDetail(db, date) {
  try {
    if (!date) {
      return json({ success: false, message: '날짜가 필요합니다.' });
    }

    const [rows] = await db.execute(`
      SELECT 
        h.DNHD_DATE, d.DNDT_SLIP, d.DNDT_ITEM, h.DNHD_BIGO,
        p.PROH_NAME, d.DNDT_QTY1, d.DNDT_TAMT, 
        DATE_FORMAT(h.DNHD_UDAT, '%Y-%m-%d %H:%i:%s') as DNHD_UDAT, 
        d.DNDT_HYGB, d.DNDT_SENO, h.DNHD_RAND, p.PROH_QRCD,
        COALESCE(stock.HYUN_QTY1, 0) as CURRENT_STOCK,
        stockProd.PROD_TXT1 as STOCK_MANAGEMENT_FLAG,
        onlineProd.PROD_TXT1 as ONLINE_FLAG,
        sp.POST_SLIP,
        COALESCE(sale.SALE_QTY_SUMMARY, '0/0/0') as SALES_INFO,
        IFNULL(img.IMAG_PCPH, '') as imagePath
      FROM SALE_DNHD h
      INNER JOIN SALE_DNDT d ON h.DNHD_SLIP = d.DNDT_SLIP
      INNER JOIN ASSE_PROH p ON p.PROH_GUB1 = 'A1' 
                          AND p.PROH_GUB2 = 'AK' 
                          AND d.DNDT_ITEM = p.PROH_CODE
      LEFT JOIN STOK_HYUN stock ON d.DNDT_ITEM = stock.HYUN_ITEM
      LEFT JOIN ASSE_PROD stockProd ON d.DNDT_ITEM = stockProd.PROD_CODE
                                    AND stockProd.PROD_COD2 = 'L6'
      LEFT JOIN ASSE_PROD onlineProd ON d.DNDT_ITEM = onlineProd.PROD_CODE
                                    AND onlineProd.PROD_COD2 = 'L7'
      LEFT JOIN SALE_POST sp ON h.DNHD_SLIP = sp.POST_SLIP
      LEFT JOIN ASSE_IMAG img ON d.DNDT_ITEM = img.IMAG_CODE
                              AND img.IMAG_GUB1 = 'A1'
                              AND img.IMAG_GUB2 = 'AK'
                              AND img.IMAG_GUB3 = '0'
                              AND img.IMAG_CNT1 = 1
      LEFT JOIN (
        SELECT 
          DNDT_ITEM,
          CONCAT(
            CAST(SUM(DNDT_QTY1) AS CHAR), '/',
            CAST(SUM(CASE WHEN SUBSTRING(DNDT_SLIP, 3, 4) = YEAR(CURDATE()) THEN DNDT_QTY1 ELSE 0 END) AS CHAR), '/',
            CAST(SUM(CASE WHEN SUBSTRING(DNDT_SLIP, 3, 6) = DATE_FORMAT(CURDATE(), '%Y%m') THEN DNDT_QTY1 ELSE 0 END) AS CHAR)
          ) as SALE_QTY_SUMMARY
        FROM SALE_DNDT 
        GROUP BY DNDT_ITEM
      ) sale ON d.DNDT_ITEM = sale.DNDT_ITEM       
      WHERE h.DNHD_DATE = ?
      ORDER BY d.DNDT_SLIP DESC, d.DNDT_SENO ASC
    `, [date]);

    const salesList = [];
    let cashTotal = 0, cardTotal = 0, totalQty = 0, totalAmount = 0;

    rows.forEach(row => {
      const amount = parseInt(row.DNDT_TAMT) || 0;
      const qty = parseInt(row.DNDT_QTY1) || 0;
      
      salesList.push({
        slipNo: row.DNDT_SLIP,
        pcode: row.DNDT_ITEM,
        pname: row.PROH_NAME || row.DNDT_ITEM || '상품명 없음',
        qty: qty,
        totalAmt: amount,
        hygb: row.DNDT_HYGB,
        regTime: row.DNHD_UDAT || '',
        currentStock: parseInt(row.CURRENT_STOCK) || 0,
        qrCode: row.PROH_QRCD,
        isStockManaged: (row.STOCK_MANAGEMENT_FLAG == '1'),
        imagePath: row.imagePath || '',
        // 🆕 온라인 정보 추가
        isOnline: (row.ONLINE_FLAG == '1'),
        salesInfo: row.SALES_INFO,
        postSlip: row.POST_SLIP,
        rand: row.DNHD_RAND,
        bigo: row.DNHD_BIGO || ''
      });

      totalAmount += amount;
      totalQty += qty;
      
      if (row.DNDT_HYGB === '1') {
        cashTotal += amount;
      } else {
        cardTotal += amount;
      }
    });

    return json({
      success: true,
      data: salesList,
      summary: { cashTotal, cardTotal, totalAmount, totalQty, totalCount: salesList.length }
    });

  } catch (error) {
    console.error('일별 매출 상세 조회 오류:', error);
    return json({ 
      success: false, 
      message: '조회 실패: ' + error.message,
      data: [],
      summary: { cashTotal: 0, cardTotal: 0, totalAmount: 0, totalQty: 0, totalCount: 0 }
    });
  }
}
