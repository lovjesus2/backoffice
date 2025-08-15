<!-- src/routes/admin/sales/flea-market/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  
  export let data;
  
  // 프리마켓 데이터 상태
  let saleItems = [];
  let selectedDate = new Date().toISOString().split('T')[0];
  let startDate = new Date().toISOString().split('T')[0];
  let endDate = new Date().toISOString().split('T')[0];
  let sijeAmount = '';
  let loading = false;
  let salesList = [];
  
  // 사이드바 상태 (PC는 열림, 모바일은 닫힘)
  let leftPanelVisible = false; // 기본값은 false
  
  // 화면 크기에 따라 초기값 설정
  onMount(() => {
    if (browser) {
      // PC에서는 기본으로 열기
      if (window.innerWidth >= 1024) {
        leftPanelVisible = true;
      }
      
      // 리사이즈 이벤트로 반응형 처리
      const handleResize = () => {
        if (window.innerWidth >= 1024) {
          leftPanelVisible = true;
        } else {
          leftPanelVisible = false;
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      document.addEventListener('touchstart', handleFirstTouch, { once: true });
      document.addEventListener('click', handleFirstTouch, { once: true });
      
      loadExternalScripts();
      loadInitialData();
      loadSijeAmount();
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  });
  
  // 상품 선택 상태
  let showProductSelector = false;
  let categories = [];
  let selectedCategory = 'ALL';
  let products = [];
  
  // 검색 상태 (원본 기능)
  let showSearchModal = false;
  let searchTerm = '';
  let searchType = 'name';
  let productFilter = 'all';
  let discontinuedFilter = 'normal';
  let searchResults = [];
  let hasSearched = false;
  
  // 바코드 스캔 상태
  let showBarcodeScanner = false;
  let isScanning = false;
  let isPaused = false;
  let scannerStatus = 'QuaggaJS 스캔 준비 완료';
  let flashEnabled = false;
  
  let itemCounter = 0;
  let handleResize; // 리사이즈 핸들러 참조 저장
  
  // 숫자 포맷팅 함수
  function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // iPhone 오디오 컨텍스트 초기화
  let audioContextInitialized = false;
  let audioContext = null;

  function initAudioContext() {
    if (audioContextInitialized || audioContext) return;
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextInitialized = true;
      console.log('오디오 컨텍스트 초기화 완료');
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } catch (error) {
      console.log('오디오 컨텍스트 초기화 실패:', error);
    }
  }

  function handleFirstTouch() {
    initAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('오디오 컨텍스트 resumed');
      });
    }
    provideFeedback('success');
  }

  function provideFeedback(type) {
    console.log('Feedback:', type);
  }

  // 이미지 캐싱
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  onMount(() => {
    if (browser) {
      document.addEventListener('touchstart', handleFirstTouch, { once: true });
      document.addEventListener('click', handleFirstTouch, { once: true });
      
      loadExternalScripts();
      loadInitialData();
      loadSijeAmount();
    }
  });
  
  onDestroy(() => {
    if (browser) {
      if (isScanning) {
        stopScanning();
      }
      document.removeEventListener('touchstart', handleFirstTouch);
      document.removeEventListener('click', handleFirstTouch);
      
      // 스크롤 복원
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  });
  
  async function loadExternalScripts() {
    if (!window.Quagga) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
      script.onload = () => {
        console.log('QuaggaJS 로드 완료');
      };
      document.head.appendChild(script);
    }
  }
  
  async function loadInitialData() {
    try {
      loading = true;
      await loadCategories();
      await loadProducts();
    } catch (error) {
      console.error('초기 데이터 로드 오류:', error);
    } finally {
      loading = false;
    }
  }
  
  async function loadCategories() {
    try {
      const response = await fetch('/api/sales/flea-market?action=get_flea_categories');
      const result = await response.json();
      if (result.success) {
        categories = [{ code: 'ALL', name: '전체' }, ...result.data];
      }
    } catch (error) {
      console.error('카테고리 로드 오류:', error);
    }
  }
  
  async function loadProducts() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_flea_products&category=${selectedCategory}`);
      const result = await response.json();
      if (result.success) {
        products = result.data.map(item => ({
          code: item.PROH_CODE,
          name: item.PROH_NAME,
          price: item.DPRC_SOPR,
          cost: item.DPRC_BAPR,
          category: item.category_name,
          imageUrl: `/proxy-images/${item.PROH_CODE}_1.jpg`
        }));
      }
    } catch (error) {
      console.error('상품 로드 오류:', error);
    }
  }
  
  async function loadSijeAmount() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_sije_amount&date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        sijeAmount = result.amount.toString();
      }
    } catch (error) {
      console.error('시제 금액 로드 오류:', error);
    }
  }

  async function loadSalesList() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_sales_list&startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();
      
      if (result.success) {
        salesList = result.data;
      }
    } catch (error) {
      console.error('매출 목록 로드 오류:', error);
    }
  }

  // 매출 내역 클릭 시 매출 항목으로 불러오기
  async function loadSaleToItems(sale) {
    try {
      // 실제로는 매출 상세 API 호출해서 상품들을 불러옴
      const response = await fetch(`/api/sales/flea-market?action=get_sale_detail&slipNo=${sale.slipNo}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // 기존 매출 항목 클리어
        saleItems = [];
        
        // 매출 상세의 각 상품을 매출 항목에 추가
        result.data.forEach(item => {
          addSaleItem({
            code: item.DNDT_ITEM,
            name: item.itemName,
            price: item.DNDT_TAMT / item.DNDT_QTY1,
            cost: 0,
            image_url: `/proxy-images/${item.DNDT_ITEM}_1.jpg`
          }, item.DNDT_QTY1);
        });
        
        alert(`매출 내역을 불러왔습니다.\n${result.data.length}개 상품이 추가되었습니다.`);
      } else {
        alert('매출 상세를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('매출 상세 로드 오류:', error);
      alert('매출 상세를 불러오는 중 오류가 발생했습니다.');
    }
  }

  async function deleteSale(slipNo) {
    if (!confirm('이 매출을 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(`/api/sales/flea-market?sSlip=${slipNo}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('매출이 삭제되었습니다.');
        provideFeedback('save');
        await loadSalesList();
      } else {
        alert('삭제 실패: ' + result.message);
        provideFeedback('error');
      }
    } catch (error) {
      console.error('매출 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
      provideFeedback('error');
    }
  }

  // 검색 기능
  async function handleSearch() {
    if (!searchTerm.trim()) {
      searchResults = [];
      hasSearched = false;
      return;
    }
    hasSearched = true;
    
    try {
      const searchParams = new URLSearchParams({
        action: 'search_products',
        searchTerm: searchTerm,
        searchType: searchType,
        productFilter: productFilter,
        discontinuedFilter: discontinuedFilter
      });
      
      const response = await fetch(`/api/sales/flea-market?${searchParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        searchResults = result.data.map(product => ({
          ...product,
          imageUrl: `/proxy-images/${product.PROH_CODE}_1.jpg`
        }));
      }
    } catch (error) {
      console.error('상품 검색 오류:', error);
    }
  }
  
  // 바코드 스캔 관련 함수들
  async function startScanning() {
    if (!window.Quagga) {
      alert('바코드 스캐너가 로드되지 않았습니다.');
      return;
    }
    
    showBarcodeScanner = true;
    isScanning = true;
    scannerStatus = '스캔 시작 중...';
    
    console.log('바코드 스캔 시작');
  }

  function stopScanning() {
    isScanning = false;
    showBarcodeScanner = false;
    scannerStatus = 'QuaggaJS 스캔 준비 완료';
    console.log('바코드 스캔 중지');
  }

  function selectProduct(product) {
    const productData = {
      code: product.code,
      name: product.name,
      price: product.price,
      cost: product.cost,
      image_url: product.imageUrl
    };
    
    addSaleItem(productData);
  }

  function addSaleItem(productData, quantity = 1) {
    // 이미 추가된 제품인지 확인
    const existingItem = saleItems.find(item => item.code === productData.code);
    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.totalAmount = existingItem.unitPrice * existingItem.quantity;
      saleItems = [...saleItems];
      provideFeedback('quantity');
      return;
    }
    
    const itemId = ++itemCounter;
    const saleItem = {
      id: itemId,
      code: productData.code,
      name: productData.name,
      price: productData.price,
      cost: productData.cost,
      imageUrl: productData.image_url,
      quantity: quantity,
      unitPrice: productData.price,
      totalAmount: productData.price * quantity,
      isCash: true
    };
    
    saleItems = [saleItem, ...saleItems];
    provideFeedback('success');
  }

  function removeSaleItem(itemId) {
    saleItems = saleItems.filter(item => item.id !== itemId);
  }

  function increaseQuantity(itemId) {
    const item = saleItems.find(item => item.id === itemId);
    if (item) {
      item.quantity += 1;
      item.totalAmount = item.unitPrice * item.quantity;
      saleItems = [...saleItems];
      provideFeedback('quantity');
    }
  }

  function decreaseQuantity(itemId) {
    const item = saleItems.find(item => item.id === itemId);
    if (item && item.quantity > 1) {
      item.quantity -= 1;
      item.totalAmount = item.unitPrice * item.quantity;
      saleItems = [...saleItems];
      provideFeedback('quantity');
    }
  }

  function updateTotalAmount(itemId, totalAmount) {
    const item = saleItems.find(item => item.id === itemId);
    if (item) {
      item.totalAmount = Math.max(0, totalAmount);
      saleItems = [...saleItems];
    }
  }

  function togglePaymentType(itemId) {
    const item = saleItems.find(item => item.id === itemId);
    if (item) {
      item.isCash = !item.isCash;
      saleItems = [...saleItems];
    }
  }

  async function saveSales() {
    if (saleItems.length === 0) {
      alert('저장할 매출 항목이 없습니다.');
      return;
    }
    
    try {
      loading = true;
      
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'save_sales',
          date: selectedDate,
          sijeAmount: parseInt(sijeAmount) || 0,
          items: saleItems.map(item => ({
            code: item.code,
            quantity: item.quantity,
            price: item.unitPrice,
            totalAmount: item.totalAmount,
            isCash: item.isCash
          }))
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('매출이 저장되었습니다.');
        saleItems = [];
        provideFeedback('save');
        await loadSalesList();
      } else {
        alert('저장 실패: ' + result.message);
        provideFeedback('error');
      }
      
    } catch (error) {
      console.error('매출 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
      provideFeedback('error');
    } finally {
      loading = false;
    }
  }

  function openProductSelector() {
    showProductSelector = true;
    // 뒤쪽 스크롤 방지
    if (browser) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }
  }

  function closeProductSelector() {
    showProductSelector = false;
    // 스크롤 복원
    if (browser) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }

  function openSearchModal() {
    showSearchModal = true;
    // 검색 상태 초기화
    searchTerm = '';
    searchResults = [];
    hasSearched = false;
    // 뒤쪽 스크롤 방지
    if (browser) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }
  }

  function closeSearchModal() {
    showSearchModal = false;
    // 스크롤 복원
    if (browser) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }

  // 반응형 변수
  $: totalQuantity = saleItems.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
  $: totalAmount = saleItems.reduce((sum, item) => sum + parseInt(item.totalAmount || 0), 0);
  $: cashAmount = saleItems.filter(item => item.isCash).reduce((sum, item) => sum + parseInt(item.totalAmount || 0), 0);
  $: cardAmount = saleItems.filter(item => !item.isCash).reduce((sum, item) => sum + parseInt(item.totalAmount || 0), 0);
  
  // 카테고리 변경 시 상품 재로드
  $: if (selectedCategory) {
    loadProducts();
  }
  
  // 모바일에서 사이드바 열릴 때 스크롤 방지
  $: if (browser && window.innerWidth < 1024) {
    if (leftPanelVisible) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }
</script>

<!-- 프리마켓 페이지 - Tailwind CSS 기반 -->
<div class="min-h-screen bg-gray-100 relative" style="font-family: 'Malgun Gothic', Arial, sans-serif;">
  
  <!-- 모바일 오버레이 -->
  {#if leftPanelVisible}
    <div class="fixed inset-0 bg-black bg-opacity-50 z-[105] lg:hidden" on:click={() => leftPanelVisible = false}></div>
  {/if}
  
  <!-- 메인 콘텐츠 -->
  <div class="flex flex-col min-h-screen">
    <!-- 헤더 -->
    <div class="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-10 mb-2.5 lg:ml-2.5">
      <div class="px-2 py-4 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <!-- 햄버거 버튼 -->
          <button 
            class="flex flex-col justify-center items-center w-9 h-9 bg-none border border-gray-300 rounded cursor-pointer p-2 transition-all duration-300 hover:bg-gray-50 hover:border-gray-400"
            on:click={() => leftPanelVisible = !leftPanelVisible}
          >
            <span class="block w-5 h-0.5 bg-gray-600 rounded-sm transition-all duration-300 mb-1"></span>
            <span class="block w-5 h-0.5 bg-gray-600 rounded-sm transition-all duration-300 mb-1"></span>
            <span class="block w-5 h-0.5 bg-gray-600 rounded-sm transition-all duration-300"></span>
          </button>
          <h1 class="text-xl font-semibold text-gray-800 m-0">프리마켓</h1>
        </div>
        <div class="flex items-center gap-2">
          <input 
            type="date" 
            bind:value={selectedDate} 
            class="px-2 py-2 border border-gray-300 rounded-md text-sm"
          >
          <button 
            class="bg-blue-500 text-white border-0 px-4 py-2 rounded-md cursor-pointer font-medium transition-colors duration-200 hover:bg-blue-600"
            on:click={() => showProductSelector = !showProductSelector}
          >
            상품선택
          </button>
          <button 
            class="bg-orange-500 text-white border-0 px-4 py-2 rounded-md cursor-pointer font-medium transition-colors duration-200 hover:bg-orange-600"
            on:click={() => showSijeModal = true}
          >
            시제
          </button>
        </div>
      </div>
    </div>

    <!-- 컨텐츠 레이아웃 (flex 구조) -->
    <div class="flex flex-1 w-full relative">
      <!-- 왼쪽 패널: 매출 조회 (모바일에서 백오피스 헤더 바로 아래) -->
      <div class="bg-transparent transition-all duration-300 overflow-hidden z-30 lg:ml-2.5
                  {leftPanelVisible ? 'flex-none w-80 opacity-100' : 'flex-none w-0 opacity-0'}
                  max-lg:fixed max-lg:left-0 max-lg:bg-white max-lg:shadow-lg max-lg:z-[110]
                  {leftPanelVisible && 'max-lg:transform-none'} max-lg:transform max-lg:-translate-x-full"
           style="top: calc(env(safe-area-inset-top, 0px) + 70px); height: calc(100vh - env(safe-area-inset-top, 0px) - 70px);">
        
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-5">
          <div class="px-5 py-4 border-b border-gray-200 flex justify-between items-center relative">
            <h2 class="text-lg font-semibold text-gray-800 m-0">📊 매출 조회</h2>
            <!-- 모바일에서만 닫기 버튼 표시 -->
            <button 
              class="absolute top-4 right-4 bg-red-500 text-white border-none rounded-full w-6 h-6 cursor-pointer flex items-center justify-center text-lg transition-all duration-200 z-10 lg:hidden
                     hover:bg-red-600 hover:scale-110"
              on:click={() => leftPanelVisible = false}
            >
              ×
            </button>
          </div>
          
          <!-- 날짜 필터 -->
          <div class="px-5 py-4">
            <div class="mb-4">
              <label class="block mb-2 text-sm font-medium text-gray-600">조회 기간:</label>
              <input 
                type="date" 
                bind:value={startDate}
                class="w-36 p-2 mb-2 border border-gray-300 rounded-md text-sm"
              >
              <input 
                type="date" 
                bind:value={endDate}
                class="w-36 p-2 mb-2 border border-gray-300 rounded-md text-sm"
              >
              <button 
                on:click={loadSalesList} 
                class="bg-blue-500 text-white border-0 px-4 py-2 rounded-md cursor-pointer font-medium transition-colors duration-200 hover:bg-blue-600"
              >
                조회
              </button>
            </div>
            
            <!-- 매출 목록 -->
            <div class="max-h-96 overflow-y-auto">
              {#if salesList.length === 0}
                <div class="text-center py-8 text-gray-500 text-sm">
                  조회된 매출 데이터가 없습니다.
                </div>
              {:else}
                {#each salesList as sale}
                  <div 
                    class="mb-2.5 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-blue-500 shadow-sm"
                    on:click={() => loadSaleToItems(sale)}
                  >
                    <div class="font-bold text-blue-600 text-sm mb-1">
                      {sale.date} {sale.regTime}
                    </div>
                    <div class="text-sm text-gray-800 leading-relaxed">
                      전표: {sale.slipNo} | 수량: {sale.qty}개 | 금액: {formatNumber(sale.amount)}원
                      {#if sale.rand}
                        <br>RAND: {sale.rand}
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- 오른쪽 패널: 메인 콘텐츠 -->
      <div class="flex-1 min-w-0 px-2">
        <!-- 바코드 스캐너 섹션 -->
        <div class="mb-4">
          <div class="bg-white p-2 px-4 text-blue-600 text-sm border-b border-gray-200 font-medium flex justify-between items-center min-h-10">
            <div class="flex-1 text-sm font-medium text-blue-600 mb-2 text-center">
              {scannerStatus}
            </div>
            <div class="flex gap-2 justify-center items-center">
              {#if !isScanning}
                <button 
                  class="px-4 py-2 border-0 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 min-w-15 text-white shadow-sm bg-gradient-to-r from-green-500 to-green-400"
                  style="box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);"
                  on:click={startScanning}
                >
                  스캔
                </button>
              {:else}
                <button 
                  class="px-4 py-2 border-0 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 min-w-15 text-white shadow-sm bg-gradient-to-r from-red-500 to-red-400"
                  style="box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);"
                  on:click={stopScanning}
                >
                  중지
                </button>
              {/if}
            </div>
          </div>
          
          {#if showBarcodeScanner}
            <div class="relative w-full h-36 bg-black rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg">
              <div id="reader" class="w-full h-full border-0 bg-transparent"></div>
              <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-20 border-4 border-green-500 rounded-lg pointer-events-none" 
                   style="box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);"></div>
            </div>
          {/if}
        </div>

        <!-- 상품 선택 섹션 -->
        {#if showProductSelector}
          <div class="bg-white rounded-xl overflow-hidden mb-4 shadow-xl border border-gray-200 z-10">
            
            <!-- 선택기 헤더 -->
            <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center font-semibold text-gray-700">
              <h3 class="m-0">상품 선택</h3>
              <button 
                class="text-gray-500 hover:text-gray-700 text-xl bg-transparent border-0 cursor-pointer"
                on:click={closeProductSelector}
              >
                ×
              </button>
            </div>
            
            <!-- 카테고리 탭 -->
            <div class="p-4 border-b border-gray-200">
              <div class="flex flex-wrap gap-2">
                {#each categories as category}
                  <button 
                    class="px-3 py-1 border border-gray-300 rounded cursor-pointer text-sm transition-colors duration-200 
                           {selectedCategory === category.code ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 hover:bg-gray-100'}"
                    on:click={() => selectedCategory = category.code}
                  >
                    {category.name}
                  </button>
                {/each}
              </div>
            </div>
            
            <!-- 상품 그리드 -->
            <div class="overflow-y-auto p-4 max-h-80">
              {#if products.length === 0}
                <div class="text-center py-8 text-gray-500">
                  상품이 없습니다.
                </div>
              {:else}
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {#each products as product}
                    <div 
                      class="border border-gray-200 rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300"
                      on:click={() => selectProduct(product)}
                    >
                      <!-- 상품 이미지 -->
                      <div class="w-full h-20 bg-gray-100 rounded-md flex items-center justify-center mb-2 overflow-hidden">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          class="max-w-full max-h-full object-contain"
                          on:load={cacheImage}
                          on:error={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        >
                        <div class="text-xs text-gray-600 text-center leading-tight hidden">
                          이미지<br>없음
                        </div>
                      </div>
                      
                      <!-- 상품 코드 -->
                      <div class="text-xs text-blue-600 font-semibold mb-1 break-words">
                        {product.code}
                      </div>
                      <!-- 상품명 -->
                      <div class="text-sm font-medium text-gray-800 leading-tight mb-1 min-h-12 overflow-hidden line-clamp-2">
                        {product.name}
                      </div>
                      <!-- 가격 -->
                      <div class="text-sm font-bold text-green-600">
                        {formatNumber(product.price)}원
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- 합계 정보 -->
        {#if saleItems.length > 0}
          <div class="relative my-4 bg-gray-50 border border-blue-600 rounded-md p-2 z-1">
            <div class="flex justify-around gap-4 text-center mb-1">
              <div class="flex items-center gap-1">
                <div class="text-xs text-gray-600">📊 총 수량:</div>
                <div class="text-sm font-bold text-blue-600">{totalQuantity}</div>
              </div>
              <div class="flex items-center gap-1">
                <div class="text-xs text-gray-600">💰 총 금액:</div>
                <div class="text-sm font-bold text-blue-600">{formatNumber(totalAmount)}원</div>
              </div>
            </div>
            <div class="flex justify-around gap-4 text-center">
              <div class="flex items-center gap-1">
                <div class="text-xs text-gray-600">💵 현금:</div>
                <div class="text-sm font-bold text-blue-600">{formatNumber(cashAmount)}원</div>
              </div>
              <div class="flex items-center gap-1">
                <div class="text-xs text-gray-600">💳 카드:</div>
                <div class="text-sm font-bold text-blue-600">{formatNumber(cardAmount)}원</div>
              </div>
            </div>
          </div>
        {/if}

        <!-- 매출 항목 섹션 -->
        <div class="bg-white rounded-xl overflow-hidden mb-4 shadow-md">
          <!-- 섹션 헤더 -->
          <div class="px-4 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center font-semibold text-gray-700">
            <span>매출 항목 ({totalQuantity}개 - {formatNumber(totalAmount)}원)</span>
            <div class="flex gap-2 items-center">
              <!-- 검색 버튼 -->
              <button 
                class="bg-blue-500 text-white border-0 px-4 py-2 rounded-md cursor-pointer font-medium transition-colors duration-200 hover:bg-blue-600"
                on:click={openSearchModal}
              >
                검색
              </button>
              <!-- 저장 버튼 -->
              <button 
                class="bg-green-500 text-white border-0 px-4 py-2 rounded-md cursor-pointer font-medium transition-colors duration-200 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                on:click={saveSales}
                disabled={loading || saleItems.length === 0}
              >
                {loading ? '저장중...' : '저장'}
              </button>
            </div>
          </div>
          
          <!-- 매출 항목들 -->
          <div class="max-h-96 overflow-y-auto p-2">
            {#if saleItems.length === 0}
              <div class="text-center py-8 text-gray-600 text-sm">
                바코드를 스캔하거나 상품을 선택하여 제품을 추가하세요
              </div>
            {:else}
              {#each saleItems as item (item.id)}
                <!-- 매출 항목 행 -->
                <div class="flex flex-col mb-2 border border-gray-300 rounded-lg overflow-hidden bg-white relative transition-all duration-200 w-full 
                           {item.isCash ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'} shadow-sm"
                     style="background: {item.isCash ? 'linear-gradient(90deg, rgba(76, 175, 80, 0.05), white 20%)' : 'linear-gradient(90deg, rgba(33, 150, 243, 0.05), white 20%)'};">
                  
                  <!-- 상품 정보 상단 -->
                  <div class="flex items-center gap-3 border-b border-gray-100 p-3">
                    <!-- 상품 이미지 -->
                    <div class="flex-none w-20 h-20 flex items-center justify-center bg-gray-50 rounded-md border border-gray-200">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        class="object-contain max-w-90% max-h-90%"
                        on:load={cacheImage}
                        on:error={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      >
                      <div class="text-xs text-gray-600 text-center leading-tight hidden">
                        이미지<br>없음
                      </div>
                    </div>
                    
                    <!-- 상품 상세 정보 -->
                    <div class="flex-1 flex flex-col gap-1 min-w-0">
                      <div class="font-bold text-base text-blue-600 break-words">
                        {item.code}
                      </div>
                      <div class="text-lg font-bold text-gray-800 break-words leading-tight">
                        {item.name}
                      </div>
                    </div>
                    
                    <!-- 제거 버튼 -->
                    <button 
                      class="bg-red-500 text-white border-0 w-8 h-8 rounded-full cursor-pointer font-bold flex items-center justify-center transition-all duration-200 hover:bg-red-600 hover:scale-110 flex-shrink-0 text-xl"
                      on:click={() => removeSaleItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                  
                  <!-- 수량/금액 컨트롤 -->
                  <div class="flex gap-1 items-center justify-between flex-wrap p-1 bg-gray-50 rounded-md border border-gray-200 text-xs">
                    <!-- 수량 컨트롤 -->
                    <div class="flex items-center gap-1">
                      <button 
                        class="w-6 h-6 bg-red-500 text-white border-0 rounded cursor-pointer text-xs font-bold flex items-center justify-center transition-colors duration-200 hover:bg-red-600"
                        on:click={() => decreaseQuantity(item.id)}
                      >
                        -
                      </button>
                      <span class="text-xs font-bold text-gray-800 min-w-6 text-center py-1 px-1 bg-gray-100 border border-gray-300 rounded">
                        {item.quantity}
                      </span>
                      <button 
                        class="w-6 h-6 bg-blue-500 text-white border-0 rounded cursor-pointer text-xs font-bold flex items-center justify-center transition-colors duration-200 hover:bg-blue-600"
                        on:click={() => increaseQuantity(item.id)}
                      >
                        +
                      </button>
                    </div>
                    
                    <!-- 가격 정보 -->
                    <div class="flex items-center gap-1 flex-1">
                      <span class="text-gray-600 whitespace-nowrap text-xs">단가:</span>
                      <span class="font-bold text-green-500 text-xs">{formatNumber(item.unitPrice)}원</span>
                    </div>
                    
                    <!-- 총액 입력 -->
                    <div class="flex items-center gap-1 flex-1">
                      <span class="text-gray-600 whitespace-nowrap text-xs">총액:</span>
                      <input 
                        type="text" 
                        class="w-16 p-1 border border-gray-300 rounded text-center text-xs h-6"
                        value={formatNumber(item.totalAmount)}
                        on:input={(e) => {
                          const value = parseInt(e.target.value.replace(/,/g, '')) || 0;
                          updateTotalAmount(item.id, value);
                        }}
                      >
                    </div>
                    
                    <!-- 결제 방법 토글 -->
                    <button 
                      class="border-0 rounded-xl font-bold cursor-pointer transition-all duration-200 whitespace-nowrap px-2 py-1 text-xs min-w-9 h-6 text-white
                             {item.isCash ? 'bg-green-500' : 'bg-blue-500'}"
                      on:click={() => togglePaymentType(item.id)}
                    >
                      {item.isCash ? '현금' : '카드'}
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 검색 모달 -->
  {#if showSearchModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl w-11/12 max-w-md overflow-hidden shadow-2xl">
        <div class="p-4 bg-blue-600 text-white flex justify-between items-center">
          <h3 class="m-0 text-lg font-semibold">상품 검색</h3>
          <button 
            class="text-white hover:text-gray-200 text-xl bg-transparent border-0 cursor-pointer"
            on:click={closeSearchModal}
          >
            ×
          </button>
        </div>
        
        <div class="p-4">
          <!-- 검색 타입 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">검색 타입:</label>
            <select bind:value={searchType} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="name">상품명</option>
              <option value="code">상품코드</option>
            </select>
          </div>
          
          <!-- 상품 필터 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">상품 필터:</label>
            <select bind:value={productFilter} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="all">전체</option>
              <option value="flea">FLEA 상품만</option>
              <option value="non_flea">비 FLEA 상품만</option>
            </select>
          </div>
          
          <!-- 검색어 입력 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">검색어:</label>
            <input 
              type="text" 
              bind:value={searchTerm}
              placeholder="검색어를 입력하세요"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
          </div>
          
          <!-- 검색 버튼 -->
          <button 
            on:click={handleSearch}
            class="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors duration-200"
          >
            검색
          </button>
        </div>
        
        <!-- 검색 결과 -->
        {#if hasSearched}
          <div class="border-t border-gray-200 max-h-48 overflow-y-auto">
            {#if searchResults.length === 0}
              <div class="p-4 text-center text-gray-500">
                검색 결과가 없습니다.
              </div>
            {:else}
              {#each searchResults as result}
                <div 
                  class="p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                  on:click={() => {
                    addSaleItem({
                      code: result.PROH_CODE,
                      name: result.PROH_NAME,
                      price: result.DPRC_SOPR,
                      cost: result.DPRC_BAPR,
                      image_url: `/proxy-images/${result.PROH_CODE}_1.jpg`
                    });
                    closeSearchModal();
                  }}
                >
                  <!-- 검색 결과 이미지 -->
                  <div class="flex-none w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                    <img 
                      src={`/proxy-images/${result.PROH_CODE}_1.jpg`} 
                      alt={result.PROH_NAME}
                      class="max-w-full max-h-full object-contain"
                      on:load={cacheImage}
                      on:error={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    >
                    <div class="text-xs text-gray-400 text-center leading-tight hidden">
                      이미지<br>없음
                    </div>
                  </div>
                  
                  <!-- 검색 결과 정보 -->
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-blue-600 text-sm">{result.PROH_CODE}</div>
                    <div class="text-sm text-gray-800 truncate">{result.PROH_NAME}</div>
                    <div class="text-sm text-green-600">{formatNumber(result.DPRC_SOPR)}원</div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>