<!-- src/routes/admin/product-management/product-stock/+page.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  import { openImageModal, getProxyImageUrl } from '$lib/utils/imageModalUtils';
  import DirectPrint from '$lib/components/DirectPrint.svelte';

  // 상태 관리
  let searchTerm = '';
  let searchType = 'name';
  let discontinuedFilter = 'normal';
  let products = [];
  let loading = false;
  let error = '';
  let adjustingStock = new Set();
  let authenticated = false;
  
  // 바코드 출력 관련 상태 (변경됨)
  let directPrint; // ref로 사용
  let selectedProduct = null;
  let shouldAutoPrint = false;
  
  // ESC 키로 검색, Enter 키로 검색
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }
  
  // 인증 체크
  onMount(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        authenticated = true;
        setTimeout(() => {
          const searchInput = document.querySelector('#searchInput');
          if (searchInput) searchInput.focus();
        }, 100);
      } else {
        goto('/');
      }
    } catch (err) {
      goto('/');
    }
  });
  
  // 이미지 캐싱
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  // 이미지 클릭 핸들러 (누락된 함수)
  function handleImageClick(productCode, productName) {
    const imageSrc = getProxyImageUrl(productCode);
    if (imageSrc) {
      openImageModal(imageSrc, productName, productCode);
    }
  }

  // 검색 실행
  async function handleSearch() {
    if (!authenticated) return;
    
    if (!searchTerm.trim()) {
      error = '검색어를 입력해주세요.';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const params = new URLSearchParams({
        search_term: searchTerm,
        search_type: searchType,
        discontinued_filter: discontinuedFilter
      });
      
      const response = await fetch(`/api/product-management/product-stock/search?${params}`);
      const result = await response.json();
      
      if (result.success) {
        products = result.data;
        if (products.length === 0) {
          error = '검색 결과가 없습니다.';
        }
      } else {
        error = result.message || '검색 실패';
        products = [];
      }
    } catch (err) {
      error = '네트워크 오류가 발생했습니다.';
      products = [];
    } finally {
      loading = false;
    }
  }
  
  // 재고 조정 (수정된 버전)
  async function adjustStock(productCode, quantity) {
    if (!authenticated) return;
    
    const qty = parseInt(quantity);
    if (!qty || qty === 0) {
      alert('수량을 입력해주세요.');
      return;
    }
    
    adjustingStock.add(productCode);
    adjustingStock = adjustingStock;
    
    try {
      const response = await fetch('/api/product-management/product-stock/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode,
          quantity: qty
        })
      });
      
      const result = await response.json();
      console.log('재고 조정 API 응답:', result); // 디버깅용
      
      if (result.success) {
        // ✅ 강제 반응성 트리거를 위한 방법들
        
        // 방법 1: 배열 재할당 (가장 확실한 방법)
        const updatedProducts = products.map(p => 
          p.code === productCode 
            ? { 
                ...p, 
                stock: result.new_stock,
                stockManaged: true  // 재고 조정 시 자동으로 재고관리 활성화
              }
            : p
        );
        products = updatedProducts;
        
        // 방법 2: 추가 반응성 트리거 (선택사항)
        // products = [...products];
        
        console.log('업데이트된 products:', products); // 디버깅용
        
        alert(result.message);
        
        // 입력 필드 초기화
        const input = document.querySelector(`input[data-code="${productCode}"]`);
        if (input) input.value = '';
        
      } else {
        alert(result.message || '재고 조정 실패');
      }
    } catch (err) {
      console.error('재고 조정 오류:', err);
      alert('재고 조정 중 오류가 발생했습니다.');
    } finally {
      adjustingStock.delete(productCode);
      adjustingStock = adjustingStock;
    }
  }
  
  // 단종 처리
  async function toggleDiscontinued(productCode) {
    if (!authenticated) return;
    
    try {
      console.log('단종 토글 시작, 제품코드:', productCode);
      
      const response = await fetch('/api/product-management/product-stock/toggle-attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode, 
          attribute_code: 'L5'  // 단종
        })
      });
      
      const result = await response.json();
      console.log('API 응답:', result);
      
      if (result.success) {
        const isDiscontinued = result.new_status === '1';
        console.log('새로운 단종 상태:', isDiscontinued);
        
        // ✅ products 배열 업데이트 (제품검색&재고관리 페이지용)
        products = products.map(p => 
          p.code === productCode 
            ? { ...p, discontinued: isDiscontinued }
            : p
        );
        
        console.log('업데이트된 products 배열');
        
        showToast(result.message, 'success');
        
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      console.error('단종 처리 오류:', err);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  }
  
  // ✅ 온라인 처리 함수 추가
  async function toggleOnline(productCode) {
    if (!authenticated) return;
    
    try {
      console.log('온라인 토글 시작, 제품코드:', productCode);
      
      const response = await fetch('/api/product-management/product-stock/toggle-attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode, 
          attribute_code: 'L7'  // 온라인
        })
      });
      
      const result = await response.json();
      console.log('API 응답:', result);
      
      if (result.success) {
        const isOnline = result.new_status === '1';
        console.log('새로운 온라인 상태:', isOnline);
        
        // products 배열 업데이트
        products = products.map(p => 
          p.code === productCode 
            ? { ...p, isOnline: isOnline }
            : p
        );
        
        console.log('업데이트된 products 배열');
        
        showToast(result.message, 'success');
        
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      console.error('온라인 처리 오류:', err);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  }

  // ✅ 재고사용 토글 함수 수정 (stockManaged로 변경)
  async function toggleStockUsage(productCode) {
    if (!authenticated) return;
    
    try {
      console.log('재고사용 토글 시작, 제품코드:', productCode);
      
      const response = await fetch('/api/product-management/product-stock/toggle-attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode, 
          attribute_code: 'L6'  // 재고사용
        })
      });
      
      const result = await response.json();
      console.log('API 응답:', result);
      
      if (result.success) {
        const isStockUsage = result.new_status === '1';
        console.log('새로운 재고사용 상태:', isStockUsage);
        
        // ✅ products 배열 업데이트 (stockManaged로 변경)
        products = products.map(p => 
          p.code === productCode 
            ? { ...p, stockManaged: isStockUsage }
            : p
        );
        
        console.log('업데이트된 products 배열');
        
        showToast(result.message, 'success');
        
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      console.error('재고사용 처리 오류:', err);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  }
  
  // 바코드 출력 (수정됨 - 수량 없으면 기본 1장 출력)
  async function printBarcode(product) {
    console.log('출력 요청된 제품:', product);
    
    // 해당 제품의 재고 조정 입력 필드에서 수량 가져오기
    const input = document.querySelector(`input[data-code="${product.code}"]`);
    let quantity = input ? parseInt(input.value) : 0;
    
    // 0보다 작거나 같으면 기본 1장으로 설정
    if (!quantity || quantity <= 0) {
      quantity = 1;
    }
    
    // 출력 시작 토스트 메시지
    showToast(`🖨️ 바코드 ${quantity}장 출력 중...`, 'info');
    
    // 상태를 명시적으로 업데이트
    selectedProduct = {
      code: product.code,
      name: product.name,
      price: product.price || 0
    };
    
    // Svelte DOM 업데이트 대기
    await tick();
    
    console.log('업데이트된 selectedProduct:', selectedProduct);
    console.log('출력 수량:', quantity);
    
    // 바코드 출력 실행
    if (directPrint) {
      directPrint.directPrint(quantity);
    }
  }

  // QR 코드 출력 함수 추가
  async function printQRCode(product) {
    console.log('QR 코드 출력 시작:', product);
    
    // QR 데이터 생성 (제품의 qrCode 필드 사용하거나 기본 URL)
    const qrData = product.qrCode || `https://brand.akojeju.com`;
    
    // 수량 (기본 1장)
    const quantity = 1;
    
    showToast(`🖨️ QR 코드 ${quantity}장 출력 중...`, 'info');
    
    // selectedProduct 업데이트
    selectedProduct = {
      code: product.code,
      name: product.name,
      price: product.price || 0
    };
    
    await tick();
    
    // QR 출력 실행
    if (directPrint) {
      directPrint.directPrint('qr', qrData, quantity); // ✅ 이렇게 수정
    }
  }
  
  // 바코드 출력 성공 처리
  function handlePrintSuccess(event) {
    console.log('출력 완료:', event.detail.message);
    
    // 기존 출력 중 토스트 제거 후 성공 메시지 표시
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 성공 메시지 표시 (간단한 토스트)
    showToast('✅ 바코드 출력 완료!', 'success');
  }
  
  // 바코드 출력 실패 처리
  function handlePrintError(event) {
    console.error('출력 실패:', event.detail.error);
    
    // 기존 출력 중 토스트 제거 후 실패 메시지 표시
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 실패 메시지 표시
    showToast('❌ 바코드 출력 실패: ' + event.detail.error, 'error');
  }
  
  // 간단한 토스트 메시지 표시
  function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      ${type === 'success' ? 'background: #10b981;' : type === 'error' ? 'background: #ef4444;' : 'background: #3b82f6;'}
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션으로 표시
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  // 엔터키 검색
  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }
  
  // 재고 조정 값 처리
  function handleStockInput(event, productCode) {
    if (event.key === 'Enter') {
      adjustStock(productCode, event.target.value);
    }
  }
  
  // 클리어 버튼
  function clearSearch() {
    searchTerm = '';
    products = [];
    error = '';
    const searchInput = document.querySelector('#searchInput');
    if (searchInput) searchInput.focus();
  }
</script>

<svelte:head>
  <title>재고 관리 - 아코 제주 관리시스템</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

{#if authenticated}
<div class="min-h-screen bg-gray-50">
  <!-- 페이지 타이틀 -->
  <header class="bg-white rounded-lg text-center" style="padding: 15px 5px; margin-bottom: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 class="m-0" style="font-size: 20px; font-weight: 600; color: #333;">제품검색 & 재고관리</h1>
  </header>

  <!-- 메인 컨텐츠 -->
  <main class="p-0">
    <!-- 검색 폼 -->
    <form class="bg-white rounded-lg" style="margin: 0.2rem; padding: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" on:submit|preventDefault={handleSearch}>
      <!-- 단종 구분 -->
      <div style="margin-bottom: 1.2rem;">
        <fieldset class="border-0 p-0 m-0">
          <legend class="border-0 p-0 m-0" style="font-size: 0.9rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">단종 구분:</legend>
          <div class="flex rounded-lg overflow-hidden p-0" style="gap: 1px;">
            <input type="radio" id="normal" name="discontinued" value="normal" bind:group={discontinuedFilter} class="hidden">
            <label for="normal" class="flex-1 text-center cursor-pointer transition-all duration-200 font-medium rounded-md border" style="padding: 0.7rem 1rem; font-size: 0.9rem; margin-right: 4px; {discontinuedFilter === 'normal' ? 'background: #2563eb; color: white; border-color: #2563eb;' : 'background: #f8f9fa; color: #6c757d; border-color: #dee2e6;'}">정상</label>
            
            <input type="radio" id="discontinued" name="discontinued" value="discontinued" bind:group={discontinuedFilter} class="hidden">
            <label for="discontinued" class="flex-1 text-center cursor-pointer transition-all duration-200 font-medium rounded-md border" style="padding: 0.7rem 1rem; font-size: 0.9rem; margin-right: 4px; {discontinuedFilter === 'discontinued' ? 'background: #2563eb; color: white; border-color: #2563eb;' : 'background: #f8f9fa; color: #6c757d; border-color: #dee2e6;'}">단종</label>
            
            <input type="radio" id="all" name="discontinued" value="all" bind:group={discontinuedFilter} class="hidden">
            <label for="all" class="flex-1 text-center cursor-pointer transition-all duration-200 font-medium rounded-md border" style="padding: 0.7rem 1rem; font-size: 0.9rem; margin-right: 0; {discontinuedFilter === 'all' ? 'background: #2563eb; color: white; border-color: #2563eb;' : 'background: #f8f9fa; color: #6c757d; border-color: #dee2e6;'}">전체</label>
          </div>
        </fieldset>
      </div>

      <!-- 검색 필터 + 검색어 + 검색 버튼 -->
      <div class="flex" style="gap: 0.5rem;">
        <select bind:value={searchType} class="border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 bg-white" style="padding: 0.75rem; font-size: 1rem;">
          <option value="name">제품명</option>
          <option value="code">코드</option>
        </select>
        <div class="flex-1">
          <input 
            type="text" 
            id="searchInput"
            class="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" 
            style="padding: 0.75rem; font-size: 1rem;"
            placeholder="검색어를 입력하세요"
            bind:value={searchTerm}
            on:keydown={handleSearchKeydown}
          >
        </div>
        <button type="submit" disabled={loading} class="bg-blue-500 text-white rounded-lg font-medium transition-all duration-200 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap" style="padding: 0.75rem 1.5rem; font-size: 1rem;">
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>
    </form>

    <!-- 에러 메시지 -->
    {#if error}
      <div class="text-center py-4 text-red-600" style="background: #fee; margin: 0.2rem; padding: 1rem; border-radius: 8px; border: 1px solid #fcc;">
        {error}
        <button 
          type="button" 
          class="ml-2 px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          on:click={clearSearch}
        >
          지우기
        </button>
      </div>
    {/if}

    <!-- 검색 결과 -->
    {#if loading}
      <div class="text-center py-12">
        <div class="text-4xl mb-4 animate-spin">🔄</div>
        <p class="text-gray-600">검색 중...</p>
      </div>
    {:else if products.length > 0}
      <div class="grid gap-3" style="margin: 0.2rem; grid-template-columns: 1fr;">
        {#each products as product}
          <div class="relative bg-white rounded-lg border border-gray-200 overflow-hidden" style="margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 2px solid #e5e7eb; {product.discontinued ? 'opacity: 0.6; background-color: #f8f8f8;' : ''}">
          <!-- 상단 영역: 좌우 분할 -->
          <div style="padding: 12px;">
            <div class="flex" style="gap: 0.8rem;">
              <!-- 제품 이미지 (배지 포함) -->
              <div class="relative w-20 h-20 flex-shrink-0">
                <img 
                  src={getProxyImageUrl(product.code)} 
                  alt={product.name}
                  class="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer"
                  style="background: #f8f9fa;"
                  on:click={() => handleImageClick(product.code, product.name)}
                  on:error={cacheImage}
                  on:load={cacheImage}
                >
                
                <!-- 재고 수량 배지 -->
                {#if product.stockManaged}
                  <span class="absolute top-0.5 right-0.5 {product.stock === 0 ? 'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-1 py-0.5 rounded-lg text-xs font-bold min-w-6 text-center">
                    {product.stock || 0}
                  </span>
                {/if}

                <!-- 온라인 배지 -->
                {#if product.isOnline}
                  <span class="absolute top-0.5 left-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-xs rounded-full px-1.5 py-0.5 font-medium">
                    ON
                  </span>
                {/if}
              </div>

              <!-- 제품 정보 -->
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 mb-1" style="font-size: 0.8rem; line-height: 1.3;">{product.name}</h3>
                <div class="text-blue-600 font-bold mb-1" style="font-size: 0.7rem;">코드: {product.code}</div>
                <div class="text-gray-600" style="font-size: 0.65rem;">원가: {product.cost ? product.cost.toLocaleString('ko-KR') : '0'}원</div>
                <div class="text-gray-700" style="font-size: 0.65rem;">금액: {product.price ? product.price.toLocaleString('ko-KR') : '0'}원</div>
              </div>
              <!-- ✅ 좌우 분할선 추가 -->
              <div class="border-l border-gray-300" style="margin: 0 8px;"></div>
              <!-- 오른쪽 영역: 재고관리 (3줄) -->
              <div class="flex flex-col gap-1" style="min-width: 130px;">
                
                <!-- 1줄: 재고 + 수량 입력 -->
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="text-gray-600 text-xs">재고: {product.stock || 0}개</span>
                  <input 
                    type="number" 
                    class="border border-gray-300 rounded text-center w-16 p-1 text-xs"
                    placeholder="±수량"
                    data-code={product.code}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        adjustStock(product.code, e.target.value);
                      }
                    }}
                  >
                </div>
                
                <!-- 2줄: 저장 버튼 -->
                <div class="mb-1">
                  <button 
                    type="button"
                    class="bg-blue-500 text-white border-0 rounded px-2 py-1 text-xs hover:bg-blue-600 disabled:bg-gray-500 w-full"
                    disabled={adjustingStock.has(product.code)}
                    on:click={() => {
                      const input = document.querySelector(`input[data-code="${product.code}"]`);
                      adjustStock(product.code, input?.value || '');
                    }}
                  >
                    💾 저장
                  </button>
                </div>
                
                <!-- 3줄: 바코드 + QR 출력 -->
                <div class="flex gap-1">
                  <button 
                    type="button"
                    class="bg-purple-500 text-white border-0 rounded px-2 py-1 text-xs hover:bg-purple-600 flex-1"
                    on:click={() => printBarcode(product)}
                  >
                    바코드
                  </button>
                  
                  <button 
                    type="button"
                    class="border-0 rounded px-2 py-1 text-xs flex-1 {
                      product.qrCode 
                        ? 'bg-purple-500 text-white hover:bg-purple-600' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }"
                    disabled={!product.qrCode}
                    on:click={() => product.qrCode && printQRCode(product)}
                  >
                    QR코드
                  </button>
                </div>
                
              </div>
            </div>
          </div>
          
          <!-- 구분선 -->
          <hr class="border-t border-gray-300">
          
          <!-- 하단 영역: 상태 버튼들 (왼쪽 이미지 아래부터 시작) -->
          <div style="padding: 8px 12px;">
            <div class="flex gap-1" style="justify-content: flex-start;">
              
              <!-- 정상/단종 버튼 -->
              <button 
                type="button"
                class="border-0 rounded px-3 py-1 text-xs transition-all duration-200 {product.discontinued ? 
                  'bg-gray-500 text-white hover:bg-gray-600' : 
                  'bg-green-500 text-white hover:bg-red-600'}"
                on:click={() => toggleDiscontinued(product.code)}
              >
                {product.discontinued ? '단종(단종)' : '단종(정상)'}
              </button>
              
              <!-- 사용/미사용 버튼 -->
              <button 
                type="button"
                class="border-0 rounded px-3 py-1 text-xs transition-all duration-200 {product.stockManaged ? 
                  'bg-green-500 text-white hover:bg-blue-600' : 
                  'bg-gray-500 text-white hover:bg-gray-500'}"
                on:click={() => toggleStockUsage(product.code)}
              >
                {product.stockManaged ? '재고(사용)' : '재고(미사용)'}
              </button>
              
              <!-- ON/OFF 버튼 -->
              <button 
                type="button"
                class="border-0 rounded px-3 py-1 text-xs transition-all duration-200 {product.isOnline ? 
                  'bg-green-500 text-white hover:bg-blue-600' : 
                  'bg-gray-500 text-white hover:bg-gray-600'}"
                on:click={() => toggleOnline(product.code)}
              >
                {product.isOnline ? '온라인(ON)' : '온라인(OFF)'}
              </button>
            </div>
          </div>
          
        </div>
        {/each}
      </div>
    {:else if !loading && searchTerm}
      <div class="text-center py-12 text-gray-500">
        검색 결과가 없습니다.
      </div>
    {/if}
  </main>
</div>

<!-- 바코드 출력 컴포넌트 (숨겨져 있지만 직접 출력용) -->
<DirectPrint
  bind:this={directPrint}
  bind:productData={selectedProduct}
  on:printSuccess={handlePrintSuccess}
  on:printError={handlePrintError}
/>

{:else}
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <div class="text-4xl mb-4 animate-spin">🔄</div>
      <p class="text-gray-600">인증 확인 중...</p>
    </div>
  </div>
{/if}