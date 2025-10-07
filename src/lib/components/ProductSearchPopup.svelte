<!-- ProductSearchPopup.svelte -->
<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { getLayoutConstants } from '$lib/utils/deviceUtils.js';
  import { simpleCache } from '$lib/utils/simpleImageCache.js';
  import { openImageModal, getProxyImageUrl } from '$lib/utils/imageModalUtils.js';

  export let visible = false;
  export let currentCompanyCode = '';
  export let currentRegistrationCode = '';

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

  // 레이아웃
  let layoutConstants = {};

  $: if (visible && searchInput) {
    tick().then(() => {
      searchInput.focus();
    });
  }

  onMount(() => {
    layoutConstants = getLayoutConstants();
    if (currentCompanyCode && currentRegistrationCode) {
      selectedCompany = currentCompanyCode;
      selectedRegistration = currentRegistrationCode;
      loadInitialData();
    } else {
      loadCompanyList();
    }
  });

  // 이미지 캐싱 함수
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  // 이미지 클릭 핸들러 (모달 열기)
  function handleImageClick(productCode, productName) {
    const imageSrc = getProxyImageUrl(productCode);
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

      const response = await fetch(`/api/product-management/product-registration/search?${params}`);
      const result = await response.json();

      if (result.success) {
        // ✅ API가 이미 변환된 형태로 데이터를 반환하므로 직접 사용
        products = result.data;
        
        // 디버깅용 로그
        console.log('API 응답:', result);
        console.log('제품 데이터:', products);
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

  // 팝업 닫기
  function closePopup() {
    dispatch('close');
  }

  // 오버레이 클릭 시 팝업 닫기
  function handleOverlayClick() {
    closePopup();
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
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-16"
    on:click={handleOverlayClick}
    on:keydown
  >
    <!-- 팝업 컨텐츠 -->
    <div 
      class="bg-white rounded-lg mx-4 my-4 flex flex-col"
      style="width: 90vw; max-width: 600px; height: 87vh; max-height: 950px;"
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
                    <div class="flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden relative" style="width: 80px; height: 80px;">
                      <img 
                        src={getProxyImageUrl(product.code)} 
                        alt={product.name}
                        class="w-full h-full object-cover cursor-pointer"
                        on:click|stopPropagation={() => handleImageClick(product.code, product.name)}
                        on:load={cacheImage}
                        on:error={(e) => {
                          e.target.src = '/placeholder.png';
                          e.target.style.background = '#f0f0f0';
                        }}
                      />
                      
                      <!-- 재고 배지 -->
                      {#if isProductInfo && product.stockManaged}
                        <span class="absolute top-0.5 right-0.5 {product.stock === 0 ? 'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-1 py-0.5 rounded-lg text-xs font-bold min-w-6 text-center" style="font-size: 10px;">
                          {product.stock || 0}
                        </span>
                      {/if}
                    </div>

                    <!-- 제품 정보 -->
                    <div class="flex-1 min-w-0">
                      <div class="text-xs text-gray-600 mb-1">{product.code}</div>
                      <div class="text-xs font-medium mb-1">{product.name}</div>
                      
                      <!-- 가격 정보 (제품정보일 때만) -->
                      {#if isProductInfo}
                        <div class="text-gray-700" style="font-size: 0.7rem;">원가: {product.cost ? product.cost.toLocaleString('ko-KR') : '0'}원</div>
                        <div class="text-gray-700" style="font-size: 0.7rem;">금액: {product.price ? product.price.toLocaleString('ko-KR') : '0'}원</div>
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