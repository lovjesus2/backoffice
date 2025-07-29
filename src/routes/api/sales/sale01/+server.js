// src/routes/api/sales/sale01/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/database.js';

export async function GET({ url }) {
  const searchParams = url.searchParams;
  const date1 = searchParams.get('date1');
  const date2 = searchParams.get('date2');
  const postcardStatus = searchParams.get('postcard_status') || 'all';
  const searchType = searchParams.get('search_type') || 'name';
  const text1 = searchParams.get('text1') || '';
  const searchSubmitted = searchParams.get('search_submitted') === 'true';

  if (!searchSubmitted) {
    return json({
      success: true,
      salesGroups: [],
      grandTotal: null,
      searchResultCount: 0,
      postSlipCount: 0
    });
  }

  if (!date1 || !date2) {
    return json({
      success: false,
      message: '검색 날짜를 입력해주세요.'
    });
  }

  try {
    const db = getDb();

    // 날짜를 YYYYMMDD 형식으로 변환
    const startDate = date1.replace(/-/g, '');
    const endDate = date2.replace(/-/g, '');

    // ✅ 파라미터 바인딩으로 WHERE 절 구성
    let whereClause = `WHERE h.DNHD_DATE BETWEEN ? AND ?`;
    let params = [startDate, endDate];

    // 엽서 상태 필터
    if (postcardStatus === 'sent') {
      whereClause += ` AND sp.POST_SLIP IS NOT NULL`;
    } else if (postcardStatus === 'not-sent') {
      whereClause += ` AND sp.POST_SLIP IS NULL`;
    }

    // 검색 조건 - 제품검색과 동일한 문자별 분리 검색 적용
    if (text1.trim()) {
      if (searchType === 'name') {
        // ✅ 제품명 검색 - 각 문자를 분리하여 모두 포함되어야 함
        const searchChars = text1.trim().replace(/\s/g, '').split('');
        const nameSearchConditions = [];
        
        searchChars.forEach((char) => {
          nameSearchConditions.push("p.PROH_NAME LIKE ?");
          params.push(`%${char}%`);
        });
        
        whereClause += ` AND (${nameSearchConditions.join(' AND ')})`;
      } else if (searchType === 'code') {
        whereClause += ` AND d.DNDT_ITEM LIKE ?`;
        params.push(`%${text1.trim()}%`);
      } else if (searchType === 'slip') {
        whereClause += ` AND h.DNHD_SLIP LIKE ?`;
        params.push(`%${text1.trim()}%`);
      }
    }

    // 매출 데이터 조회 (재고 정보 포함)
    const salesQuery = `
      SELECT 
        h.DNHD_SLIP,
        h.DNHD_DATE,
        h.DNHD_RAND,
        DATE_FORMAT(h.DNHD_UDAT, '%Y-%m-%d %H:%i:%s') as REG_TIME,
        d.DNDT_ITEM,
        d.DNDT_QTY1,
        d.DNDT_TAMT,
        d.DNDT_HYGB,
        p.PROH_NAME,
        sp.POST_SLIP,
        -- 재고 정보 추가
        COALESCE(stock.HYUN_QTY1, 0) as CURRENT_STOCK,
        COALESCE(prod.PROD_TXT1, '0') as STOCK_MANAGED
      FROM SALE_DNHD h
      INNER JOIN SALE_DNDT d ON h.DNHD_SLIP = d.DNDT_SLIP
      INNER JOIN ASSE_PROH p ON p.PROH_GUB1 = 'A1' 
                             AND p.PROH_GUB2 = 'AK' 
                             AND d.DNDT_ITEM = p.PROH_CODE
      LEFT JOIN SALE_POST sp ON h.DNHD_SLIP = sp.POST_SLIP
      -- 재고 정보 조인
      LEFT JOIN STOK_HYUN stock ON d.DNDT_ITEM = stock.HYUN_ITEM
      LEFT JOIN ASSE_PROD prod ON d.DNDT_ITEM = prod.PROD_CODE
                               AND prod.PROD_COD2 = 'L6'
      ${whereClause}
      ORDER BY h.DNHD_SLIP DESC, d.DNDT_SENO ASC
    `;

    const [rows] = await db.execute(salesQuery, params);

    // 매출 그룹화
    const salesGroups = [];
    const groupMap = new Map();
    let totalCash = 0, totalCard = 0, totalAmount = 0, totalQty = 0;
    let postSlipCount = 0;
    const processedSlips = new Set();

    rows.forEach(row => {
      const slipNo = row.DNHD_SLIP;
      const amount = parseInt(row.DNDT_TAMT) || 0;
      const qty = parseInt(row.DNDT_QTY1) || 0;
      const isStockManaged = row.STOCK_MANAGED === '1';
      const currentStock = parseInt(row.CURRENT_STOCK) || 0;

      // 전체 합계 계산
      totalAmount += amount;
      totalQty += qty;
      
      if (row.DNDT_HYGB === '1') {
        totalCash += amount;
      } else {
        totalCard += amount;
      }

      // 엽서 발송 건수 계산 (슬립별로 한 번만)
      if (!processedSlips.has(slipNo)) {
        processedSlips.add(slipNo);
        if (row.POST_SLIP) {
          postSlipCount++;
        }
      }

      // 그룹 생성 또는 기존 그룹에 추가
      if (!groupMap.has(slipNo)) {
        groupMap.set(slipNo, {
          slipNo: slipNo,
          regTime: row.REG_TIME,
          rand: row.DNHD_RAND,
          postSlip: row.POST_SLIP,
          totalAmount: 0,
          cashTotal: 0,
          cardTotal: 0,
          totalQty: 0,
          items: []
        });
      }

      const group = groupMap.get(slipNo);
      
      // 그룹 합계 업데이트
      group.totalAmount += amount;
      group.totalQty += qty;
      
      if (row.DNDT_HYGB === '1') {
        group.cashTotal += amount;
      } else {
        group.cardTotal += amount;
      }

      // 상품 아이템 추가
      group.items.push({
        itemCode: row.DNDT_ITEM,
        itemName: row.PROH_NAME || row.DNDT_ITEM,
        qty: qty,
        totalAmount: amount,
        hygb: row.DNDT_HYGB,
        // 재고 정보 추가
        currentStock: currentStock,
        stockManaged: isStockManaged
      });
    });

    // Map을 배열로 변환
    groupMap.forEach(group => {
      salesGroups.push(group);
    });

    const grandTotal = {
      cashTotal: totalCash,
      cardTotal: totalCard,
      totalAmount: totalAmount,
      totalQty: totalQty
    };

    return json({
      success: true,
      salesGroups: salesGroups,
      grandTotal: grandTotal,
      searchResultCount: salesGroups.length,
      postSlipCount: postSlipCount
    });

  } catch (error) {
    console.error('SALE01 조회 오류:', error);
    return json({
      success: false,
      message: '조회 중 오류가 발생했습니다: ' + error.message
    });
  }
}