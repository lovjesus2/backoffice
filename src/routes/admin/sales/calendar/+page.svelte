<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // 상태 변수들
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  let salesData = {};
  let monthlyTotal = { total: 0, count: 0 };
  let calendarDays = [];
  
  // 모달 상태
  let showDateSelector = false;
  let showDailyDetail = false;
  let selectedYear = currentYear;
  let selectedMonth = currentMonth;
  let selectedDate = '';
  let dailySalesDetail = [];
  let dailySummary = {
    cashTotal: 0,
    cardTotal: 0,
    totalAmount: 0,
    totalQty: 0
  };

  // 년도 옵션 생성
  $: yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i);

  // 월 이름
  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // 요일 이름
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 숫자 포맷팅
  function formatNumber(num) {
    if (num === 0 || num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 캘린더 그리드 생성
  function generateCalendarGrid() {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();

    const days = [];
    let dayCount = 0;

    // 6주 생성
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        if (week === 0 && day < startDayOfWeek) {
          // 이전 달 날짜
          const prevDayNum = prevMonthLastDay - (startDayOfWeek - day - 1);
          days.push({
            day: prevDayNum,
            isOtherMonth: true,
            hasSales: false,
            salesData: null
          });
        } else if (dayCount < daysInMonth) {
          // 현재 달 날짜
          dayCount++;
          const hasSales = salesData[dayCount] !== undefined;
          days.push({
            day: dayCount,
            isOtherMonth: false,
            hasSales,
            salesData: salesData[dayCount] || null
          });
        } else {
          // 다음 달 날짜
          const nextDayNum = (dayCount - daysInMonth) + 1;
          days.push({
            day: nextDayNum,
            isOtherMonth: true,
            hasSales: false,
            salesData: null
          });
          dayCount++;
        }
      }
      if (dayCount >= daysInMonth && week >= 4) break;
    }

    calendarDays = days;
  }

  // 월별 매출 데이터 로드
  async function loadMonthlySales() {
    if (!browser) return;

    try {
      const response = await fetch(`/api/sales/calendar?action=get_monthly_sales&year=${currentYear}&month=${currentMonth}`);
      const data = await response.json();

      if (data.success) {
        salesData = data.dailySales || {};
        monthlyTotal = data.monthlyTotal || { total: 0, count: 0 };
        generateCalendarGrid();
      } else {
        console.error('매출 데이터 로드 실패:', data.message);
        salesData = {};
        monthlyTotal = { total: 0, count: 0 };
        generateCalendarGrid();
      }
    } catch (error) {
      console.error('매출 데이터 로드 오류:', error);
      salesData = {};
      monthlyTotal = { total: 0, count: 0 };
      generateCalendarGrid();
    }
  }

  // 일자별 상세 데이터 로드
  async function loadDailySalesDetail(date) {
    if (!browser) return;

    try {
      const response = await fetch(`/api/sales/calendar?action=get_daily_sales_detail&date=${date}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        dailySalesDetail = data.data;
        dailySummary = data.summary;
      } else {
        dailySalesDetail = [];
        dailySummary = {
          cashTotal: 0,
          cardTotal: 0,
          totalAmount: 0,
          totalQty: 0
        };
      }
    } catch (error) {
      console.error('일자별 상세 데이터 로드 오류:', error);
      dailySalesDetail = [];
      dailySummary = {
        cashTotal: 0,
        cardTotal: 0,
        totalAmount: 0,
        totalQty: 0
      };
    }
  }

  // 이전달
  function goToPreviousMonth() {
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    loadMonthlySales();
  }

  // 다음달
  function goToNextMonth() {
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    loadMonthlySales();
  }

  // 날짜 선택 확인
  function confirmDateChange() {
    currentYear = selectedYear;
    currentMonth = selectedMonth;
    showDateSelector = false;
    loadMonthlySales();
  }

  // 일자 클릭
  function onDayClick(dayData) {
    if (dayData.isOtherMonth) return;
    
    const dateString = `${currentYear}${String(currentMonth).padStart(2, '0')}${String(dayData.day).padStart(2, '0')}`;
    selectedDate = `${currentYear}년 ${currentMonth}월 ${dayData.day}일`;
    
    loadDailySalesDetail(dateString);
    showDailyDetail = true;
  }

  // 매출 그룹화
  function groupSalesBySlip(salesList) {
    const groups = {};
    
    salesList.forEach(sale => {
      if (!groups[sale.slipNo]) {
        groups[sale.slipNo] = {
          items: [],
          regTime: sale.regTime,
          totalAmount: 0,
          cashTotal: 0,
          cardTotal: 0,
          totalQty: 0,
          postSlip: sale.postSlip,
          rand: sale.rand
        };
      }
      
      groups[sale.slipNo].items.push(sale);
      groups[sale.slipNo].totalAmount += sale.totalAmt;
      groups[sale.slipNo].totalQty += sale.qty;
      
      if (sale.hygb === '1') {
        groups[sale.slipNo].cashTotal += sale.totalAmt;
      } else {
        groups[sale.slipNo].cardTotal += sale.totalAmt;
      }
    });
    
    return Object.entries(groups).map(([slipNo, group]) => ({
      slipNo,
      ...group
    }));
  }

  // 모달 외부 클릭 시 닫기
  function handleModalClick(event) {
    if (event.target === event.currentTarget) {
      showDailyDetail = false;
    }
  }

  function handleDateSelectorClick(event) {
    if (event.target === event.currentTarget) {
      showDateSelector = false;
    }
  }

  // 컴포넌트 마운트 시 초기화
  onMount(() => {
    loadMonthlySales();
  });

  // 반응형 업데이트
  $: if (browser) {
    generateCalendarGrid();
  }

  $: salesGroups = groupSalesBySlip(dailySalesDetail);
</script>

<svelte:head>
  <title>매출 조회 캘린더 - 관리자 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

<div class="page">
  <header class="header">
    <h1>매출 조회 캘린더</h1>
  </header>

  <main class="content">
    <div class="month-navigation">
      <button class="nav-btn" id="prevMonthBtn" on:click={goToPreviousMonth}>이전달</button>
      <div class="current-month" id="currentMonth">
        <span class="month-year" id="monthYearSpan" on:click={() => { selectedYear = currentYear; selectedMonth = currentMonth; showDateSelector = true; }}>
          {currentYear}년 {currentMonth}월
        </span>
      </div>
      <button class="nav-btn" id="nextMonthBtn" on:click={goToNextMonth}>다음달</button>
    </div>

    <div class="monthly-summary" id="monthlySummary">
      <div class="summary-card">
        <div class="summary-title">이번 달 합계</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">총 매출액</div>
            <div class="summary-value" id="monthlyTotal">{formatNumber(monthlyTotal.total)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">매출 건수</div>
            <div class="summary-value" id="monthlyCount">{formatNumber(monthlyTotal.count)}건</div>
          </div>
        </div>
      </div>
    </div>

    <div class="calendar-container">
      <div class="calendar-wrapper">
        <div class="calendar-header">
          {#each dayNames as dayName}
            <div class="day-name">{dayName}</div>
          {/each}
        </div>
        <div class="calendar-grid" id="calendarGrid">
          {#each calendarDays as dayData}
            <div 
              class="calendar-day {dayData.isOtherMonth ? 'other-month' : ''} {dayData.hasSales ? 'has-sales' : ''}"
              on:click={() => onDayClick(dayData)}
              role="button"
              tabindex="0"
            >
              <div class="day-number">{dayData.day}</div>
              {#if dayData.salesData}
                <div class="day-sales">
                  <div class="sales-amount">{formatNumber(dayData.salesData.total)}</div>
                  <div class="sales-count">{dayData.salesData.count}건</div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>

<!-- 년/월 선택 모달 -->
{#if showDateSelector}
  <div class="date-selector-modal" id="dateSelectorModal" on:click={handleDateSelectorClick}>
    <div class="date-selector-content">
      <div class="date-selector-header">
        <h3>년도와 월 선택</h3>
        <button class="close-btn" id="closeDateSelector" on:click={() => showDateSelector = false}>X</button>
      </div>
      <div class="date-selector-body">
        <div class="year-selector">
          <label>년도</label>
          <select id="yearSelect" bind:value={selectedYear}>
            {#each yearOptions as year}
              <option value={year}>{year}년</option>
            {/each}
          </select>
        </div>
        <div class="month-selector">
          <label>월</label>
          <select id="monthSelect" bind:value={selectedMonth}>
            {#each monthNames as monthName, index}
              <option value={index + 1}>{monthName}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="date-selector-footer">
        <button class="btn-confirm" id="confirmDateChange" on:click={confirmDateChange}>확인</button>
        <button class="btn-cancel" id="cancelDateChange" on:click={() => showDateSelector = false}>취소</button>
      </div>
    </div>
  </div>
{/if}

<!-- 일자별 상세 모달 -->
{#if showDailyDetail}
  <div class="modal-overlay" id="dailyDetailModal" on:click={handleModalClick}>
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle">{selectedDate} 매출 상세</h3>
        <button class="modal-close-btn" on:click={() => showDailyDetail = false}>X</button>
      </div>
      <div class="modal-body">
        <div class="daily-summary" id="dailySummaryContainer">
          <h4>{currentMonth}월 {selectedDate.split('일')[0].split('월 ')[1]}일 합계</h4>
          <div class="daily-summary-grid">
            <div class="daily-summary-row">
              <div>현금:</div>
              <div class="cash-payment">{formatNumber(dailySummary.cashTotal)}원</div>
            </div>
            <div class="daily-summary-row">
              <div>카드:</div>
              <div class="card-payment">{formatNumber(dailySummary.cardTotal)}원</div>
            </div>
            <div class="daily-summary-row">
              <div>총 수량:</div>
              <div class="total-quantity">{formatNumber(dailySummary.totalQty)}개</div>
            </div>
            <div class="daily-summary-row">
              <div>총 금액:</div>
              <div class="total-amount">{formatNumber(dailySummary.totalAmount)}원</div>
            </div>
          </div>
        </div>
        
        <div class="sales-groups-container" id="salesGroupsContainer">
          {#if salesGroups.length === 0}
            <div style="text-align: center; padding: 20px; color: #999;">해당 일자에 매출 데이터가 없습니다.</div>
          {:else}
            {#each salesGroups as group}
              <div class="sales-group">
                <div class="sales-group-header">
                  <div class="sales-group-title">
                    <div class="sales-group-number">
                      {group.slipNo}
                      <span class="sales-group-count">{formatNumber(group.totalQty)}개</span>
                      <span class="sales-group-date-time">{group.regTime || ''}</span>
                    </div>
                    
                    <div class="sales-group-summary">
                      <div class="summary-item-inline">
                        <span>현금:</span>
                        <span class="cash-value">{formatNumber(group.cashTotal)}원</span>
                      </div>
                      <div class="summary-item-inline">
                        <span>카드:</span>
                        <span class="card-value">{formatNumber(group.cardTotal)}원</span>
                      </div>
                      <div class="summary-item-inline">
                        <span>금액:</span>
                        <span class="total-value">{formatNumber(group.totalAmount)}원</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="sales-group-controls">
                    <a 
                      href="https://postcard.akojeju.com/receipt.php?sale_id={group.slipNo}_{group.rand}" 
                      target="_blank"
                      class="digital-postcard {group.postSlip && group.postSlip.trim() !== '' ? 'has-post-slip' : ''}"
                    >
                      엽서
                    </a>
                  </div>
                </div>
                
                <div class="sales-group-content">
                  {#each group.items as item}
                    <div class="sales-item {item.hygb === '1' ? 'cash-payment-item' : ''}">
                      
                      <div class="item-image-container">
                        {#if item.isStockManaged}
                          <div class="stock-badge {item.currentStock === 0 ? 'zero-stock' : item.currentStock <= 5 ? 'low-stock' : item.currentStock <= 20 ? 'medium-stock' : ''}">
                            {item.currentStock}개
                          </div>
                        {/if}
                        
                        {#if item.pcode !== 'ZZ' && item.pcode !== 'zz'}
                          <img 
                            src="/proxy-images/{item.pcode}_1.jpg"
                            alt={item.pname}
                            class="item-image"
                            on:error={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'block';
                            }}
                          />
                          <div class="no-image" style="display:none;">이미지 없음</div>
                        {:else}
                          <div class="no-image">이미지 없음</div>
                        {/if}
                      </div>
                      
                      <div class="sales-item-content">
                        <div class="sales-item-header">
                          <div class="sales-item-title">
                            {#if item.qrCode}
                              <a href={item.qrCode} target="_blank">{item.pname}</a>
                            {:else}
                              {item.pname}
                            {/if}
                          </div>
                        </div>
                        
                        <div class="sales-item-info">
                          <div class="sales-item-code {item.hygb === '1' ? 'cash-payment' : 'card-payment'}">{item.pcode}</div>
                          
                          <div class="sales-item-amounts">
                            <div class="sales-item-quantity">{formatNumber(item.qty)}개</div>
                            <div class="sales-item-price">{formatNumber(item.totalAmt)}원</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* 기본 설정 */
  * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
  }

  body {
      font-family: 'Malgun Gothic', sans-serif;
      background-color: #f8f9fa;
      color: #333;
      font-size: 16px;
      line-height: 1.6;
  }

  .page {
      width: 100%;
      margin: 0;
      padding: 2px 1px;
  }

  /* 헤더 스타일 */
  .header {
      background: white;
      padding: 15px 5px;
      margin-bottom: 5px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
  }

  .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
  }

  /* 모달 합계 부분 세로 사이즈 줄이기 */
  .daily-summary {
      background: #f8f9fa;
      padding: 5px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
  }

  .daily-summary h4 {
      display: none;
  }

  .daily-summary-grid {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 300px;
      margin: 0 auto;
  }

  .daily-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      font-size: 14px;
  }

  .daily-summary-row div:first-child {
      color: #666;
      font-weight: 500;
  }

  .daily-summary-row .cash-payment {
      color: #28a745;
      font-weight: bold;
  }

  .daily-summary-row .card-payment {
      color: #007bff;
      font-weight: bold;
  }

  .daily-summary-row .total-amount {
      color: #dc3545;
      font-weight: bold;
      font-size: 16px;
  }

  .daily-summary-row .total-quantity {
      color: #333;
      font-weight: bold;
  }

  /* 메인 컨텐츠 */
  .content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
  }

  /* 월 네비게이션 */
  .month-navigation {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 15px 2px;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
  }

  .nav-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
      margin: 0 20px;
  }

  .nav-btn:hover {
      background: #0056b3;
  }

  .current-month {
      text-align: center;
  }

  .month-year {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      cursor: pointer;
      padding: 10px 20px;
      border-radius: 5px;
  }

  .month-year:hover {
      background-color: #e9ecef;
  }

  /* 년/월 선택 모달 */
  .date-selector-modal {
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
  }

  .date-selector-content {
      background: white;
      border-radius: 8px;
      padding: 0;
      width: 450px;
      max-width: 95vw;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .date-selector-header {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
  }

  .date-selector-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
  }

  .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
  }

  .close-btn:hover {
      color: #333;
  }

  .date-selector-body {
      padding: 20px;
      display: flex;
      gap: 20px;
  }

  .year-selector, .month-selector {
      flex: 1;
  }

  .date-selector-body label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #333;
  }

  .date-selector-body select {
      width: 100%;
      padding: 10px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 14px;
      background: white;
  }

  .date-selector-footer {
      padding: 20px;
      border-top: 1px solid #dee2e6;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
  }

  .btn-confirm, .btn-cancel {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
  }

  .btn-confirm {
      background: #007bff;
      color: white;
  }

  .btn-confirm:hover {
      background: #0056b3;
  }

  .btn-cancel {
      background: #6c757d;
      color: white;
  }

  .btn-cancel:hover {
      background: #545b62;
  }

  /* 월별 합계 */
  .monthly-summary {
      padding: 15px 5px;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
  }

  .summary-card {
      background: white;
      border-radius: 8px;
      padding: 15px 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .summary-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #333;
      text-align: center;
  }

  .summary-grid {
      display: flex;
      flex-direction: row;
      gap: 20px;
      max-width: 600px;
      margin: 0 auto;
      justify-content: center;
  }

  .summary-item {
      text-align: center;
      padding: 10px 15px;
      border-radius: 6px;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      white-space: nowrap;
  }

  .summary-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
  }

  .summary-value {
      font-size: 18px;
      font-weight: 600;
      color: #333;
  }

  /* 캘린더 */
  .calendar-container {
      padding: 5px 1px;
  }

  .calendar-wrapper {
      width: 100%;
      margin: 0;
  }

  .calendar-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: #dee2e6;
      border: 1px solid #dee2e6;
      border-radius: 8px 8px 0 0;
      overflow: hidden;
  }

  .day-name {
      background: #2c3e50;
      color: white;
      text-align: center;
      padding: 15px 10px;
      font-weight: 600;
      font-size: 14px;
  }

  .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: #dee2e6;
      border: 1px solid #dee2e6;
      border-top: none;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
  }

  .calendar-day {
      background: white;
      min-height: 100px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      position: relative;
  }

  .calendar-day:hover {
      background: #f8f9fa;
  }

  .calendar-day.other-month {
      background: #f8f9fa;
      color: #ccc;
  }

  .calendar-day.has-sales {
      background: #e8f4f8;
  }

  .calendar-day.has-sales:hover {
      background: #d4edda;
  }

  .day-number {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 5px;
  }

  .day-sales {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
  }

  .sales-amount {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      word-break: break-all;
  }

  .sales-count {
      font-size: 12px;
      color: #666;
      font-weight: 500;
  }

  /* 모달 스타일 */
  .modal-overlay {
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
  }

  .modal-content {
      background: white;
      border-radius: 8px;
      max-width: 98vw;
      width: 98vw;
      max-height: 95vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
  }

  .modal-header {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8f9fa;
      flex-shrink: 0;
  }

  .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
  }

  .modal-close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
  }

  .modal-close-btn:hover {
      color: #333;
  }

  /* 모달 바디 전체 스크롤 적용 */
  .modal-body {
      padding: 10px;
      overflow-y: auto;
      flex: 1;
  }

  .daily-summary {
      background: #f8f9fa;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 15px;
  }

  .daily-summary h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #333;
      font-weight: 600;
      text-align: center;
  }

  .daily-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      max-width: 400px;
      margin: 0 auto;
  }

  .daily-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 14px;
  }

  .daily-summary-row div:first-child {
      color: #666;
      font-weight: 500;
  }

  .daily-summary-row .cash-payment {
      color: #28a745;
      font-weight: bold;
  }

  .daily-summary-row .card-payment {
      color: #007bff;
      font-weight: bold;
  }

  .daily-summary-row .total-amount {
      color: #dc3545;
      font-weight: bold;
      font-size: 16px;
  }

  .daily-summary-row .total-quantity {
      color: #333;
      font-weight: bold;
  }

  /* 매출 그룹 스타일 */
  .sales-group {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
  }

  .sales-group-header {
      background: #f8f9fa;
      padding: 12px 15px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 15px;
  }

  .sales-group-title {
      flex: 1;
      min-width: 200px;
      display: block;
      overflow: visible;
  }

  .sales-group-controls {
      flex-shrink: 0;
      align-self: flex-start;
  }

  .sales-group-number {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      color: #333;
      word-break: break-all;
      display: flex;
      align-items: center;
      gap: 8px;
  }

  .sales-group-count {
      background: #007bff;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: bold;
      margin-left: 8px;
  }

  .sales-group-date-time {
      font-size: 12px;
      color: #666;
      margin-top: 0;
      margin-right: 8px;
      font-family: 'Courier New', monospace;
      display: inline-block;
      white-space: nowrap;
      flex-shrink: 0;
  }

  .sales-group-summary {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
      width: 100%;
      margin: 0;
  }

  .summary-item-inline {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
  }

  .summary-item-inline span:first-child {
      color: #666;
  }

  .summary-item-inline .cash-value {
      color: #28a745;
      font-weight: bold;
  }

  .summary-item-inline .card-value {
      color: #007bff;
      font-weight: bold;
  }

  .summary-item-inline .total-value {
      color: #dc3545;
      font-weight: bold;
  }

  .sales-group-content {
      padding: 0;
  }

  .sales-item {
      display: flex;
      padding: 12px 15px;
      border-bottom: 1px solid #f0f0f0;
      align-items: flex-start;
      gap: 12px;
  }

  .sales-item:last-child {
      border-bottom: none;
  }

  .sales-item:hover {
      background: #f8f9fa;
  }

  .sales-item.cash-payment-item {
      background: rgba(40, 167, 69, 0.05);
      border-left: 3px solid #28a745;
  }

  .sales-item.cash-payment-item:hover {
      background: rgba(40, 167, 69, 0.1);
  }

  .stock-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: #ffc107;
      color: #333;
      padding: 2px 5px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: bold;
      min-width: 25px;
      text-align: center;
      z-index: 10;
  }

  .stock-badge.low-stock {
      background: #ffc107;
      color: #333;
  }

  .stock-badge.medium-stock {
      background: #ffc107;
      color: #333;
  }

  .stock-badge.zero-stock {
      background: #6c757d;
  }

  .item-image-container {
      width: 70px;
      height: 70px;
      border-radius: 6px;
      overflow: hidden;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      flex-shrink: 0;
      position: relative;
  }

  .item-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
  }

  .no-image {
      font-size: 10px;
      color: #999;
      text-align: center;
      padding: 25px 5px;
      line-height: 1.2;
  }

  .sales-item-content {
      flex: 1;
      min-width: 0;
  }

  .sales-item-header {
      margin-bottom: 8px;
  }

  .sales-item-title {
      font-size: 15px;
      font-weight: 600;
      color: #333;
      line-height: 1.3;
      margin-bottom: 4px;
  }

  .sales-item-title a {
      color: inherit;
      text-decoration: none;
  }

  .sales-item-title a:hover {
      color: #007bff;
      text-decoration: underline;
  }

  .sales-item-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: nowrap;
      gap: 8px;
  }

  .sales-item-code {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      font-weight: bold;
      color: #495057;
  }

  .sales-item-code.cash-payment {
      color: #155724;
  }

  .sales-item-code.card-payment {
      color: #004085;
  }

  .sales-item-amounts {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
  }

  .sales-item-quantity {
      font-size: 13px;
      font-weight: 600;
      color: #495057;
  }

  .sales-item-price {
      font-size: 15px;
      font-weight: bold;
      color: #dc3545;
      text-align: right;
      min-width: 70px;
  }

  .sales-group-controls {
      align-self: flex-start;
  }

  .digital-postcard {
      display: inline-block;
      padding: 6px 10px;
      border: 1px solid #6c757d;
      border-radius: 4px;
      color: #6c757d;
      text-decoration: none;
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
  }

  .digital-postcard.has-post-slip {
      background: #28a745;
      color: white;
      border-color: #28a745;
  }

  .digital-postcard:hover {
      background: #5a6268;
      color: white;
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
      .page {
          padding: 1px 0px;
          width: 100%;
          margin: 0;
      }
      
      .header {
          padding: 10px 2px;
          margin-bottom: 5px;
      }
      
      .header h1 {
          font-size: 20px;
      }
      
      .month-navigation {
          padding: 10px 2px;
      }
      
      .nav-btn {
          padding: 8px 12px;
          font-size: 13px;
          margin: 0 10px;
      }
      
      .month-year {
          font-size: 18px;
      }
      
      .summary-grid {
          display: flex;
          flex-direction: row;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
      }
      
      .calendar-container {
          padding: 2px 0px;
      }
      
      .calendar-day {
          min-height: 80px;
          padding: 6px 4px;
      }
      
      .day-number {
          font-size: 14px;
      }
      
      .sales-amount {
          font-size: 11px;
      }
      
      .sales-count {
          font-size: 10px;
      }
      
      .modal-content {
          width: 99vw;
          max-width: 99vw;
      }
      
      .modal-body {
          padding: 8px;
      }
      
      .daily-summary {
          padding: 8px 10px;
          margin-bottom: 10px;
      }
      
      .daily-summary-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px;
      }
      
      .daily-summary-row {
          display: flex;
          padding: 4px 0;
          font-size: 13px;
      }
      
      .sales-group-header {
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
      }
      
      .sales-group-title {
          flex: 1;
          display: block;
          width: auto;
          min-width: 150px;
          line-height: 1.4;
      }
      
      .sales-group-date-time {
          font-size: 10px;
          margin: 0;
          padding: 0;
          font-family: 'Malgun Gothic', sans-serif;
          display: inline;
          white-space: nowrap;
          letter-spacing: -0.3px;
      }
      
      .sales-group-number {
          display: inline;
          font-size: 13px;
          word-break: break-all;
          margin-left: 3px;
      }
      
      .sales-group-summary {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          width: 100%;
          margin: 0;
      }
      
      .sales-item {
          padding: 10px 12px;
          gap: 10px;
      }
      
      .item-image-container {
          width: 60px;
          height: 60px;
      }
      
      .sales-item-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: nowrap;
          gap: 6px;
      }
      
      .sales-group-controls {
          flex-shrink: 0;
      }

      .digital-postcard {
          padding: 5px 8px;
          font-size: 11px;
      }

      .sales-item-amounts {
          align-self: flex-end;
      }
  }
</style>