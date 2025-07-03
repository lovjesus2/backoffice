<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  // 상태 관리
  let searchTerm = '';
  let searchType = 'name';
  let discontinuedFilter = 'normal';
  let products = [];
  let loading = false;
  let error = '';
  let adjustingStock = new Set();
  let authenticated = false;
  
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
      
      const response = await fetch(`/api/sales/sale-stock/search?${params}`);
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
      const response = await fetch('/api/sales/sale-stock/adjust', {
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
        
        const input = document.querySelector(`input[data-code="${productCode}"]`);
        if (input) input.value = '';
        
        alert(`재고가 조정되었습니다. 현재고: ${result.new_stock}개`);
      } else {
        alert(result.message || '재고 조정 실패');
      }
    } catch (err) {
      alert('재고 조정 중 오류가 발생했습니다.');
    } finally {
      adjustingStock.delete(productCode);
      adjustingStock = adjustingStock;
    }
  }
  
  // 단종 처리 토글
  async function toggleDiscontinued(productCode) {
    if (!authenticated) return;
    
    const product = products.find(p => p.code === productCode);
    if (!product) return;
    
    const confirmMsg = product.discontinued 
      ? '단종을 취소하시겠습니까?' 
      : '단종 처리하시겠습니까?';
      
    if (!confirm(confirmMsg)) return;
    
    try {
      const response = await fetch('/api/sales/sale-stock/discontinued', {
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
        // 제품 상태 업데이트
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
  
  // 엔터키 검색
  function handleKeydown(event) {
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
  <title>재고 관리 - 아코제주 관리시스템</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
</svelte:head>

{#if authenticated}
<div class="stock-container">
  <!-- 페이지 타이틀 -->
  <div class="page-title">
    <h1>제품검색 & 재고관리</h1>
  </div>

  <!-- 메인 컨텐츠 -->
  <div class="main-content">
    <!-- 검색 폼 -->
    <form class="search-form" on:submit|preventDefault={handleSearch}>
      <!-- 단종 구분 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>단종 구분:</legend>
          <div class="radio-options">
            <input type="radio" id="normal" name="discontinued" value="normal" bind:group={discontinuedFilter}>
            <label for="normal" class="radio-label">정상</label>
            
            <input type="radio" id="discontinued" name="discontinued" value="discontinued" bind:group={discontinuedFilter}>
            <label for="discontinued" class="radio-label">단종</label>
            
            <input type="radio" id="all" name="discontinued" value="all" bind:group={discontinuedFilter}>
            <label for="all" class="radio-label">전체</label>
          </div>
        </fieldset>
      </div>

      <!-- 검색 필터 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>검색 필터:</legend>
          <div class="radio-options">
            <input type="radio" id="name-search" name="searchType" value="name" bind:group={searchType}>
            <label for="name-search" class="radio-label">제품 검색</label>
            
            <input type="radio" id="code-search" name="searchType" value="code" bind:group={searchType}>
            <label for="code-search" class="radio-label">코드 검색</label>
          </div>
        </fieldset>
      </div>

      <!-- 검색 입력 -->
      <div class="search-input-group">
        <div class="input-container">
          <input 
            type="text" 
            id="searchInput"
            class="search-input" 
            placeholder="검색어를 입력하세요"
            bind:value={searchTerm}
            on:keydown={handleKeydown}
          >
        </div>
        <button type="submit" class="btn-search" disabled={loading}>
          {loading ? '검색중...' : '검색'}
        </button>
      </div>
    </form>

    <!-- 오류 메시지 -->
    {#if error}
      <div class="alert error">
        {error}
      </div>
    {/if}

    <!-- 로딩 -->
    {#if loading}
      <div class="loading-container">
        <div class="loading-content">
          <div class="loading-spinner">🔄</div>
          <p>검색 중...</p>
        </div>
      </div>
    {/if}

    <!-- 검색 결과 -->
    {#if products.length > 0}
      <div class="cards-container">
        {#each products as product}
          <div class="product-card" class:discontinued={product.discontinued}>
            <!-- 제품 이미지 -->
            <div class="product-image">
              <img 
                src="https://image.kungkungne.synology.me/{product.code}_1.jpg"
                alt={product.name}
                class="product-img"
                on:error={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div class="no-image" style="display: none;">
                이미지<br>없음
              </div>
            </div>

            <!-- 제품 정보 -->
            <div class="product-info">
              <div class="product-code">{product.code}</div>
              <div class="product-name">{product.name}</div>
              <div class="product-cost">원가: {product.cost ? `${product.cost.toLocaleString()}원` : '0원'}</div>
              <div class="product-price">금액: {product.price.toLocaleString()}원</div>
            </div>

            <!-- 재고 정보 및 조정 -->
            <div class="stock-info-area">
              <!-- 재고/수량 입력 카드 -->
              <div class="stock-card">
                <!-- 재고 표시 -->
                <div class="stock-display">
                  <div class="stock-label">재고: {product.stock}개</div>
                </div>

                <!-- 재고 조정 컨트롤 -->
                <div class="stock-controls">
                  <div class="stock-adjust-section">
                    <div class="stock-input-group">
                      <input 
                        type="number" 
                        class="stock-quantity"
                        placeholder="±수량"
                        data-code={product.code}
                        on:keydown={(e) => handleStockInput(e, product.code)}
                      >
                      <button 
                        type="button"
                        class="stock-save-btn"
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
                </div>
              </div>

              <!-- 단종 처리 버튼 -->
              <div class="product-actions">
                <button 
                  type="button"
                  class="discontinued-btn"
                  class:active={product.discontinued}
                  on:click={() => toggleDiscontinued(product.code)}
                >
                  {product.discontinued ? '단종 취소' : '단종 처리'}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if !loading && searchTerm}
      <div class="no-results">
        검색 결과가 없습니다.
      </div>
    {/if}
  </div>
</div>
{:else}
  <div class="loading-container">
    <div class="loading-content">
      <div class="loading-spinner">🔄</div>
      <p>인증 확인 중...</p>
    </div>
  </div>
{/if}

<style>
  /* 전역 스타일 */
  * {
    box-sizing: border-box;
  }

  /* 컨테이너 */
  .stock-container {
    min-height: 100vh;
    background: #f8f9fa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* 헤더 타이틀 - 매출조회 캘린더와 동일 */
  .page-title {
    background: white;
    padding: 15px 5px;
    margin-bottom: 5px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    text-align: center;
  }

  .page-title h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }

  /* 메인 컨텐츠 */
  .main-content {
    padding: 0;
  }

  /* 검색 폼 */
  .search-form {
    background: white;
    margin: 0.5rem;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  /* 폼 그룹 */
  .form-group {
    margin-bottom: 1.2rem;
  }

  /* 라디오 그룹 */
  .radio-group {
    border: none;
    padding: 0;
    margin: 0;
  }

  .radio-group legend {
    font-size: 0.9rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 0.5rem;
    padding: 0;
  }

  /* 라디오 옵션 - 배경 없는 분리된 형태 */
  .radio-options {
    display: flex;
    gap: 1px;
    border-radius: 8px;
    overflow: hidden;
    padding: 0;
  }

  .radio-options input[type="radio"] {
    display: none;
  }

  .radio-label {
    flex: 1;
    text-align: center;
    padding: 0.7rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    background: #f8f9fa;
    transition: all 0.2s ease;
    color: #6c757d;
    font-weight: 500;
    border-radius: 7px;
    border: 1px solid #dee2e6;
    margin-right: 4px;
  }

  .radio-label:last-child {
    margin-right: 0;
  }

  .radio-label:hover {
    background: #e9ecef;
    color: #495057;
  }

  /* 선택된 라디오 버튼 */
  .radio-options input[type="radio"]:checked + .radio-label {
    background: #2a69ac;
    color: white;
    font-weight: 600;
  }

  /* 검색 입력 그룹 */
  .search-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }

  .input-container {
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #2a69ac;
    box-shadow: 0 0 0 2px rgba(42, 105, 172, 0.2);
  }

  /* 검색 버튼 */
  .btn-search {
    background: #2a69ac;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s ease;
  }

  .btn-search:hover {
    background: #1e5a96;
  }

  .btn-search:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  /* 알림 메시지 */
  .alert {
    margin: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .alert.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* 카드 컨테이너 */
  .cards-container {
    padding: 0 0.5rem 1rem 0.5rem;
  }

  /* 제품 카드 */
  .product-card {
    background: white;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    position: relative;
    overflow: hidden;
    border: 1px solid #e9ecef;
    min-height: 160px; /* 더더욱 큰 높이로 증가 */
  }

  /* 제품 이미지 - 정사각형 */
  .product-image {
    width: 100px;
    height: 100px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  .product-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-image {
    width: 100%;
    height: 100%;
    background: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: #6c757d;
    text-align: center;
  }

  /* 제품 정보 */
  .product-info {
    flex: 1;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }

  .product-code {
    font-size: 0.75rem;
    color: #6c757d;
    margin-bottom: 0.2rem;
    font-weight: 500;
  }

  .product-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 0.3rem;
    line-height: 1.3;
  }

  .product-cost {
    font-size: 0.75rem;
    color: #6c757d;
    margin-bottom: 0.2rem;
  }

  .product-price {
    font-size: 0.8rem;
    color: #dc3545;
    font-weight: 700;
  }

  /* 재고 정보 영역 */
  .stock-info-area {
    width: 140px;
    flex-shrink: 0;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    position: relative;
    min-height: 150px; /* 더더욱 큰 높이로 증가 */
  }

  /* 재고/수량 입력 카드 */
  .stock-card {
    background: white;
    border-radius: 6px;
    padding: 0.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    border: 1px solid #e9ecef;
    margin-bottom: 1.5rem; /* 여백을 더 더 늘려서 단종처리 버튼과 완전 분리 */
  }

  /* 재고 표시 */
  .stock-display {
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .stock-label {
    font-size: 0.75rem;
    color: #333;
    font-weight: 600;
  }

  /* 재고 조정 컨트롤 */
  .stock-controls {
    background: transparent;
    border-radius: 0;
    padding: 0;
    border: none;
    margin-bottom: 0;
  }

  .stock-adjust-section {
    margin-bottom: 0.3rem;
  }

  .stock-input-group {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .stock-quantity {
    width: 65px;
    padding: 0.2rem;
    border: 1px solid #ddd;
    border-radius: 3px;
    text-align: center;
    font-size: 0.75rem;
  }

  .stock-quantity:focus {
    outline: none;
    border-color: #2a69ac;
  }

  .stock-save-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.65rem;
    font-weight: 600;
    white-space: nowrap;
    transition: background 0.2s ease;
  }

  .stock-save-btn:hover:not(:disabled) {
    background: #218838;
  }

  .stock-save-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  /* 단종 처리 버튼 */
  .product-actions {
    position: absolute;
    bottom: 0.2rem;
    right: 0.3rem;
  }

  .discontinued-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 600;
    transition: background 0.2s ease;
  }

  .discontinued-btn:hover {
    background: #5a6268;
  }

  .discontinued-btn.active {
    background: #dc3545;
  }

  .discontinued-btn.active:hover {
    background: #c82333;
  }

  /* 단종된 제품 스타일 */
  .product-card.discontinued {
    opacity: 0.7;
    border-left: 4px solid #dc3545;
  }

  /* 로딩 스타일 */
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    background: white;
    margin: 0.5rem;
    border-radius: 8px;
  }

  .loading-content {
    text-align: center;
    color: #6c757d;
  }

  .loading-spinner {
    font-size: 1.5rem;
    animation: spin 1s linear infinite;
    margin-bottom: 0.5rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 결과 없음 */
  .no-results {
    text-align: center;
    padding: 2rem;
    color: #6c757d;
    background: white;
    margin: 0.5rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  /* 모바일 최적화 */
  @media (max-width: 480px) {
    .search-form {
      margin: 0.3rem;
      padding: 0.8rem;
    }

    .cards-container {
      padding: 0 0.3rem 1rem 0.3rem;
    }

    .product-card {
      min-height: 100px; /* 모바일에서도 더 충분한 카드 높이 */
    }

    .product-image {
      width: 100px;
      height: 100px;
    }

    .product-info {
      padding: 0.4rem;
    }

    .stock-info-area {
      width: 130px;
      padding: 0.4rem;
      min-height: 130px; /* 모바일에서도 더 충분한 재고 영역 높이 */
    }

    .stock-card {
      margin-bottom: 1.2rem; /* 모바일에서도 충분한 여백 */
    }

    .radio-label {
      padding: 0.6rem 0.8rem;
      font-size: 0.85rem;
    }
  }

  /* 태블릿 */
  @media (min-width: 768px) {
    .search-form {
      margin: 1rem;
      padding: 1.5rem;
    }

    .cards-container {
      padding: 0 1rem 1rem 1rem;
    }

    .product-card {
      min-height: 170px; /* 태블릿에서도 충분한 높이 */
    }

    .product-image {
      width: 100px;
      height: 100px;
    }

    .stock-info-area {
      width: 160px;
      min-height: 160px; /* 태블릿에서도 충분한 높이 */
    }
  }

  /* 데스크톱 */
  @media (min-width: 1024px) {
    .search-form {
      margin: 1.5rem 2rem;
      padding: 2rem;
    }

    .cards-container {
      padding: 0 2rem 1rem 2rem;
    }

    .product-card {
      min-height: 180px; /* 데스크톱에서도 충분한 높이 */
    }

    .product-image {
      width: 110px;
      height: 110px;
    }

    .stock-info-area {
      width: 180px;
      min-height: 170px; /* 데스크톱에서도 충분한 높이 */
    }
  }

  /* 터치 최적화 */
  .btn-search,
  .stock-save-btn,
  .discontinued-btn {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
</style>