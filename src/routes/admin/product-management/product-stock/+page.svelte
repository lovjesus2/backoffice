<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  import { openImageModal, getProxyImageUrl } from '$lib/utils/imageModalUtils';
  import BarcodeModal from '$lib/components/BarcodeModal.svelte';

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
  let barcodeModal; // ref로 사용
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
  
  // 재고 조정
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
      
      if (result.success) {
        products = products.map(p => 
          p.code === productCode 
            ? { ...p, stock: result.new_stock }
            : p
        );
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
      const response = await fetch('/api/product-management/product-stock/discontinue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        products = products.map(p => 
          p.code === productCode 
            ? { ...p, discontinued: result.action === 'discontinued' }
            : p
        );
        alert(result.message);
      } else {
        alert(result.message || '처리 실패');
      }
    } catch (err) {
      console.error('단종 처리 오류:', err);
      alert('처리 중 오류가 발생했습니다.');
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
    if (barcodeModal) {
      barcodeModal.directPrint(quantity);
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
          <div class="relative bg-white rounded-lg border border-gray-200 overflow-hidden" style="padding: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); {product.discontinued ? 'opacity: 0.6; background-color: #f8f8f8;' : ''}">
            <!-- 이미지 및 기본 정보 -->
            <div class="flex" style="gap: 0.8rem;">
              <!-- 상품 이미지 -->
              <div class="flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden" style="width: 80px; height: 80px;">
                <img 
                  src={getProxyImageUrl(product.code)} 
                  alt={product.name}
                  class="w-full h-full object-cover cursor-pointer"
                  on:click={() => openImageModal(getProxyImageUrl(product.code), product.name)}
                  on:load={cacheImage}
                  on:error={(e) => {
                    e.target.src = '/placeholder.png';
                    e.target.style.background = '#f0f0f0';
                  }}
                >
              </div>

              <!-- 상품 정보 -->
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 mb-1" style="font-size: 0.95rem; line-height: 1.3; word-break: break-all;">{product.name}</h3>
                <div class="text-blue-600 font-bold mb-1" style="font-size: 0.9rem;">코드: {product.code}</div>
                <div class="text-gray-600" style="font-size: 0.8rem;">원가: {product.cost ? `${product.cost.toLocaleString()}원` : '0원'}</div>
                <div class="text-gray-700" style="font-size: 0.85rem;">금액: {product.price.toLocaleString()}원</div>
              </div>
            </div>

            <!-- 재고 컨트롤 (오른쪽 위 absolute) -->
            <div class="absolute bg-white border border-gray-300 rounded-lg" style="top: 8px; right: 8px; background: rgba(255, 255, 255, 0.95); padding: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); min-width: 100px;">
              <!-- 현재 재고 표시 -->
              <div class="text-center text-gray-600 mb-1" style="font-size: 11px;">재고: {product.stock}개</div>
              
              <!-- 재고 조정 입력 -->
              <div class="flex items-center" style="gap: 4px;">
                <input 
                  type="number" 
                  class="border border-gray-300 rounded text-center"
                  style="width: 50px; padding: 3px; font-size: 12px;"
                  placeholder="±수량"
                  data-code={product.code}
                  on:keydown={(e) => handleStockInput(e, product.code)}
                >
                <button 
                  type="button"
                  class="bg-green-500 text-white border-0 rounded cursor-pointer hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed"
                  style="padding: 3px 6px; font-size: 11px; min-width: 35px;"
                  disabled={adjustingStock.has(product.code)}
                  on:click={(e) => {
                    const input = e.target.previousElementSibling;
                    adjustStock(product.code, input.value);
                  }}
                >
                  저장
                </button>
              </div>
            </div>

            <!-- 하단 버튼들 -->
            <div class="absolute flex" style="bottom: 6px; right: 6px; gap: 4px;">
              <!-- 🖨️ 바코드 출력 버튼 (수정됨 - 이벤트 핸들러 개선) -->
              <button 
                type="button"
                class="bg-purple-500 text-white border-0 rounded cursor-pointer hover:bg-purple-600 transition-all duration-200"
                style="padding: 0.25rem 0.5rem; font-size: 0.7rem; font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);"
                on:click={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  console.log('버튼 클릭된 제품:', product);
                  printBarcode(product);
                }}
              >
                🖨️ 출력
              </button>
              
              <!-- 단종 처리 버튼 -->
              <button 
                type="button"
                class="border-0 rounded cursor-pointer transition-all duration-200 {product.discontinued ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-400 text-white hover:bg-gray-500'}"
                style="padding: 0.25rem 0.5rem; font-size: 0.7rem; font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);"
                on:click={() => toggleDiscontinued(product.code)}
              >
                {product.discontinued ? '단종 취소' : '단종 처리'}
              </button>
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
<BarcodeModal 
  bind:this={barcodeModal}
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