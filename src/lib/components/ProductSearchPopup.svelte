<!-- ProductSearchPopup.svelte -->
<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { getLayoutConstants } from '$lib/utils/deviceUtils.js';
  import ImageModalStock from '$lib/components/ImageModalStock.svelte';
  import { openImageModal } from '$lib/utils/imageModalUtils';
  import { simpleCache, getProxyImageUrl} from '$lib/utils/simpleImageCache';
  import { browser } from '$app/environment';
  import DirectPrint from '$lib/components/DirectPrint.svelte';
  

  export let visible = false;
  export let currentCompanyCode = '';
  export let currentRegistrationCode = '';

  // ✅ 추가: 사용자 정보 props
  export let user = null; // { username, role } 형태

  const dispatch = createEventDispatcher();
  
  // 상태 변수들
  let companyList = [];
  let registrationList = [];
  let productTypeList = [];
  let selectedCompany = '';
  let selectedRegistration = '';
  let selectedRegistrationItem = null;
  let selectedProductType = 'ALL';

  let searchInput;
  
  // 검색 관련
  let searchKeyword = '';
  let searchType = 'name';
  let products = [];
  let searchLoading = false;
  let searchError = '';
  let discontinuedFilter = 'normal'; // 단종 초기값을 정상으로 설정 

  // 바코드 관련
  let directPrint;
  let selectedProduct = null;

  // 레이아웃
  let layoutConstants = {};

  $: if (visible && searchInput) {
    tick().then(() => {
      searchInput.focus();
    });
  }

  let isMobile = false;

  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 768;
    }
  }

onMount(() => {
  layoutConstants = getLayoutConstants();
  
  // 모바일 감지 기능 추가
  checkMobile();
  const handleResize = () => checkMobile();
  window.addEventListener('resize', handleResize);
  
  if (currentCompanyCode && currentRegistrationCode) {
    selectedCompany = currentCompanyCode;
    selectedRegistration = currentRegistrationCode;
    loadInitialData();
  } else {
    loadCompanyList();
  }
  
  window.addEventListener('stockUsageUpdated', (e) => handleStockUsageUpdated({ detail: e.detail }));
  window.addEventListener('stockUpdated', (e) => handleStockUpdated({ detail: e.detail }));
  window.addEventListener('discontinuedUpdated', (e) => handleDiscontinuedUpdated({ detail: e.detail }));
  window.addEventListener('onlineUpdated', (e) => handleOnlineUpdated({ detail: e.detail }));
  window.addEventListener('cashStatusUpdated', (e) => handleCashStatusUpdated({ detail: e.detail }));
  window.addEventListener('priceUpdated', (e) => handlePriceUpdated({ detail: e.detail }));

  // cleanup 함수 반환
  return () => {
    window.removeEventListener('resize', handleResize);
  };
});

  // ✅ 추가: 권한 체크 함수들
  function isAdmin() {
    return user?.role === 'admin';
  }
  function canViewCost() {
    return isAdmin(); // admin만 원가 보기 가능
  }

  // 이미지 캐싱 함수
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  // 이미지 클릭 핸들러 (모달 열기)
  function handleImageClick(productCode, productName, productImage) {
    const imageSrc = getProxyImageUrl(productImage);
    if (imageSrc) {
      openImageModal(imageSrc, productName, productCode);
    }
  }

  // 회사구분 목록 조회
  async function loadCompanyList() {
    try {
      const response = await fetch('/api/common-codes/minr?majr_code=A0001');
      const result = await response.json();
      
      if (result.success) {
        companyList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        
        if (companyList.length > 0 && !selectedCompany) {
          selectedCompany = companyList[0].MINR_CODE;
          await handleCompanyChange();
        }
      } else {
        console.error('회사구분 조회 실패:', result.message);
        companyList = [];
      }
    } catch (err) {
      console.error('회사구분 조회 오류:', err);
      companyList = [];
    }
  }

  // 등록구분 목록 조회
  async function loadRegistrationList(companyBigo) {
    try {
      if (!companyBigo) {
        registrationList = [];
        return;
      }
      
      const response = await fetch(`/api/common-codes/minr?majr_code=${companyBigo}`);
      const result = await response.json();
      
      if (result.success) {
        registrationList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        
        if (registrationList.length > 0 && !selectedRegistration) {
          selectedRegistration = registrationList[0].MINR_CODE;
          await handleRegistrationChange();
        }
      } else {
        console.error('등록구분 조회 실패:', result.message);
        registrationList = [];
      }
    } catch (err) {
      console.error('등록구분 조회 오류:', err);
      registrationList = [];
    }
  }

  // 제품구분 목록 조회
  async function loadProductTypeList() {
    try {
      const response = await fetch('/api/common-codes/minr?majr_code=CD001');
      const result = await response.json();
      
      if (result.success) {
        const sortedData = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        productTypeList = [
          { MINR_CODE: 'ALL', MINR_NAME: '전체', MINR_SORT: -1 },
          ...sortedData
        ];
        selectedProductType = 'ALL';
      } else {
        console.error('제품구분 조회 실패:', result.message);
        productTypeList = [];
      }
    } catch (err) {
      console.error('제품구분 조회 오류:', err);
      productTypeList = [];
    }
  }

  // 초기 데이터 로드
  async function loadInitialData() {
    await loadCompanyList();
    if (selectedCompany) {
      const selectedCompanyItem = companyList.find(item => item.MINR_CODE === selectedCompany);
      if (selectedCompanyItem && selectedCompanyItem.MINR_BIGO) {
        await loadRegistrationList(selectedCompanyItem.MINR_BIGO);
        if (selectedRegistration) {
          selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
          if (selectedRegistrationItem?.MINR_NAME === '제품정보') {
            await loadProductTypeList();
          }
        }
      }
    }
  }

  // 회사구분 변경 시
  async function handleCompanyChange() {
    selectedRegistration = '';
    selectedRegistrationItem = null;
    productTypeList = [];
    selectedProductType = 'ALL';
    products = [];
    searchError = '';
    
    if (selectedCompany) {
      const selectedCompanyItem = companyList.find(item => item.MINR_CODE === selectedCompany);
      if (selectedCompanyItem && selectedCompanyItem.MINR_BIGO) {
        await loadRegistrationList(selectedCompanyItem.MINR_BIGO);
      } else {
        registrationList = [];
      }
    } else {
      registrationList = [];
    }
  }

  // 등록구분 변경 시
  async function handleRegistrationChange() {
    selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
    
    if (selectedRegistrationItem?.MINR_NAME === '제품정보') {
      await loadProductTypeList();
    } else {
      productTypeList = [];
      selectedProductType = '';
    }
    
    products = [];
    searchError = '';
  }

  // 검색 실행 (제품등록과 동일한 로직)
  // ✅ 수정된 코드 (올바른 방법)
  // ✅ 수정된 handleSearch 함수
  async function handleSearch() {
    if (!selectedCompany || !selectedRegistration) {
      searchError = '회사구분과 등록구분을 선택해주세요.';
      return;
    }

    searchLoading = true;
    searchError = '';
    products = [];

    try {
      const params = new URLSearchParams({
        search_term: searchKeyword.trim() || '',
        search_type: searchType,
        discontinued_filter: discontinuedFilter,
        company_code: selectedCompany,
        registration_code: selectedRegistration,
        registration_name: selectedRegistrationItem?.MINR_NAME || ''
      });

      if (selectedRegistrationItem?.MINR_NAME === '제품정보' && selectedProductType && selectedProductType !== 'ALL') {
        params.append('product_type', selectedProductType);
      }

      const response = await fetch(`/api/product-management/product-stock/search?${params}`);
      const result = await response.json();

      if (result.success) {
        // ✅ API 응답 데이터를 통일된 구조로 변환
        products = result.data.map(item => ({
          // 코드/이름 (양쪽 필드명 모두 제공)
          code: item.code,
          name: item.name,
          
          // 재고 정보
          stock: item.stock ?? 0,
          stockManaged: item.stockManaged ?? false,
          
          // 가격 정보
          cost: item.cost ?? 0,
          price: item.price ?? 0,
          
          // 상태 정보
          discontinued: item.discontinued ?? false,
          isOnline: item.isOnline ?? false,
          cash_status: item.cash_status ?? false,
          
          // 기타 원본 데이터 유지
          ...item
        }));
        
        console.log('✅ 검색 완료:', products.length, '개');
        if (products.length > 0) {
          console.log('첫 번째 제품:', products[0]);
        }
        
        if (products.length === 0) {
          searchError = '검색 결과가 없습니다.';
        }
      } else {
        searchError = result.message || '검색 중 오류가 발생했습니다.';
        products = [];
      }
    } catch (err) {
      console.error('검색 오류:', err);
      searchError = '검색 중 오류가 발생했습니다.';
      products = [];
    } finally {
      searchLoading = false;
    }
  }

   // ✅ 재고 업데이트 이벤트 처리
  function handleStockUpdated(event) {
    const { productCode, newStock, stockManaged } = event.detail;
    console.log('🔵 팝업: 재고 업데이트됨', { productCode, newStock, stockManaged });
    
    products = products.map(item => 
      item.code === productCode 
        ? { ...item, stock: newStock, stockManaged }
        : item
    );
  }

  // ✅ 단종 상태 업데이트 이벤트 처리
  function handleDiscontinuedUpdated(event) {
    const { productCode, discontinued } = event.detail;
    console.log('🟠 팝업: 단종 상태 업데이트됨', { productCode, discontinued });
    
    products = products.map(item => 
      item.code === productCode 
        ? { ...item, discontinued }
        : item
    );
  }

  // ✅ 재고관리 토글 이벤트 처리
  function handleStockUsageUpdated(event) {
    const { productCode, stockManaged } = event.detail;
    console.log('🟢 팝업: 재고관리 토글됨', { productCode, stockManaged });
    
    products = products.map(item => 
      item.code === productCode 
        ? { ...item, stockManaged }
        : item
    );
  }

  // ✅ 온라인 상태 업데이트 이벤트 처리
  function handleOnlineUpdated(event) {
    const { productCode, isOnline } = event.detail;
    console.log('🟣 팝업: 온라인 상태 업데이트됨', { productCode, isOnline });
    
    products = products.map(item => 
      item.code === productCode 
        ? { ...item, isOnline }
        : item
    );
  }

  // ✅ 현금세팅 상태 업데이트
  function handleCashStatusUpdated(event) {
    const { productCode, cash_status } = event.detail;
    console.log('🟡 팝업: 현금세팅 업데이트됨', { productCode, cash_status });
    
    products = products.map(item => 
      item.code === productCode 
        ? { ...item, cash_status }
        : item
    );
  }

  // 가격 업데이트 핸들러
  function handlePriceUpdated(event) {
    const { productCode, cardPrice, cashPrice, deliveryPrice, cost } = event.detail;
    
    console.log('🔍 검색 팝업: 가격 업데이트됨', event.detail);
    
    // ✅ products 배열 업데이트
    products = products.map(product => 
      product.code === productCode
        ? { 
            ...product,
            cardPrice: cardPrice,      // 카드가 업데이트
            cashPrice: cashPrice,      // 현금가 업데이트
            price: cardPrice,          // 기본 price 필드도 업데이트
            cost: cost                 // 원가도 업데이트
          }
        : product
    );
  }


  // 키보드 이벤트 처리
  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }

  // 제품 선택
  function selectProduct(product) {
    dispatch('productSelected', {
      code: product.code,
      name: product.name,
      companyCode: selectedCompany,
      registrationCode: selectedRegistration,
      registrationName: selectedRegistrationItem?.MINR_NAME || ''
    });
    closePopup();
  }


  function handlePrintSuccess(event) {
    console.log('✅ 출력 성공:', event.detail);
    showToast('✅ 내역서 출력 완료!', 'success');
  }

  function handlePrintError(event) {
    console.error('❌ 출력 실패:', event.detail);
    showToast(`❌ 출력 실패: ${event.detail.error}`, 'error');
  }

  // 바코드 출력
  async function printBarcode(item) {
    console.log('출력 요청된 제품:', item);
    
    // 해당 아이템의 수량 가져오기
    //const quantity = item.quantity || 1;
    const quantity = 1;
    

    // 출력 시작 토스트 메시지
    showToast(`🖨️ 바코드 ${quantity}장 출력 중...`, 'info');
    
    // 바코드 출력용 데이터 구성
    const barcodeData = {
      code: item.code,
      name: item.name,
      price: item.price || 0
    };
    
    // Svelte DOM 업데이트 대기
    await tick();
    
    console.log('바코드 데이터:', barcodeData);
    console.log('출력 수량:', quantity);
    
    // 바코드 출력 실행
    if (directPrint) {
      directPrint.directPrint('barcode', barcodeData, quantity);
    } else {
      console.error('DirectPrint 컴포넌트 참조 없음');
      showToast('❌ 프린터 초기화 오류', 'error');
    }
    
    // 포커스 복귀
    setTimeout(() => {
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 500);
  }

  // 팝업 닫기
  function closePopup() {
    // 초기화
    searchKeyword = '';
    products = [];
    searchError = '';
    discontinuedFilter = 'normal';
    
    // 제품구분이 있으면 초기화
    if (showProductType) {
      selectedProductType = 'ALL';
    }
    dispatch('close');
  }

  // 오버레이 클릭 시 팝업 닫기
  function handleOverlayClick() {
    //closePopup();
  }

  // 제품구분 표시 여부
  $: showProductType = selectedRegistrationItem?.MINR_NAME === '제품정보';
  $: isProductInfo = selectedRegistrationItem?.MINR_NAME === '제품정보';

  // 숫자 포맷팅
  function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
</script>

<!-- 팝업 오버레이 -->
{#if visible}
  <div 
    class="fixed bg-black/50 flex flex-col items-center justify-center transition-opacity duration-200 z-[9999]"
    style="
      {isMobile ? 
        'top: 0; left: 0; right: 0; bottom: 0;' : 
        'top: 0; left: 256px; right: 0; bottom: 0;'
      }
      touch-action: none;
    "
    on:click={handleOverlayClick}
  >
    <!-- 팝업 컨텐츠 -->
    <div 
      class="bg-white rounded-lg mx-4 my-4 flex flex-col md:!max-w-[800px]"
      style="width: 90vw; max-width: 600px; height: 88vh; max-height: 950px;"
      on:click|stopPropagation
    >
      <!-- 팝업 헤더 -->
      <div class="border-b border-gray-200 flex justify-between items-center px-4 py-1 bg-gray-50 rounded-t-lg">
        <!-- 왼쪽: 제목 + 버튼 형태 단종 구분 필터 -->
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-semibold text-gray-800 m-0">제품 조회</h2>
          
          <!-- ✅ 버튼 형태 단종 구분 필터 (작게, 연결된 형태) -->
          <div class="flex rounded overflow-hidden border border-gray-300" style="font-size: 0.65rem;">
            <input type="radio" id="popup-normal" name="popup-discontinued" value="normal" bind:group={discontinuedFilter} class="hidden">
            <label for="popup-normal" class="text-center cursor-pointer transition-all duration-200 font-medium border-r border-gray-300" style="padding: 0.2rem 0.4rem; {discontinuedFilter === 'normal' ? 'background: #2563eb; color: white;' : 'background: #f8f9fa; color: #6c757d;'}">정상</label>
            
            <input type="radio" id="popup-discontinued" name="popup-discontinued" value="discontinued" bind:group={discontinuedFilter} class="hidden">
            <label for="popup-discontinued" class="text-center cursor-pointer transition-all duration-200 font-medium border-r border-gray-300" style="padding: 0.2rem 0.4rem; {discontinuedFilter === 'discontinued' ? 'background: #2563eb; color: white;' : 'background: #f8f9fa; color: #6c757d;'}">단종</label>
            
            <input type="radio" id="popup-all" name="popup-discontinued" value="all" bind:group={discontinuedFilter} class="hidden">
            <label for="popup-all" class="text-center cursor-pointer transition-all duration-200 font-medium" style="padding: 0.2rem 0.4rem; {discontinuedFilter === 'all' ? 'background: #2563eb; color: white;' : 'background: #f8f9fa; color: #6c757d;'}">전체</label>
          </div>
        </div>
        <button 
          type="button"
          class="text-gray-500 hover:text-gray-700 transition-colors"
          on:click={closePopup}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 팝업 본문 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 검색 필터 영역 (제품등록과 완전 동일) -->
        <div class="border-b border-gray-200" style="padding: 15px 20px;">
          <div class="space-y-3">
            <!-- 회사구분 -->
            <div class="flex flex-row items-center gap-2">
              <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">회사구분</label>
              <select 
                bind:value={selectedCompany}
                on:change={handleCompanyChange}
                class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 flex-1"
                style="padding: 5px 8px; font-size: 0.8rem;"
              >
                {#each companyList as company}
                  <option value={company.MINR_CODE}>{company.MINR_NAME}</option>
                {/each}
              </select>
            </div>

            <!-- 등록구분 -->
            <!-- ✅ 등록구분 - 화면에서 숨김 처리 (기능은 유지) -->
            <div class="flex flex-row items-center gap-2 hidden">
              <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">등록구분</label>
              <select 
                bind:value={selectedRegistration}
                on:change={handleRegistrationChange}
                disabled={registrationList.length === 0}
                class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100 flex-1"
                style="padding: 5px 8px; font-size: 0.8rem;"
              >
                {#each registrationList as registration}
                  <option value={registration.MINR_CODE}>{registration.MINR_NAME}</option>
                {/each}
              </select>
            </div>

            <!-- 제품구분 (제품정보일 때만) -->
            {#if showProductType}
              <div class="flex flex-row items-center gap-2">
                <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">제품구분</label>
                <select 
                  bind:value={selectedProductType}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 flex-1"
                  style="padding: 5px 8px; font-size: 0.8rem;"
                >
                  {#each productTypeList as productType}
                    <option value={productType.MINR_CODE}>{productType.MINR_NAME}</option>
                  {/each}
                </select>
              </div>
            {/if}

            <!-- 검색 (제품등록과 완전 동일) -->
            <div class="flex gap-1">
              <select 
                bind:value={searchType}
                class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                style="padding: 5px 6px; font-size: 0.75rem; min-width: 65px;"
              >
                <option value="name">제품명</option>
                <option value="code">코드</option>
              </select>
              <input 
                type="text" 
                placeholder="검색어 입력 (선택사항)..."
                bind:value={searchKeyword}
                bind:this={searchInput}
                class="flex-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                style="padding: 5px 8px; font-size: 0.75rem;"
                on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                on:blur={(e) => e.target.style.boxShadow = 'none'}
                on:keydown={handleSearchKeydown}
                on:click|stopPropagation
              />
              <button 
                class="text-white border-none rounded cursor-pointer transition-colors hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                style="padding: 5px 8px; background-color: #007bff; min-width: 32px;"
                on:click|stopPropagation={handleSearch}
                disabled={searchLoading}
                title={searchLoading ? '검색중' : '조회'}
              >
                {#if searchLoading}
                  <div class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                {:else}
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>
        </div>

        <!-- 검색 결과 목록 (제품등록과 완전 동일) -->
        <div 
          class="flex-1 overflow-y-auto" 
          style="overscroll-behavior: contain;"
        >
          {#if searchError}
            <div class="text-center text-red-600 bg-red-50" style="padding: 30px 15px;">
              {searchError}
            </div>
          {:else if searchLoading}
            <div class="text-center text-gray-600" style="padding: 30px 15px;">
              <div class="mx-auto mb-2.5 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" style="width: 25px; height: 25px;"></div>
              검색 중...
            </div>
          {:else if products.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3" style="padding: 10px;">
              {#each products as product}
                <div 
                  class="relative bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer transition-colors hover:bg-gray-50 {product.discontinued ? 'opacity-60 bg-gray-50' : ''}"
                  style="padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                  on:click|stopPropagation={() => selectProduct(product)}
                >
                  <!-- 이미지 및 기본 정보 -->
                  <div class="flex" style="gap: 12px;">
                    <!-- 상품 이미지 -->
                    <div class="flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden relative" style="width: 80px; height: 80px; min-width: 80px;" class:md:!w-[110px]={!isMobile} class:md:!h-[110px]={!isMobile} class:md:!min-w-[110px]={!isMobile}>
                      <img 
                        src={getProxyImageUrl(product.imagePath)} 
                        alt={product.name}
                        class="w-full h-full object-cover cursor-pointer"
                        on:click|stopPropagation={() => handleImageClick(product.code, product.name, product.imagePath)}
                        on:load={cacheImage}
                        on:error={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNGM0Y0RjYiLz4KICA8cGF0aCBkPSJNNDAgMjBWNjBNMjAgNDBINjAiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+';
                          e.target.style.background = '#f0f0f0';
                        }}
                      />
                      
                      <!-- 온라인 배지 (왼쪽 위) -->
                      {#if product.isOnline}
                        <span class="absolute top-0.5 left-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-xs rounded-full px-1.5 py-0.5 font-medium shadow-sm" 
                        style="font-size: 0.6rem; line-height: 1;">
                          On
                        </span>
                      {/if}
                      
                      <!-- 재고 배지 -->
                      {#if isProductInfo && product.stockManaged}
                        <span class="absolute top-0.5 right-0.5 {product.stock === 0 ? 'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-1 py-0.5 rounded-lg text-xs font-bold min-w-6 text-center" style="font-size: 10px;">
                          {product.stock || 0}
                        </span>
                      {/if}

                      <!-- salesinfo 배지 (하단 전체) -->
                      {#if product.salesInfo}
                        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center px-1 py-0.5" 
                            style="font-size: 0.6rem; line-height: 1.2;">
                          {product.salesInfo}
                        </div>
                      {/if}
                    </div>

                    <!-- 제품 정보 -->
                    <div class="flex-1 min-w-0" style="overflow: hidden;">
                      <div class="flex items-center gap-1 mb-1">
                        <div class="text-xs md:text-[0.65rem] text-gray-600 mb-1 truncate">{product.code}</div>
                        <button 
                          type="button"
                          class="text-[9px] px-1 py-0.5 bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                          on:click={(e) => {
                            e.stopPropagation();
                            printBarcode(product);
                          }}
                          title="바코드 출력"
                        >
                          바코드
                        </button>
                      </div>
                    
                      <div class="text-xs md:text-[0.75rem] font-medium mb-1" style="overflow-wrap: break-word; word-break: break-word;">{product.name}</div>
                      
                      <!-- 가격 정보 (제품정보일 때만) -->
                      {#if isProductInfo}
                        <!-- 원가는 admin 권한에서만 표시 -->
                        {#if canViewCost()}
                          <div class="text-gray-700 text-[0.7rem] md:text-[0.65rem]">원가: {product.cost ? product.cost.toLocaleString('ko-KR') : '0'}원</div>
                        {/if}
                        <div class="text-gray-700 text-[0.7rem] md:text-[0.65rem]">
                          카드: {product.cardPrice ? product.cardPrice.toLocaleString('ko-KR') : (product.price ? product.price.toLocaleString('ko-KR') : '0')}원
                        </div>
                        <div class="text-gray-700 text-[0.7rem] md:text-[0.65rem]">
                          현금: {product.cashPrice ? product.cashPrice.toLocaleString('ko-KR') : '0'}원
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center text-gray-600" style="padding: 30px 15px; font-size: 0.9rem;">
              조회 버튼을 클릭하여 제품을 조회하세요.
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- 이미지 모달 -->
<ImageModalStock 
  {user}
  on:stockUpdated={handleStockUpdated}
  on:discontinuedUpdated={handleDiscontinuedUpdated}
  on:stockUsageUpdated={handleStockUsageUpdated}
  on:onlineUpdated={handleOnlineUpdated}
  on:cashStatusUpdated={handleCashStatusUpdated}
  on:priceUpdated={handlePriceUpdated} 
/>

<!-- 바코드 출력 컴포넌트 (숨겨져 있지만 직접 출력용) -->
<DirectPrint 
  bind:this={directPrint}
  bind:productData={selectedProduct}
  on:printSuccess={handlePrintSuccess}
  on:printError={handlePrintError}
/>

<style>
  /* 검색 결과 스크롤 제어 */
  .overflow-y-auto {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  /* 이미지 로딩 애니메이션 */
  img {
    transition: opacity 0.3s ease-in-out;
  }

  img:not([src]) {
    opacity: 0;
  }
</style>