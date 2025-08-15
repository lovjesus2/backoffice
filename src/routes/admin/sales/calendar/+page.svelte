<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  import { openImageModal, getProxyImageUrl } from '$lib/utils/imageModalUtils';

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
  
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  function handleImageClick(productCode, productName) {
    openImageModal(getProxyImageUrl(productCode), productName);
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

    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        if (week === 0 && day < startDayOfWeek) {
          const prevDayNum = prevMonthLastDay - (startDayOfWeek - day - 1);
          days.push({
            day: prevDayNum,
            isOtherMonth: true,
            hasSales: false,
            salesData: null
          });
        } else if (dayCount < daysInMonth) {
          dayCount++;
          const hasSales = salesData[dayCount] !== undefined;
          days.push({
            day: dayCount,
            isOtherMonth: false,
            hasSales,
            salesData: salesData[dayCount] || null
          });
        } else {
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

  function goToPreviousMonth() {
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    loadMonthlySales();
  }

  function goToNextMonth() {
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    loadMonthlySales();
  }

  function confirmDateChange() {
    currentYear = selectedYear;
    currentMonth = selectedMonth;
    showDateSelector = false;
    loadMonthlySales();
  }

  function onDayClick(dayData) {
    if (dayData.isOtherMonth) return;
    
    const dateString = `${currentYear}${String(currentMonth).padStart(2, '0')}${String(dayData.day).padStart(2, '0')}`;
    selectedDate = `${currentYear}년 ${currentMonth}월 ${dayData.day}일`;
    
    loadDailySalesDetail(dateString);
    showDailyDetail = true;
  }

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
          rand: sale.rand,
          bigo: sale.bigo || '' // 비고 추가
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

  onMount(() => {
    loadMonthlySales();
  });

  // 모달 열릴 때 body 스크롤 막기
  $: if (showDailyDetail) {
    if (browser) {
      document.body.style.overflow = 'hidden';
    }
  } else {
    if (browser) {
      document.body.style.overflow = '';
    }
  }

  onDestroy(() => {
    if (browser) {
      document.body.style.overflow = '';
    }
  });

  $: if (browser) {
    generateCalendarGrid();
  }

  $: salesGroups = groupSalesBySlip(dailySalesDetail);
</script>

<svelte:head>
  <title>매출 조회 캘린더 - 관리자 백오피스</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-gray-50">
  <!-- 헤더: 흰색 배경, 검정 글씨 -->
  <header class="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-10 mb-2.5">
    <div class="py-2.5 px-0.5">
      <h1 class="text-xl font-semibold text-gray-800 text-center m-0">매출 조회 캘린더</h1>
    </div>
  </header>

  <!-- 메인 콘텐츠 -->
  <main class="flex-1 px-2 py-0 max-w-4xl mx-auto w-full">
    <!-- 월 네비게이션 -->
    <div class="flex items-center justify-center py-2.5 px-0.5 bg-gray-50 border-b border-gray-300">
      <button 
        class="bg-blue-600 text-white border-none py-2 px-3 rounded text-sm cursor-pointer mx-2.5 hover:bg-blue-700 transition-colors"
        on:click={goToPreviousMonth}
      >
        이전달
      </button>
      
      <div class="text-center">
        <span 
          class="text-lg font-semibold text-gray-800 cursor-pointer py-2.5 px-5 rounded hover:bg-gray-200 transition-colors"
          on:click={() => { selectedYear = currentYear; selectedMonth = currentMonth; showDateSelector = true; }}
        >
          {currentYear}년 {currentMonth}월
        </span>
      </div>
      
      <button 
        class="bg-blue-600 text-white border-none py-2 px-3 rounded text-sm cursor-pointer mx-2.5 hover:bg-blue-700 transition-colors"
        on:click={goToNextMonth}
      >
        다음달
      </button>
    </div>

    <!-- 월별 합계 -->
    <div class="py-4 px-1.5 bg-gray-50 border-b border-gray-300">
      <div class="bg-white rounded-lg py-4 px-1.5 shadow-sm">
        <div class="flex flex-row gap-5 max-w-2xl mx-auto justify-center">
          <div class="text-center py-2.5 px-4 rounded-md bg-gray-50 border border-gray-200 whitespace-nowrap">
            <div class="text-sm text-gray-600 mb-1.5">총 매출액</div>
            <div class="text-lg font-semibold text-gray-800">{formatNumber(monthlyTotal.total)}</div>
          </div>
          <div class="text-center py-2.5 px-4 rounded-md bg-gray-50 border border-gray-200 whitespace-nowrap">
            <div class="text-sm text-gray-600 mb-1.5">매출 건수</div>
            <div class="text-lg font-semibold text-gray-800">{formatNumber(monthlyTotal.count)}건</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 캘린더 -->
    <div class="py-1.5 px-0 w-full">
      <div class="w-full bg-white rounded-lg shadow-lg overflow-hidden">
        <!-- 요일 헤더 -->
        <div class="grid grid-cols-7 gap-px bg-gray-300 border border-gray-300 rounded-t-lg overflow-hidden">
          {#each dayNames as dayName}
            <div class="bg-gray-700 text-white text-center py-4 px-2.5 font-semibold text-sm">{dayName}</div>
          {/each}
        </div>
        
        <!-- 캘린더 그리드 -->
        <div class="grid grid-cols-7 gap-px bg-gray-300 border border-gray-300 border-t-0 rounded-b-lg overflow-hidden">
          {#each calendarDays as dayData, index}
            {#if dayData.isOtherMonth}
              <!-- 다른 달 날짜 -->
              <div class="min-h-[80px] px-1 py-1 bg-gray-50 text-gray-400 flex flex-col relative md:min-h-16 md:px-0.5 md:py-0.5">
                <div class="text-base font-semibold mb-1.5">{dayData.day}</div>
              </div>
            {:else}
              <!-- 현재 달 날짜 -->
              <div 
                class="min-h-[80px] px-1 py-1 cursor-pointer flex flex-col relative transition-colors {dayData.hasSales ? 'bg-blue-50 hover:bg-green-100' : 'bg-white hover:bg-gray-50'} md:min-h-16 md:px-0.5 md:py-0.5"
                on:click={() => onDayClick(dayData)}
              >
                <div class="text-base font-semibold text-gray-800 mb-1.5 md:text-sm">{dayData.day}</div>
                {#if dayData.salesData}
                  <div class="flex-1 flex flex-col gap-1">
                    <div class="text-xs text-gray-800 break-all md:text-sm">{formatNumber(dayData.salesData.total)}</div>
                    <div class="text-xs text-gray-600 font-medium md:text-sm">{dayData.salesData.count}건</div>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>

<!-- 년/월 선택 모달 -->
{#if showDateSelector}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
    on:click={handleDateSelectorClick}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg w-96 max-w-[95vw] shadow-2xl" on:click|stopPropagation>
      <div class="p-5 border-b border-gray-300 flex justify-between items-center">
        <h3 class="m-0 text-lg font-semibold text-gray-800">년도와 월 선택</h3>
        <button 
          class="bg-transparent border-none text-xl cursor-pointer text-gray-600 p-0 w-8 h-8 hover:text-gray-800 transition-colors"
          on:click={() => showDateSelector = false}
          aria-label="닫기"
        >×</button>
      </div>
      <div class="p-5 flex gap-5">
        <div class="flex-1">
          <label class="block mb-2 text-sm font-medium text-gray-800">년도</label>
          <select class="w-full p-2.5 border border-gray-300 rounded text-sm bg-white" bind:value={selectedYear}>
            {#each yearOptions as year}
              <option value={year}>{year}년</option>
            {/each}
          </select>
        </div>
        <div class="flex-1">
          <label class="block mb-2 text-sm font-medium text-gray-800">월</label>
          <select class="w-full p-2.5 border border-gray-300 rounded text-sm bg-white" bind:value={selectedMonth}>
            {#each monthNames as monthName, index}
              <option value={index + 1}>{monthName}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="p-5 border-t border-gray-300 flex gap-2.5 justify-end">
        <button 
          class="py-2 px-4 border-none rounded text-sm cursor-pointer bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          on:click={confirmDateChange}
        >확인</button>
        <button 
          class="py-2 px-4 border-none rounded text-sm cursor-pointer bg-gray-500 text-white hover:bg-gray-600 transition-colors"
          on:click={() => showDateSelector = false}
        >취소</button>
      </div>
    </div>
  </div>
{/if}

<!-- 일자별 상세 모달 -->
{#if showDailyDetail}
  <div 
    class="fixed bg-black bg-opacity-50 z-50 flex items-center justify-center"
    style="top: 180px; left: 350; right: 0; bottom: 0;"
    on:click={handleModalClick}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg w-[98vw] max-w-[98vw] max-h-[95vh] overflow-hidden flex flex-col md:w-[calc(100vw-300px)] md:max-w-[calc(100vw-300px)]" on:click|stopPropagation>
      <div class="p-5 border-b border-gray-300 flex justify-between items-center bg-gray-50 flex-shrink-0">
        <h3 class="m-0 text-lg font-semibold text-gray-800">{selectedDate} 매출 상세</h3>
        <button 
          class="bg-transparent border-none text-xl cursor-pointer text-gray-600 p-0 w-8 h-8 hover:text-gray-800 transition-colors"
          on:click={() => showDailyDetail = false}
          aria-label="닫기"
        >×</button>
      </div>
      <div class="p-2.5 overflow-y-auto flex-1" style="overscroll-behavior: contain; max-height: calc(100vh - 280px);">
        <div class="bg-gray-50 p-4 rounded-md mb-4">
          <h4 class="m-0 mb-2 text-lg text-gray-800 font-semibold">{currentMonth}월 {selectedDate.split('일')[0].split('월 ')[1]}일 합계</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
              <span>현금:</span>
              <span class="font-semibold text-green-600">{formatNumber(dailySummary.cashTotal)}원</span>
            </div>
            <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
              <span>카드:</span>
              <span class="font-semibold text-blue-600">{formatNumber(dailySummary.cardTotal)}원</span>
            </div>
            <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
              <span>총 수량:</span>
              <span class="font-semibold text-gray-800">{formatNumber(dailySummary.totalQty)}개</span>
            </div>
            <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
              <span>총 금액:</span>
              <span class="font-semibold text-blue-700">{formatNumber(dailySummary.totalAmount)}원</span>
            </div>
          </div>
        </div>
        
        <div>
          {#if salesGroups.length === 0}
            <div class="text-center py-12 text-gray-500 text-lg bg-white rounded-lg shadow-sm">매출 데이터가 없습니다.</div>
          {:else}
            {#each salesGroups as group}
              <div class="mb-4 bg-white rounded-lg shadow-sm border overflow-hidden">
                <div class="p-3 bg-gray-100 border-b border-gray-200 text-gray-800 flex justify-between items-start md:p-2.5">
                  <div class="flex-1">
                    <div class="font-mono text-sm font-bold mb-1 flex items-center gap-2 break-all md:text-sm">
                      {group.slipNo}
                      <span class="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-xs font-bold">
                        {group.items.length}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2 font-mono whitespace-nowrap md:text-[10px]">{group.regTime}</div>
                    <div class="flex gap-4 flex-wrap text-sm md:w-full md:gap-2.5">
                      <div class="flex items-center gap-1">
                        <span class="text-gray-600">수량:</span>
                        <span>{group.totalQty}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-gray-600">현금:</span>
                        <span>{formatNumber(group.cashTotal)}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-gray-600">카드:</span>
                        <span>{formatNumber(group.cardTotal)}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-gray-600">합계:</span>
                        <span>{formatNumber(group.totalAmount)}</span>
                      </div>
                    </div>
                    {#if group.bigo && group.bigo.trim()}
                      <div class="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-gray-700">
                        <span class="font-semibold text-gray-600">비고:</span> {group.bigo}
                      </div>
                    {/if}
                  </div>
                  <div class="flex-shrink-0">
                    <a 
                      href="https://postcard.akojeju.com/receipt.php?sale_id={group.slipNo}_{group.rand}"
                      class="inline-block px-2.5 py-1.5 border border-gray-500 rounded text-gray-700 text-xs font-bold whitespace-nowrap hover:bg-gray-600 hover:text-white transition-all {group.postSlip ? 'bg-green-600 text-white border-green-600' : ''} md:px-2 md:py-1 md:text-[11px]"
                      target="_blank"
                    >
                      엽서
                    </a>
                  </div>
                </div>
                <div>
                  {#each group.items as item}
                    <div class="flex p-3 border-b border-gray-100 gap-3 hover:bg-gray-50 {item.hygb === '1' ? 'bg-green-50 border-l-4 border-l-green-500' : ''} md:p-2.5 md:gap-2.5">
                      <div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-gray-200 md:w-14 md:h-14">
                        {#if item.pcode}
                          <img 
                            src="/proxy-images/{item.pcode}_1.jpg" 
                            alt={item.pname}
                            class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            on:load={cacheImage}
                            on:error={(e) => { e.target.style.display = 'none'; }}
                            on:click={() => handleImageClick(item.pcode, item.pname)}
                          />
                        {:else}
                          <span class="text-xs text-gray-500 text-center leading-3 md:text-[10px]">이미지<br/>없음</span>
                        {/if}
                        {#if item.isStockManaged}
                          <span class="absolute top-0.5 right-0.5 {item.currentStock === 0 ? 'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-1 py-0.5 rounded-lg text-xs font-bold min-w-6 text-center md:text-[10px]">
                            {item.currentStock}
                          </span>
                        {/if}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="mb-2">
                          <div class="text-sm font-semibold text-gray-800 mb-1 leading-tight">
                            {item.pname}
                          </div>
                        </div>
                        <div class="flex justify-between items-center flex-wrap gap-2">
                          <div class="font-mono text-sm font-bold">
                            {#if item.qrCode}
                              <a href="{item.qrCode}" target="_blank" class="hover:text-blue-600 hover:underline cursor-pointer {item.hygb === '1' ? 'text-green-700' : 'text-blue-700'}">
                                {item.pcode}
                              </a>
                            {:else}
                              <span class="cursor-default text-gray-800">
                                {item.pcode}
                              </span>
                            {/if}
                          </div>
                          <div class="flex items-center gap-2.5 flex-shrink-0">
                            <span class="text-sm font-semibold text-gray-700">{item.qty}개</span>
                            <span class="text-sm font-bold text-red-600 text-right min-w-16">{formatNumber(item.totalAmt)}원</span>
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