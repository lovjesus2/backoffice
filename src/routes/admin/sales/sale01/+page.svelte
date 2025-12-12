<!-- src/routes/admin/sales/sale01/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { simpleCache, getProxyImageUrl} from '$lib/utils/simpleImageCache';
  import { openImageModal } from '$lib/utils/imageModalUtils';
  import ImageModalStock from '$lib/components/ImageModalStock.svelte';  // 🔄 추가

  // 부모 레이아웃에서 전달받은 사용자 정보
  export let data;
  $: ({ user } = data);

  // 검색 조건
  let date1 = new Date().toISOString().split('T')[0];
  let date2 = new Date().toISOString().split('T')[0];
  let postcardStatus = 'all';
  let searchType = 'name';
  let text1 = '';

  // 상태 관리
  let loading = false;
  let error = '';
  let searchSubmitted = false;

  // 검색 결과
  let salesGroups = [];
  let grandTotal = null;
  let searchResultCount = 0;
  let postSlipCount = 0;

  // 이미지 캐싱
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  // 🔄 이미지 클릭 핸들러 수정 - productCode만 전달
  function handleImageClick(item) {
    const imageSrc = getProxyImageUrl(item.imagePath);
    if (imageSrc) {
      // productCode만 전달하고 이미지 모달에서 API로 제품 정보 조회
      openImageModal(imageSrc, item.itemName, item.itemCode);
    }
  }

  
  // 숫자 포맷팅
  function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 검색 실행
  async function handleSearch() {
    if (!browser) return;

    if (!date1 || !date2) {
      error = '검색 날짜를 선택해주세요.';
      return;
    }

    if (new Date(date1) > new Date(date2)) {
      error = '시작일이 종료일보다 늦을 수 없습니다.';
      return;
    }

    loading = true;
    error = '';
    searchSubmitted = true;

    try {
      const params = new URLSearchParams({
        date1,
        date2,
        postcard_status: postcardStatus,
        search_type: searchType,
        text1: text1.trim(),
        search_submitted: 'true'
      });

      const response = await fetch(`/api/sales/sale01?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        salesGroups = data.salesGroups || [];
        grandTotal = data.grandTotal;
        searchResultCount = data.searchResultCount || 0;
        postSlipCount = data.postSlipCount || 0;
        error = '';
      } else {
        throw new Error(data.message || '검색 중 오류가 발생했습니다.');
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // 엔터키 검색
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }

  // 재고 업데이트
  function handleStockUpdated(event) {
    const { productCode, newStock, stockManaged } = event.detail;
    salesGroups = salesGroups.map(group => ({
      ...group,
      items: group.items.map(item => 
        item.itemCode === productCode 
          ? { ...item, currentStock: newStock, stockManaged }
          : item
      )
    }));
    salesGroups = [...salesGroups];
  }

  // 단종 상태 업데이트
  function handleDiscontinuedUpdated(event) {
    const { productCode, discontinued } = event.detail;
    salesGroups = salesGroups.map(group => ({
      ...group,
      items: group.items.map(item => 
        item.itemCode === productCode 
          ? { ...item, discontinued }
          : item
      )
    }));
    salesGroups = [...salesGroups];
  }

  // 재고관리 토글
  function handleStockUsageUpdated(event) {
    const { productCode, stockManaged } = event.detail;
    salesGroups = salesGroups.map(group => ({
      ...group,
      items: group.items.map(item => 
        item.itemCode === productCode 
          ? { ...item, stockManaged }
          : item
      )
    }));
    salesGroups = [...salesGroups];
  }

  // 온라인 상태 업데이트
  function handleOnlineUpdated(event) {
    const { productCode, isOnline } = event.detail;
    salesGroups = salesGroups.map(group => ({
      ...group,
      items: group.items.map(item => 
        item.itemCode === productCode 
          ? { ...item, isOnline }
          : item
      )
    }));
    salesGroups = [...salesGroups];
  }

  // 현금세팅 상태 업데이트
  function handleCashStatusUpdated(event) {
    const { productCode, cash_status } = event.detail;
    salesGroups = salesGroups.map(group => ({
      ...group,
      items: group.items.map(item => 
        item.itemCode === productCode 
          ? { ...item, cash_status }
          : item
      )
    }));
    salesGroups = [...salesGroups];
  }

  onMount(() => {
    const today = new Date().toISOString().split('T')[0];
    date1 = today;
    date2 = today;
  });
</script>

<svelte:head>
  <title>매출 조회 - 관리자 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- 헤더 -->
  <header class="bg-white text-center shadow-sm mb-1.5" style="padding: 15px 5px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 class="m-0 text-xl font-semibold text-gray-800">매출 조회</h1>
  </header>

  <!-- 메인 컨텐츠 -->
  <main class="p-0">
    <!-- 검색 폼 -->
    <form class="bg-white rounded-lg mx-1 px-3 py-3 shadow-sm mb-1" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);" on:submit|preventDefault={handleSearch}>
      <!-- 기간 선택 -->
      <div class="mb-4 flex items-center gap-2">
        <input
          type="date"
          bind:value={date1}
          class="px-3 py-3 border border-gray-300 rounded-md text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          required
        />
        <span class="font-bold text-gray-600">~</span>
        <input
          type="date"
          bind:value={date2}
          class="px-3 py-3 border border-gray-300 rounded-md text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          required
        />
      </div>

      <!-- 검색 입력 -->
      <div class="flex gap-2">
        <select bind:value={searchType} class="px-3 py-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-colors">
          <option value="name">상품명</option>
          <option value="code">상품코드</option>
        </select>
        <input
          type="text"
          bind:value={text1}
          class="flex-1 px-3 py-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          placeholder="검색어를 입력하세요"
          on:keydown={handleKeydown}
        />
        <button type="submit" disabled={loading} class="px-6 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {loading ? '검색중...' : '검색'}
        </button>
      </div>
    </form>

    <!-- 오류 메시지 -->
    {#if error}
      <div class="bg-red-50 border-l-4 border-red-500 rounded-r-lg mx-1 mb-1" style="padding: 1rem;">
        <p class="text-red-700 font-medium">{error}</p>
      </div>
    {/if}

    <!-- 로딩 -->
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="text-center">
          <div class="text-4xl mb-3 animate-spin">🔄</div>
          <p class="text-gray-600">검색 중...</p>
        </div>
      </div>
    {/if}

    <!-- 검색 결과 요약 -->
    {#if searchSubmitted && grandTotal}
      <div class="mx-1 mb-3">
        <h4 class="text-lg font-semibold mb-3 text-gray-800 text-center">검색 결과 합계</h4>

        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
            <span>현금:</span>
            <span class="font-semibold text-green-600">{formatNumber(grandTotal.cashTotal)}원</span>
          </div>
          <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
            <span>카드:</span>
            <span class="font-semibold text-blue-600">{formatNumber(grandTotal.cardTotal)}원</span>
          </div>
          <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
            <span>총 수량:</span>
            <span class="font-semibold text-gray-800">{formatNumber(grandTotal.totalQty)}개</span>
          </div>
          <div class="flex justify-between p-1.5 bg-white rounded border border-gray-200">
            <span>총 금액:</span>
            <span class="font-semibold text-blue-700">{formatNumber(grandTotal.totalAmount)}원</span>
          </div>
        </div>

        <div class="bg-white rounded-lg p-2 shadow-sm border border-gray-200 text-center text-sm text-gray-600">
          <span class="mr-4">매출 건수: {searchResultCount}건</span>
          <span>엽서 발송: {postSlipCount}건</span>
        </div>
      </div>
    {/if}

    <!-- 매출 그룹 목록 -->
    {#if searchSubmitted && salesGroups.length > 0}
      <div class="mx-1 space-y-3">
        {#each salesGroups as group}
          <div class="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <!-- 매출 그룹 헤더 카드 -->
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
            
            <!-- 매출 상품 목록 (캘린더 모달과 완전히 동일) -->
            <div>
              {#each group.items as item}
                <div class="flex p-3 border-b border-gray-100 gap-3 hover:bg-gray-50 {item.hygb === '1' ? 'bg-green-50 border-l-4 border-l-green-500' : ''} md:p-2.5 md:gap-2.5">
                  <!-- 상품 이미지 컨테이너 -->
                  <div class="w-20 h-20 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-gray-200">
                    {#if item.itemCode}
                      <img 
                        src={getProxyImageUrl(item.imagePath)} 
                        alt={item.itemName}
                        class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        on:load={cacheImage}
                        on:error={(e) => { e.target.style.display = 'none'; }}
                        on:click={() => handleImageClick(item)}
                      />
                    {:else}
                      <span class="text-xs text-gray-500 text-center leading-3">이미지<br/>없음</span>
                    {/if}
                    
                    <!-- 재고 배지 (오른쪽 위) -->
                    {#if item.stockManaged}
                      <span class="absolute top-0.5 right-0.5 {item.currentStock === 0 ? 'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-1 py-0.5 rounded-lg text-xs font-bold min-w-6 text-center">
                        {item.currentStock}
                      </span>
                    {/if}
                    
                    <!-- 온라인 배지 (왼쪽 위) -->
                    {#if item.isOnline}
                      <span class="absolute top-0.5 left-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-xs rounded-full px-1.5 py-0.5 font-medium shadow-sm" 
                        style="font-size: 0.6rem; line-height: 1;">
                        ON
                      </span>
                    {/if}

                    <!-- salesinfo 배지 (하단 전체) -->
                    {#if item.salesInfo}
                      <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center px-1 py-0.5" 
                          style="font-size: 0.6rem; line-height: 1.2;">
                        {item.salesInfo}
                      </div>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="mb-2">
                      <div class="text-sm font-semibold text-gray-800 mb-1 leading-tight">
                        {item.itemName}
                      </div>
                    </div>
                    <div class="flex justify-between items-center flex-wrap gap-2">
                      <div class="font-mono text-sm font-bold">
                        {#if item.qrCode}
                          <a href="{item.qrCode}" target="_blank" class="hover:text-blue-600 hover:underline cursor-pointer {item.hygb === '1' ? 'text-green-700' : 'text-blue-700'}">
                            {item.itemCode}
                          </a>
                        {:else}
                          <span class="cursor-default text-gray-800">
                            {item.itemCode}
                          </span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-2.5 flex-shrink-0">
                        <span class="text-sm font-semibold text-gray-700">{item.qty}개</span>
                        <span class="text-sm font-bold text-red-600 text-right min-w-16">{formatNumber(item.totalAmount)}원</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else if searchSubmitted && salesGroups.length === 0}
      <div class="text-center py-12 text-gray-600 text-lg bg-white rounded-lg mx-1 shadow-sm">
        검색 결과가 없습니다.
      </div>
    {/if}
  </main>
</div>

<!-- 🔄 ImageModalStock 컴포넌트 추가 -->
<ImageModalStock 
  {user}
  on:stockUpdated={handleStockUpdated}
  on:discontinuedUpdated={handleDiscontinuedUpdated}  
  on:stockUsageUpdated={handleStockUsageUpdated}
  on:onlineUpdated={handleOnlineUpdated}
  on:cashStatusUpdated={handleCashStatusUpdated}
/>