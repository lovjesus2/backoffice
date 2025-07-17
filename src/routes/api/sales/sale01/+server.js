// src/routes/api/sales/sale01/+server.js
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

    // 파라미터 처리
    const date1 = url.searchParams.get('date1') || new Date().toISOString().split('T')[0];
    const date2 = url.searchParams.get('date2') || new Date().toISOString().split('T')[0];
    const postcardStatus = url.searchParams.get('postcard_status') || 'all';
    const searchType = url.searchParams.get('search_type') || 'name';
    const text1 = url.searchParams.get('text1') || '';
    const searchSubmitted = url.searchParams.get('search_submitted');

    // 검색 요청이 없으면 빈 결과 반환
    if (!searchSubmitted) {
      return json({
        success: true,
        salesGroups: [],
        grandTotal: null,
        searchResultCount: 0,
        postSlipCount: 0,
        message: '검색 조건을 입력하고 검색 버튼을 클릭하세요.'
      });
    }

    // 날짜를 데이터베이스 형식으로 변환 (YYYYMMDD)
    const startDate = date1.replace(/-/g, '');
    const endDate = date2.replace(/-/g, '');

    const db = getDb();

    // 검색 조건 구성
    let searchCondition = '1=1';
    const searchParams = [startDate, endDate];

    // 텍스트 검색 조건 추가
    if (text1.trim()) {
      if (searchType === 'name') {
        searchCondition += ' AND PROH_NAME LIKE ?';
        searchParams.push(`%${text1}%`);
      } else if (searchType === 'code') {
        searchCondition += ' AND DNDT_ITEM LIKE ?';
        searchParams.push(`%${text1}%`);
      }
    }

    // 엽서 상태 조건
    let postcardCondition = '';
    if (postcardStatus === 'registered') {
      postcardCondition = 'AND ps.POST_SLIP IS NOT NULL';
    } else if (postcardStatus === 'unregistered') {
      postcardCondition = 'AND ps.POST_SLIP IS NULL';
    }

    // 메인 쿼리 - 원본 PHP와 동일한 구조
    const mainQuery = `
      SELECT 
        h.DNHD_SLIP as slip_no,
        h.DNHD_DATE as sale_date,
        h.DNHD_UDAT as reg_time,
        h.DNHD_BIGO as memo,
        h.DNHD_RAND as rand,
        d.DNDT_ITEM as item_code,
        d.DNDT_QTY1 as qty,
        d.DNDT_TAMT as total_amt,
        d.DNDT_HYGB as hygb,
        p.PROH_NAME as product_name,
        p.PROH_QRCD as qr_code,
        COALESCE(s.HYUN_QTY1, 0) as current_stock,
        COALESCE(ap.PROD_TXT1, '0') as stock_management_flag,
        ps.POST_SLIP as post_slip
      FROM SALE_DNHD h
      INNER JOIN SALE_DNDT d ON h.DNHD_SLIP = d.DNDT_SLIP
      INNER JOIN ASSE_PROH p ON p.PROH_GUB1 = 'A1' 
        AND p.PROH_GUB2 = 'AK' 
        AND d.DNDT_ITEM = p.PROH_CODE
        AND ${searchCondition}
      LEFT JOIN STOK_HYUN s ON d.DNDT_ITEM = s.HYUN_ITEM
      LEFT JOIN ASSE_PROD ap ON d.DNDT_ITEM = ap.PROD_CODE 
        AND ap.PROD_GUB1 = 'A1' 
        AND ap.PROD_GUB2 = 'AK' 
        AND ap.PROD_COD2 = 'L5'
      LEFT JOIN SALE_POST ps ON h.DNHD_SLIP = ps.POST_SLIP
      WHERE h.DNHD_DATE BETWEEN ? AND ?
        ${postcardCondition}
      ORDER BY h.DNHD_SLIP DESC, d.DNDT_ITEM
    `;

    const [rows] = await db.execute(mainQuery, searchParams);

    // 매출번호별로 그룹화
    const salesGroups = groupSalesBySlip(rows);

    // 전체 합계 계산
    const grandTotal = calculateGrandTotal(rows);

    // 엽서 발송 건수 계산
    const postSlipCount = salesGroups.filter(group => group.postSlip).length;

    return json({
      success: true,
      salesGroups,
      grandTotal,
      searchResultCount: salesGroups.length,
      postSlipCount,
      dateRange: { start: date1, end: date2 }
    });

  } catch (error) {
    console.error('SALE_01 API 오류:', error);
    return json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      salesGroups: [],
      grandTotal: null,
      searchResultCount: 0,
      postSlipCount: 0
    }, { status: 500 });
  }
}

// 매출번호별 그룹화 함수 (원본 PHP와 동일한 로직)
function groupSalesBySlip(rows) {
  const groups = {};

  rows.forEach(row => {
    const slipNo = row.slip_no;
    
    if (!groups[slipNo]) {
      groups[slipNo] = {
        slipNo: slipNo,
        saleDate: row.sale_date,
        regTime: row.reg_time,
        memo: row.memo,
        postSlip: row.post_slip,
        rand: row.rand,
        items: [],
        totalAmount: 0,
        cashTotal: 0,
        cardTotal: 0,
        totalQty: 0
      };
    }

    // 아이템 정보 추가
    const item = {
      itemCode: row.item_code,
      productName: row.product_name || '',
      qrCode: row.qr_code || '',
      qty: parseInt(row.qty) || 0,
      totalAmt: parseInt(row.total_amt) || 0,
      hygb: row.hygb, // 1: 현금, 2: 카드
      currentStock: parseInt(row.current_stock) || 0,
      stockManagementFlag: row.stock_management_flag
    };

    groups[slipNo].items.push(item);
    groups[slipNo].totalAmount += item.totalAmt;
    groups[slipNo].totalQty += item.qty;

    // 현금/카드 구분 집계
    if (item.hygb === '1') {
      groups[slipNo].cashTotal += item.totalAmt;
    } else {
      groups[slipNo].cardTotal += item.totalAmt;
    }
  });

  // 객체를 배열로 변환하고 정렬
  return Object.values(groups).sort((a, b) => b.slipNo.localeCompare(a.slipNo));
}

// 전체 합계 계산 함수 (원본 PHP와 동일한 로직)
function calculateGrandTotal(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }

  let totalAmount = 0;
  let cashAmount = 0;
  let cardAmount = 0;
  let totalQty = 0;

  // 매출번호별로 중복 제거하여 계산
  const processedSlips = new Set();
  const slipTotals = {};

  rows.forEach(row => {
    const slipNo = row.slip_no;
    const amount = parseInt(row.total_amt) || 0;
    const qty = parseInt(row.qty) || 0;
    const hygb = row.hygb;

    if (!slipTotals[slipNo]) {
      slipTotals[slipNo] = {
        totalAmount: 0,
        cashAmount: 0,
        cardAmount: 0,
        totalQty: 0
      };
    }

    slipTotals[slipNo].totalAmount += amount;
    slipTotals[slipNo].totalQty += qty;

    if (hygb === '1') {
      slipTotals[slipNo].cashAmount += amount;
    } else {
      slipTotals[slipNo].cardAmount += amount;
    }
  });

  // 전체 합계 계산
  Object.values(slipTotals).forEach(slip => {
    totalAmount += slip.totalAmount;
    cashAmount += slip.cashAmount;
    cardAmount += slip.cardAmount;
    totalQty += slip.totalQty;
  });

  return {
    totalAmount,
    cashAmount,
    cardAmount,
    totalQty
  };
}

// POST 메서드도 지원 (필요시)
export async function POST({ request, cookies }) {
  return json({ error: 'POST 메서드는 지원되지 않습니다.' }, { status: 405 });
}