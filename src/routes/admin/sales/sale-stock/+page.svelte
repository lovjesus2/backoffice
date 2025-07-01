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
      const response = await fetch('/api/sales/sale-stock/toggle-discontinued', {
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
<div class="page">
  <!-- 헤더 - 기존 스타일과 동일 -->
  <header class="header">
    <h1>재고 관리</h1>
  </header>

  <!-- 컨텐츠 -->
  <main class="content">
    <!-- 검색 폼 -->
    <form class="search-form">
      <!-- 단종 구분 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>단종 구분:</legend>
          <div class="radio-options">
            <div class="radio-option">
              <input 
                type="radio" 
                name="discontinued_filter" 
                id="normal_discontinued" 
                bind:group={discontinuedFilter} 
                value="normal"
              >
              <label for="normal_discontinued">정상</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                name="discontinued_filter" 
                id="discontinued_only" 
                bind:group={discontinuedFilter} 
                value="discontinued"
              >
              <label for="discontinued_only">단종</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                name="discontinued_filter" 
                id="all_discontinued" 
                bind:group={discontinuedFilter} 
                value="all"
              >
              <label for="all_discontinued">전체</label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- 검색 필터 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>검색 필터:</legend>
          <div class="radio-options">
            <div class="radio-option">
              <input 
                type="radio" 
                name="search_type" 
                id="search_name" 
                bind:group={searchType} 
                value="name"
              >
              <label for="search_name">제품 검색</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                name="search_type" 
                id="search_code" 
                bind:group={searchType} 
                value="code"
              >
              <label for="search_code">코드 검색</label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- 검색 입력 -->
      <div class="form-group search-input-group">
        <input
          type="text"
          name="text1"
          id="searchInput"
          class="form-control"
          placeholder="검색어를 입력하세요"
          bind:value={searchTerm}
          on:keydown={handleKeydown}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        >
        {#if searchTerm}
          <button
            type="button"
            class="clear-btn"
            on:click={clearSearch}
          >
            ✕
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-search"
          on:click={handleSearch}
          disabled={loading}
        >
          {#if loading}
            <span class="loading-spinner">⟳</span>
          {:else}
            검색
          {/if}
        </button>
      </div>
    </form>

    <!-- 에러 메시지 -->
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    <!-- 제품 목록 -->
    <div class="cards-container">
      {#if products.length > 0}
        {#each products as product}
          <div class="product-card {product.discontinued ? 'discontinued' : ''}" data-product-code={product.code}>
            <!-- 제품 이미지 -->
            <div class="product-image">
              <img
                src="https://image.kungkungne.synology.me/{product.code}_1.jpg"
                alt={product.name}
                class="product-img {product.discontinued ? 'discontinued-image' : ''}"
                loading="lazy"
                on:error={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div class="no-image" style="display: none;">
                이미지 없음
              </div>
            </div>

            <!-- 제품 정보 -->
            <div class="product-info {product.discontinued ? 'highlight-info' : ''}">
              <div class="product-code">{product.code}</div>
              <div class="product-name">{product.name}</div>
              <div class="product-cost">원가: {new Intl.NumberFormat('ko-KR').format(product.cost)}원</div>
              <div class="product-price">판매가: {new Intl.NumberFormat('ko-KR').format(product.price)}원</div>
              
              <!-- 현재고 표시 -->
              <div class="current-stock-display">
                현재고: <span class="stock-amount {product.stock === 0 ? 'zero-stock' : product.stock < 10 ? 'low-stock' : 'good-stock'}">{product.stock}개</span>
              </div>
            </div>

            <!-- 재고 조정 컨트롤 -->
            <div class="stock-controls">
              <div class="stock-adjust-section">
                <div class="stock-adjust-label">재고 조정:</div>
                <div class="stock-input-group">
                  <input
                    type="number"
                    class="stock-quantity"
                    placeholder="±수량"
                    data-code={product.code}
                    on:keydown={(e) => handleStockInput(e, product.code)}
                    inputmode="numeric"
                  >
                  <button
                    type="button"
                    class="stock-save-btn {adjustingStock.has(product.code) ? 'loading' : ''}"
                    on:click={() => {
                      const input = document.querySelector(`input[data-code="${product.code}"]`);
                      if (input && input.value) {
                        adjustStock(product.code, input.value);
                      } else {
                        alert('수량을 입력해주세요.');
                      }
                    }}
                    disabled={adjustingStock.has(product.code)}
                  >
                    {#if adjustingStock.has(product.code)}
                      <span class="loading-spinner">⟳</span>
                    {:else}
                      저장
                    {/if}
                  </button>
                </div>
              </div>
            </div>

            <!-- 단종 처리 버튼 -->
            <div class="product-actions">
              <button
                type="button"
                class="discontinued-btn {product.discontinued ? 'active' : ''}"
                on:click={() => toggleDiscontinued(product.code)}
              >
                {product.discontinued ? '단종 취소' : '단종 처리'}
              </button>
            </div>
          </div>
        {/each}
      {:else if !loading && searchTerm}
        <div class="no-results">
          <p>검색 결과가 없습니다.</p>
        </div>
      {:else if !searchTerm}
        <div class="no-results">
          <p>제품명이나 코드를 검색해보세요.</p>
        </div>
      {/if}
    </div>
  </main>
</div>

{:else}
<div class="loading-container">
  <div class="loading-content">
    <div class="loading-spinner">⟳</div>
    <p>인증 확인 중...</p>
  </div>
</div>
{/if}

<style>
  /* 기존 통합 스타일시트와 동일한 스타일 */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Malgun Gothic', Arial, sans-serif;
    background-color: #f8f8f8;
    line-height: 1.6;
    color: #333;
  }

  /* 페이지 레이아웃 - 기존과 동일 */
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f8f8f8;
  }

  .header {
    background-color: #2a69ac;
    color: white;
    padding: 1rem;
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header h1 {
    font-size: 1.2rem;
    font-weight: bold;
    text-align: center;
    margin: 0;
  }

  .content {
    flex: 1;
    padding: 1rem;
    width: 100%;
    margin: 0 auto;
  }

  /* 폼 스타일 - 기존과 동일 */
  .search-form {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05), 
                0 1px 2px rgba(0, 0, 0, 0.1);
    border: 1px solid #f3f4f6;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .radio-group {
    margin-bottom: 1rem;
    border: none;
    padding: 0;
  }

  .radio-group legend {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
    font-size: 0.9rem;
    padding: 0;
  }

  .radio-options {
    display: flex;
    gap: 2px;
  }

  .radio-option {
    flex: 1;
    position: relative;
  }

  .radio-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .radio-option label {
    display: block;
    padding: 0.5rem 0.75rem;
    text-align: center;
    font-size: 0.85rem;
    font-weight: 500;
    color: #6b7280;
    background-color: #f3f4f6;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    white-space: nowrap;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .radio-option input[type="radio"]:checked + label {
    background-color: #2a69ac;
    color: #ffffff;
    font-weight: 600;
    transform: translateY(-1px);
  }

  .radio-option label:hover {
    color: #374151;
    background-color: #e5e7eb;
  }

  .radio-option input[type="radio"]:checked + label:hover {
    color: #ffffff;
    background-color: #1e4f7a;
  }

  /* 검색 입력 그룹 */
  .search-input-group {
    display: flex !important;
    flex-direction: row !important;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: nowrap !important;
    position: relative;
  }

  .form-control {
    width: 100%;
    padding: 0.65rem 0.875rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.95rem;
    background-color: #ffffff;
    transition: all 0.2s ease;
    min-height: 40px;
    flex: 1 !important;
    margin: 0 !important;
  }

  .form-control:focus {
    outline: none;
    border-color: #2a69ac;
    background-color: #fafbfc;
    box-shadow: 0 0 0 3px rgba(42, 105, 172, 0.1);
    transform: translateY(-1px);
  }

  .clear-btn {
    position: absolute;
    right: 100px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    z-index: 2;
  }

  .clear-btn:hover {
    color: #6b7280;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    text-align: center;
    transition: all 0.3s ease;
  }

  .btn-search {
    background: linear-gradient(135deg, #2a69ac 0%, #1e4f7a 100%);
    color: white;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    padding: 0.65rem 1.25rem;
    min-height: 40px;
    box-shadow: 0 2px 8px rgba(42, 105, 172, 0.25);
    transition: all 0.2s ease;
    letter-spacing: 0.025em;
    white-space: nowrap;
    min-width: 80px;
    flex-shrink: 0 !important;
  }

  .btn-search:hover:not(:disabled) {
    background: linear-gradient(135deg, #1e4f7a 0%, #164063 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(42, 105, 172, 0.35);
  }

  .btn-search:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 카드 컨테이너 */
  .cards-container {
    margin-top: 1rem;
  }

  /* 제품 카드 스타일 */
  .product-card {
    display: flex;
    margin-bottom: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
  }

  .product-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }

  .product-card.discontinued {
    opacity: 0.7;
    border-left: 4px solid #e63946;
  }

  .product-image {
    flex: 0 0 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9f9f9;
  }

  .product-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .discontinued-image {
    opacity: 0.7;
    filter: grayscale(30%);
  }

  .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #aaa;
    font-size: 0.7rem;
    text-align: center;
    background-color: #f0f0f0;
    border: 1px dashed #ddd;
  }

  .product-info {
    flex: 1;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .highlight-info {
    background-color: #fff8f8;
    border-left: 3px solid #e63946;
  }

  .product-code {
    font-weight: bold;
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .product-name {
    font-size: 1.1rem;
    margin: 0.25rem 0;
    font-weight: bold;
    color: #333;
  }

  .product-cost, .product-price {
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .product-price {
    font-weight: bold;
    color: #e63946;
  }

  .current-stock-display {
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
    font-weight: 500;
  }

  .stock-amount {
    font-weight: bold;
  }

  .stock-amount.zero-stock {
    color: #dc2626;
  }

  .stock-amount.low-stock {
    color: #d97706;
  }

  .stock-amount.good-stock {
    color: #059669;
  }

  /* 재고 컨트롤 */
  .stock-controls {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border: 1px solid #ddd;
    min-width: 160px;
  }

  .stock-adjust-section {
    margin-bottom: 8px;
  }

  .stock-adjust-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 5px;
    text-align: center;
    font-weight: 500;
  }

  .stock-input-group {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .stock-quantity {
    width: 80px;
    padding: 4px;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
    font-size: 14px;
  }

  .stock-quantity:focus {
    outline: none;
    border-color: #2a69ac;
  }

  .stock-save-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    min-width: 50px;
    font-weight: 500;
    transition: all 0.2s ease;
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
    bottom: 8px;
    right: 8px;
    z-index: 5;
  }

  .discontinued-btn {
    background-color: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    white-space: nowrap;
  }

  .discontinued-btn:hover {
    background-color: #e5e7eb;
    border-color: #9ca3af;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .discontinued-btn.active {
    background-color: #dc3545;
    color: white;
    border-color: #c82333;
    box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
  }

  .discontinued-btn.active:hover {
    background-color: #c82333;
    border-color: #bd2130;
    box-shadow: 0 3px 6px rgba(220, 53, 69, 0.4);
  }

  /* 에러 메시지 */
  .error-message {
    background-color: #fee;
    border: 1px solid #fcc;
    color: #c66;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  /* 검색 결과 없음 */
  .no-results {
    text-align: center;
    padding: 2rem;
    color: #666;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  /* 로딩 컨테이너 */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #f8f8f8;
  }

  .loading-content {
    text-align: center;
  }

  /* 로딩 스피너 */
  .loading-spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    font-size: 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 입력 필드 최적화 */
  input[type="number"] {
    -webkit-appearance: none;
    -moz-appearance: textfield;
  }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* 모바일 반응형 */
  @media (max-width: 768px) {
    .content {
      padding: 0.75rem;
    }

    /* 모바일에서도 오른쪽 배치 유지 */
    .stock-controls {
      top: 6px;
      right: 6px;
      min-width: 140px;
      padding: 6px;
    }

    .stock-adjust-label {
      font-size: 11px;
    }

    .stock-quantity {
      width: 70px;
      padding: 3px;
      font-size: 13px;
    }

    .stock-save-btn {
      padding: 3px 8px;
      font-size: 11px;
      min-width: 40px;
    }

    .product-actions {
      bottom: 6px;
      right: 6px;
    }

    .discontinued-btn {
      padding: 0.3rem 0.6rem;
      font-size: 0.7rem;
    }
  }

  @media (max-width: 480px) {
    .search-input-group {
      flex-direction: column !important;
      gap: 0.5rem;
    }

    .search-input-group .form-control {
      width: 100% !important;
    }

    .search-input-group .btn-search {
      width: 100% !important;
    }

    .clear-btn {
      right: 10px;
    }

    /* 작은 화면에서도 오른쪽 배치 유지, 더 작게 */
    .stock-controls {
      top: 4px;
      right: 4px;
      min-width: 120px;
      padding: 4px;
    }

    .stock-adjust-label {
      font-size: 10px;
    }

    .stock-quantity {
      width: 60px;
      padding: 2px;
      font-size: 12px;
    }

    .stock-save-btn {
      padding: 2px 6px;
      font-size: 10px;
      min-width: 35px;
    }

    .product-actions {
      bottom: 4px;
      right: 4px;
    }

    .discontinued-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.65rem;
    }
  }

  @media (max-width: 320px) {
    /* 매우 작은 화면에서도 오른쪽 배치, 최소 크기 */
    .stock-controls {
      top: 2px;
      right: 2px;
      min-width: 100px;
      padding: 3px;
    }

    .stock-adjust-label {
      font-size: 9px;
    }

    .stock-quantity {
      width: 50px;
      padding: 1px;
      font-size: 11px;
    }

    .stock-save-btn {
      padding: 1px 4px;
      font-size: 9px;
      min-width: 30px;
    }

    .product-actions {
      bottom: 2px;
      right: 2px;
    }

    .discontinued-btn {
      padding: 0.2rem 0.4rem;
      font-size: 0.6rem;
    }
  }
</style>