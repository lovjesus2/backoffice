import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { getDb } from '$lib/database.js';

const JWT_SECRET = 'your-secret-key';

export async function GET({ url, cookies }) {
  try {
    const token = cookies.get('token');
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return json({ error: '권한이 없습니다.' }, { status: 403 });
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
        DNHD_DATE, DNDT_SLIP, DNDT_ITEM, DNHD_BIGO,
        PROH_NAME, DNDT_QTY1, DNDT_TAMT, 
        DATE_FORMAT(DNHD_UDAT, '%Y-%m-%d %H:%i:%s') as DNHD_UDAT, 
        DNDT_HYGB, DNDT_SENO, DNHD_RAND, PROH_QRCD,
        COALESCE(h.HYUN_QTY1, 0) as CURRENT_STOCK,
        p.PROD_TXT1 as STOCK_MANAGEMENT_FLAG,
        sp.POST_SLIP
      FROM SALE_DNHD 
      INNER JOIN SALE_DNDT ON DNHD_SLIP = DNDT_SLIP
      INNER JOIN ASSE_PROH ON PROH_GUB1 = 'A1' 
                           AND PROH_GUB2 = 'AK' 
                           AND DNDT_ITEM = PROH_CODE
      LEFT JOIN STOK_HYUN h ON DNDT_ITEM = h.HYUN_ITEM
      LEFT JOIN ASSE_PROD p ON DNDT_ITEM = p.PROD_CODE
                            AND p.PROD_COD2 = 'L6'
      LEFT JOIN SALE_POST sp ON DNHD_SLIP = sp.POST_SLIP
      WHERE DNHD_DATE = ?
      ORDER BY DNDT_SLIP DESC, DNDT_SENO ASC
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
        postSlip: row.POST_SLIP,
        rand: row.DNHD_RAND,
        bigo: row.DNHD_BIGO || '' // 이 줄 추가
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
