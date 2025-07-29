<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { simpleCache } from '$lib/utils/simpleImageCache';

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

  // 이미지 모달 상태
  let showImageModal = false;
  let modalImageSrc = '';
  let modalImageAlt = '';
  let modalImageLoading = false;
  let modalImageError = false;

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

  // 이미지 모달 열기
  function openImageModal(imageSrc, imageAlt) {
    // 캐시 활용을 위해 원본 URL 그대로 사용
    modalImageSrc = imageSrc;
    modalImageAlt = imageAlt;
    modalImageLoading = true;
    modalImageError = false;
    showImageModal = true;
    
    // 모바일에서 스크롤 방지
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
  }

  // 이미지 모달 닫기
  function closeImageModal() {
    showImageModal = false;
    modalImageSrc = '';
    modalImageAlt = '';
    modalImageLoading = false;
    modalImageError = false;
    
    // 모바일에서 스크롤 복원
    document.body.style.overflow = '';
  }

  // 모달 이미지 로드 완료
  function handleModalImageLoad(event) {
    modalImageLoading = false;
    cacheImage(event);
  }

  // 모달 이미지 로드 실패
  function handleModalImageError() {
    modalImageLoading = false;
    modalImageError = true;
  }

  // ESC 키로 모달 닫기
  function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
      if (showImageModal) {
        closeImageModal();
      } else if (showDailyDetail) {
        showDailyDetail = false;
      } else if (showDateSelector) {
        showDateSelector = false;
      }
    }
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

      if (data.success) {
        dailySalesDetail = data.salesDetail || [];
        dailySummary = data.dailySummary || {
          cashTotal: 0,
          cardTotal: 0,
          totalAmount: 0,
          totalQty: 0
        };
      } else {
        console.error('일일 매출 상세 로드 실패:', data.message);
        dailySalesDetail = [];
        dailySummary = { cashTotal: 0, cardTotal: 0, totalAmount: 0, totalQty: 0 };
      }
    } catch (error) {
      console.error('일일 매출 상세 로드 오류:', error);
      dailySalesDetail = [];
      dailySummary = { cashTotal: 0, cardTotal: 0, totalAmount: 0, totalQty: 0 };
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

  function changeDate() {
    currentYear = selectedYear;
    currentMonth = selectedMonth;
    showDateSelector = false;
    loadMonthlySales();
  }

  async function onDayClick(dayData) {
    if (dayData.isOtherMonth || !dayData.hasSales) return;

    const year = currentYear;
    const month = String(currentMonth).padStart(2, '0');
    const day = String(dayData.day).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    selectedDate = `${year}년 ${currentMonth}월 ${dayData.day}일`;
    
    await loadDailySalesDetail(dateString);
    showDailyDetail = true;
  }

  function groupSalesBySlip(salesDetail) {
    const groups = {};
    
    salesDetail.forEach(item => {
      if (!groups[item.slipNo]) {
        groups[item.slipNo] = {
          slipNo: item.slipNo,
          items: [],
          totalAmount: 0,
          totalQty: 0,
          hasPostSlip: item.hasPostSlip || false
        };
      }
      
      groups[item.slipNo].items.push(item);
      groups[item.slipNo].totalAmount += item.totalAmt;
      groups[item.slipNo].totalQty += item.qty;
      
      if (item.hasPostSlip) {
        groups[item.slipNo].hasPostSlip = true;
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
  $: if (showDailyDetail || showImageModal) {
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

<svelte:window on:keydown={handleGlobalKeydown} />

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
    <div class="py-4 px-1 bg-gray-50 border-b border-gray-300">
      <div class="bg-white rounded-lg py-4 px-1 shadow">
        <div class="text-lg font-semibold mb-4 text-gray-800 text-center">
          {currentYear}년 {currentMonth}월 매출 합계
        </div>
        <div class="flex justify-center gap-5 max-w-2xl mx-auto">
          <div class="text-center py-2.5 px-4 rounded bg-gray-50 border border-gray-200 whitespace-nowrap">
            <div class="text-sm text-gray-600 mb-1">총 매출</div>
            <div class="text-lg font-semibold text-gray-800">{formatNumber(monthlyTotal.total)}원</div>
          </div>
          <div class="text-center py-2.5 px-4 rounded bg-gray-50 border border-gray-200 whitespace-nowrap">
            <div class="text-sm text-gray-600 mb-1">거래 수</div>
            <div class="text-lg font-semibold text-gray-800">{formatNumber(monthlyTotal.count)}건</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 캘린더 -->
    <div class="py-1 px-0.5">
      <div class="w-full m-0">
        <!-- 요일 헤더 -->
        <div class="grid grid-cols-7 gap-px bg-gray-300 border border-gray-300 rounded-t-lg overflow-hidden">
          {#each dayNames as dayName}
            <div class="bg-gray-700 text-white text-center py-4 px-2.5 font-semibold text-sm">
              {dayName}
            </div>
          {/each}
        </div>
        
        <!-- 캘린더 그리드 -->
        <div class="grid grid-cols-7 gap-px bg-gray-300 border border-gray-300 border-t-0 rounded-b-lg overflow-hidden">
          {#each calendarDays as dayData}
            <div 
              class="bg-white min-h-24 p-2 cursor-pointer flex flex-col relative 
                     {dayData.isOtherMonth ? 'bg-gray-50 text-gray-400' : ''} 
                     {dayData.hasSales ? 'bg-blue-50' : ''} 
                     hover:bg-gray-100 
                     {dayData.hasSales && !dayData.isOtherMonth ? 'hover:bg-green-100' : ''}"
              on:click={() => onDayClick(dayData)}
            >
              <div class="text-base font-semibold text-gray-800 mb-1">
                {dayData.day}
              </div>
              <div class="flex-1 flex flex-col gap-1">
                {#if dayData.salesData}
                  <div class="text-xs font-semibold text-gray-800 break-all">
                    {formatNumber(dayData.salesData.total)}원
                  </div>
                  <div class="text-xs text-gray-600 font-medium">
                    {formatNumber(dayData.salesData.count)}건
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>

<!-- 년/월 선택 모달 -->
{#if showDateSelector}
  <div 
    class="flex fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50 items-center justify-center"
    on:click={handleDateSelectorClick}
  >
    <div class="bg-white rounded-lg p-0 w-96 max-w-95vw shadow-lg">
      <div class="py-5 px-5 border-b border-gray-300 flex justify-between items-center">
        <h3 class="m-0 text-lg font-semibold text-gray-800">날짜 선택</h3>
        <button 
          class="bg-none border-none text-xl cursor-pointer text-gray-600 p-0 w-7 h-7 hover:text-gray-800"
          on:click={() => showDateSelector = false}
        >
          ×
        </button>
      </div>
      <div class="py-5 px-5 flex gap-5">
        <div class="flex-1">
          <label class="block mb-2 text-sm font-medium text-gray-800">년도</label>
          <select 
            bind:value={selectedYear}
            class="w-full py-2.5 px-2.5 border border-gray-300 rounded text-sm bg-white"
          >
            {#each yearOptions as year}
              <option value={year}>{year}년</option>
            {/each}
          </select>
        </div>
        <div class="flex-1">
          <label class="block mb-2 text-sm font-medium text-gray-800">월</label>
          <select 
            bind:value={selectedMonth}
            class="w-full py-2.5 px-2.5 border border-gray-300 rounded text-sm bg-white"
          >
            {#each monthNames as monthName, index}
              <option value={index + 1}>{monthName}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="py-5 px-5 border-t border-gray-300 flex gap-2.5 justify-end">
        <button 
          class="py-2 px-4 border-none rounded text-sm cursor-pointer bg-gray-500 text-white hover:bg-gray-600"
          on:click={() => showDateSelector = false}
        >
          취소
        </button>
        <button 
          class="py-2 px-4 border-none rounded text-sm cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
          on:click={changeDate}
        >
          확인
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 일별 매출 상세 모달 -->
{#if showDailyDetail}
  <div 
    class="flex fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50 items-center justify-center"
    on:click={handleModalClick}
  >
    <div class="bg-white rounded-lg max-w-98vw w-98vw max-h-95vh overflow-hidden flex flex-col">
      <div class="py-5 px-5 border-b border-gray-300 flex justify-between items-center bg-gray-50 flex-shrink-0">
        <h3 class="m-0 text-lg font-semibold text-gray-800">{selectedDate} 매출 상세</h3>
        <button 
          class="bg-none border-none text-xl cursor-pointer text-gray-600 p-0 w-7 h-7 hover:text-gray-800"
          on:click={() => showDailyDetail = false}
        >
          ×
        </button>
      </div>
      <div class="py-2.5 px-2.5 overflow-y-auto flex-1">
        <!-- 일별 합계 -->
        <div class="bg-gray-50 py-2.5 px-4 rounded mb-4">
          <h4 class="m-0 mb-2 text-lg text-gray-800 font-semibold">일별 합계</h4>
          <div class="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2">
            <div class="flex items-center gap-1 text-xs md:text-xs">
              <span class="text-gray-600">현금:</span>
              <div class="text-green-600 font-bold">{formatNumber(dailySummary.cashTotal)}원</div>
            </div>
            <div class="flex items-center gap-1 text-xs md:text-xs">
              <span class="text-gray-600">카드:</span>
              <div class="text-blue-600 font-bold">{formatNumber(dailySummary.cardTotal)}원</div>
            </div>
            <div class="flex items-center gap-1 text-xs md:text-xs">
              <span class="text-gray-600">총 수량:</span>
              <div class="text-gray-800 font-bold">{formatNumber(dailySummary.totalQty)}개</div>
            </div>
            <div class="flex items-center gap-1 text-xs md:text-xs">
              <span class="text-gray-600">총 금액:</span>
              <div class="text-red-600 font-bold">{formatNumber(dailySummary.totalAmount)}원</div>
            </div>
          </div>
        </div>

        <!-- 매출 그룹별 상세 -->
        {#each salesGroups as group}
          <div class="mb-4 bg-white rounded-lg shadow overflow-hidden">
            <div class="py-4 px-4 bg-yellow-100 border-b border-yellow-200 text-yellow-800 flex justify-between items-start gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 text-base font-bold mb-1 flex-wrap">
                  <span>매출전표 {group.slipNo}</span>
                  <span class="bg-yellow-800 text-white text-xs py-0.5 px-2 rounded-full whitespace-nowrap">
                    {group.items.length}개 상품
                  </span>
                </div>
                <div class="flex gap-3 text-sm flex-wrap">
                  <div class="flex items-center gap-1">
                    <span class="text-gray-600">현금:</span>
                    <span class="text-green-600 font-bold">{formatNumber(group.items.filter(item => item.hygb === '1').reduce((sum, item) => sum + item.totalAmt, 0))}원</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-gray-600">카드:</span>
                    <span class="text-blue-600 font-bold">{formatNumber(group.items.filter(item => item.hygb === '2').reduce((sum, item) => sum + item.totalAmt, 0))}원</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-gray-600">수량:</span>
                    <span class="text-gray-800 font-bold">{formatNumber(group.totalQty)}개</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-gray-600">금액:</span>
                    <span class="text-red-600 font-bold">{formatNumber(group.totalAmount)}원</span>
                  </div>
                </div>
              </div>
              <div class="flex-shrink-0">
                <a 
                  href="{group.hasPostSlip ? `https://shop.naver.com/postcards/digital` : `https://shop.naver.com/postcards/digital?search=${group.slipNo}`}"
                  class="inline-block py-1 px-2 border border-gray-500 rounded text-gray-500 no-underline text-xs font-bold whitespace-nowrap {group.hasPostSlip ? 'bg-green-600 text-white border-green-600' : ''} md:px-2 md:py-1 md:text-[11px]"
                  target="_blank"
                >
                  엽서
                </a>
              </div>
            </div>
            <div>
              {#each group.items as item}
                <div class="flex p-3 border-b border-gray-100 gap-3 hover:bg-gray-50 {item.hygb === '1' ? 'bg-green-50 border-l-4 border-l-green-500' : ''} md:p-2.5 md:gap-2.5">
                  <div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-gray-200 md:w-14 md:h-14 cursor-pointer" on:click={() => openImageModal(`/proxy-images/${item.pcode}_1.jpg`, item.pname)}>
                    {#if item.pcode}
                      <img 
                        src="/proxy-images/{item.pcode}_1.jpg" 
                        alt={item.pname}
                        class="w-full h-full object-cover hover:opacity-80 transition-opacity duration-200"
                        on:load={cacheImage}
                        on:error={(e) => { e.target.style.display = 'none'; }}
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
                          <a href="{item.qrCode}" target="_blank" class="hover:text-blue-600 hover:underline cursor-pointer {item.hygb === '1' ? 'text-green-600' : 'text-blue-600'}">
                            {item.pcode}
                          </a>
                        {:else}
                          <span class="{item.hygb === '1' ? 'text-green-600' : 'text-blue-600'}">{item.pcode}</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="text-sm font-semibold text-gray-800">{formatNumber(item.qty)}개</div>
                        <div class="text-sm font-bold text-red-600">{formatNumber(item.totalAmt)}원</div>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- 이미지 확대 모달 -->
{#if showImageModal}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" style="touch-action: none;" on:click={closeImageModal}>
    <div class="relative w-full h-full max-w-4xl max-h-screen p-4 flex items-center justify-center" on:click|stopPropagation>
      
      <!-- 로딩 상태 -->
      {#if modalImageLoading}
        <div class="flex items-center justify-center min-h-64 min-w-64">
          <div class="text-white text-center">
            <div class="text-4xl mb-3 animate-spin">🔄</div>
            <p>이미지 로딩 중...</p>
          </div>
        </div>
      {/if}
      
      <!-- 에러 상태 -->
      {#if modalImageError}
        <div class="flex items-center justify-center min-h-64 min-w-64">
          <div class="text-white text-center">
            <div class="text-4xl mb-3">❌</div>
            <p>이미지를 불러올 수 없습니다</p>
            <button 
              class="mt-3 px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors duration-200"
              style="touch-action: manipulation;"
              on:click={() => {
                modalImageLoading = true;
                modalImageError = false;
                // 캐시 활용을 위해 원본 URL 그대로 재시도
                const tempSrc = modalImageSrc.split('?')[0]; // 혹시 있을 타임스탬프 제거
                modalImageSrc = '';
                setTimeout(() => {
                  modalImageSrc = tempSrc;
                }, 10);
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      {/if}
      
      <!-- 확대된 이미지 -->
      {#if modalImageSrc && !modalImageError}
        <div class="relative">
          <!-- 닫기 버튼 - 이미지 위에 배치 -->
          <button 
            class="absolute top-2 right-2 text-white bg-black bg-opacity-70 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-90 transition-all duration-200 z-10"
            style="touch-action: manipulation;"
            on:click={closeImageModal}
          >
            ✕
          </button>
          
          <img 
            src={modalImageSrc}
            alt={modalImageAlt}
            class="max-w-full max-h-full object-contain rounded-lg shadow-2xl {modalImageLoading ? 'hidden' : 'block'}"
            style="user-select: none; -webkit-user-select: none; pointer-events: none;"
            on:load={handleModalImageLoad}
            on:error={handleModalImageError}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}