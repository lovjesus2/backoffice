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
        products = result.data.map(p => ({...p, imageError: false}));
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
<div class="stock-container">
  <!-- 페이지 타이틀 -->
  <div class="page-title">
    <h1>제품검색 & 재고관리</h1>
  </div>

  <!-- 메인 컨텐츠 -->
  <div class="main-content">
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
              <label for="normal_discontinued" class="radio-label">정상</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                name="discontinued_filter" 
                id="only_discontinued" 
                bind:group={discontinuedFilter} 
                value="only"
              >
              <label for="only_discontinued" class="radio-label">단종</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                name="discontinued_filter" 
                id="all_discontinued" 
                bind:group={discontinuedFilter} 
                value="all"
              >
              <label for="all_discontinued" class="radio-label">전체</label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- 검색 구분 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>검색 구분:</legend>
          <div class="radio-options">
            <div class="radio-option">
              <input 
                type="radio" 
                name="search_type" 
                id="search_name" 
                bind:group={searchType} 
                value="name"
              >
              <label for="search_name" class="radio-label">제품명</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                name="search_type" 
                id="search_code" 
                bind:group={searchType} 
                value="code"
              >
              <label for="search_code" class="radio-label">제품코드</label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- 검색 입력 -->
      <div class="form-group">
        <div class="search-input-group">
          <div class="input-wrapper">
            <input 
              type="text" 
              id="searchInput"
              class="form-control search-input" 
              placeholder={searchType === 'name' ? '제품명을 입력하세요' : '제품코드를 입력하세요'}
              bind:value={searchTerm}
              on:keydown={handleKeydown}
              autocomplete="off"
            >
            {#if searchTerm}
              <button type="button" class="clear-btn" on:click={clearSearch}>✕</button>
            {/if}
          </div>
          <button 
            type="button" 
            class="btn-search" 
            on:click={handleSearch}
            disabled={loading}
          >
            {#if loading}
              <span class="loading-spinner">⟳</span> 검색중...
            {:else}
              🔍 검색
            {/if}
          </button>
        </div>
      </div>
    </form>

    <!-- 에러 메시지 -->
    {#if error}
      <div class="alert alert-danger">
        ⚠️ {error}
      </div>
    {/if}

    <!-- 제품 카드 목록 -->
    <div class="cards-container">
      {#if products.length > 0}
        {#each products as product (product.code)}
          <div class="product-card {product.discontinued ? 'discontinued' : ''} {product.stock === 0 ? 'highlight-info' : ''}">
            <!-- 제품 이미지 -->
            <div class="product-image">
              {#if !product.imageError}
                <img
                  src="https://image.kungkungne.synology.me/{product.code}_1.jpg"
                  alt={product.name}
                  class="product-img {product.discontinued ? 'discontinued-image' : ''}"
                  loading="lazy"
                  on:error={() => {
                    console.log('이미지 로드 실패:', product.code);
                    product.imageError = true;
                    products = [...products];
                  }}
                />
              {/if}
              {#if product.imageError}
                <div class="no-image">
                  이미지 없음
                </div>
              {/if}
            </div>

            <!-- 제품 정보 -->
            <div class="product-info">
              <div class="product-code">{product.code}</div>
              <div class="product-name">{product.name}</div>
              <div class="product-cost">원가: {new Intl.NumberFormat('ko-KR').format(product.cost)}원</div>
              <div class="product-price">금액: {new Intl.NumberFormat('ko-KR').format(product.price)}원</div>
            </div>

            <!-- 재고 정보 영역 -->
            <div class="stock-info-area">
              <!-- 재고 조정 컨트롤 -->
              <div class="stock-controls">
                <div class="stock-adjust-section">
                  <div class="stock-adjust-label">재고: {product.stock}개</div>
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
            </div>

            <!-- 단종 처리 버튼 - 맨 아래 오른쪽 -->
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
  </div>
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
  /* 기본 리셋 */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* 메인 컨테이너 */
  .stock-container {
    width: 100%;
    max-width: none;
    background-color: #f5f5f5;
    font-family: 'Malgun Gothic', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    min-height: calc(100vh - 140px);
  }

  /* 페이지 타이틀 */
  .page-title {
    background: #ffffff;
    border-bottom: 1px solid #dee2e6;
    padding: 1rem 0;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .page-title h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
    margin: 0;
    text-align: center;
  }

  /* 메인 컨텐츠 */
  .main-content {
    width: 100%;
    padding: 0 1rem;
    max-width: none;
  }

  /* 검색 폼 */
  .search-form {
    width: 100%;
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid #dee2e6;
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

  .radio-label {
    display: block;
    padding: 0.6rem 1rem;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    font-size: 0.85rem;
    font-weight: 500;
    color: #495057;
    transition: all 0.2s ease;
    user-select: none;
  }

  .radio-option input[type="radio"]:checked + .radio-label {
    background: linear-gradient(135deg, #2a69ac 0%, #1e4f7a 100%);
    color: white;
    border-color: #2a69ac;
    box-shadow: 0 2px 4px rgba(42, 105, 172, 0.2);
  }

  .radio-label:hover {
    background: #e9ecef;
    border-color: #ced4da;
  }

  .radio-option input[type="radio"]:checked + .radio-label:hover {
    background: linear-gradient(135deg, #1e4f7a 0%, #164063 100%);
  }

  /* 검색 입력 그룹 */
  .search-input-group {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
    width: 100%;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    min-width: 0;
  }

  .form-control {
    width: 100%;
    padding: 0.65rem 1rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    font-size: 0.95rem;
    background-color: #ffffff;
    transition: all 0.2s ease;
  }

  .form-control:focus {
    outline: none;
    border-color: #2a69ac;
    box-shadow: 0 0 0 2px rgba(42, 105, 172, 0.1);
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .btn-search {
    background: linear-gradient(135deg, #2a69ac 0%, #1e4f7a 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    padding: 0.65rem 1.25rem;
    min-height: 40px;
    box-shadow: 0 2px 8px rgba(42, 105, 172, 0.25);
    transition: all 0.2s ease;
    letter-spacing: 0.025em;
    white-space: nowrap;
    min-width: 100px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .btn-search:hover:not(:disabled) {
    background: linear-gradient(135deg, #1e4f7a 0%, #164063 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(42, 105, 172, 0.35);
  }

  .btn-search:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* 알림 메시지 - 헤더와 동일한 가로 크기 */
  .alert {
    padding: 1rem;
    border-radius: 8px;
    margin: 0 1rem 1rem 1rem; /* 카드와 동일한 마진 */
    font-weight: 500;
  }

  .alert-danger {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* 카드 컨테이너 */
  .cards-container {
    width: 100%;
    margin-top: 1rem;
  }

  /* 제품 카드 */
  .product-card {
    display: flex;
    margin-bottom: 0.75rem;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    width: 100%;
    min-height: 130px; /* 이미지 높이에 맞춰 최소 높이 설정 */
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
    flex-shrink: 0;
    width: 120px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    background-color: #f9f9f9;
  }

  .product-img {
    width: 120px;
    height: 120px;
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
    height: 120px;
    color: #aaa;
    font-size: 0.8rem;
    text-align: center;
    background-color: #f0f0f0;
    border: 1px dashed #ddd;
  }

  .product-info {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
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
    word-break: break-word;
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
    margin-top: 0.5rem;
    font-weight: 500;
  }



  /* 재고 컨트롤 - 크기 증가 */
  .stock-controls {
    position: static;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 4px;
    padding: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border: 1px solid #ddd;
    min-width: 140px; /* 가로 크기 증가 */
    margin-bottom: 0.2rem;
  }

  .stock-adjust-section {
    margin-bottom: 6px;
  }

  .stock-adjust-label {
    font-size: 10px; /* 폰트 크기 증가 */
    color: #333;
    margin-bottom: 4px;
    text-align: center;
    font-weight: 600;
  }

  .stock-input-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stock-quantity {
    width: 65px; /* 입력 필드 크기 증가 */
    padding: 4px;
    border: 1px solid #ddd;
    border-radius: 2px;
    text-align: center;
    font-size: 12px;
  }

  .stock-quantity:focus {
    outline: none;
    border-color: #2a69ac;
  }

  .stock-save-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 4px 10px; /* 버튼 크기 증가 */
    border-radius: 2px;
    cursor: pointer;
    font-size: 10px;
    min-width: 45px; /* 최소 크기 증가 */
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

  /* 단종 처리 버튼 - 맨 아래 오른쪽 */
  .product-actions {
    position: absolute;
    bottom: 8px;
    right: 8px;
  }

  .discontinued-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.6rem;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .discontinued-btn:hover {
    background: #c82333;
  }

  .discontinued-btn.active {
    background: #28a745;
  }

  .discontinued-btn.active:hover {
    background: #218838;
  }

  /* 결과 없음 - 헤더와 동일한 가로 크기 */
  .no-results {
    text-align: center;
    padding: 3rem 2rem;
    color: #6c757d;
    font-size: 1.1rem;
    margin: 0 1rem; /* 카드와 동일한 마진 */
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  /* 로딩 */
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f8f9fa;
  }

  .loading-content {
    text-align: center;
    color: #6c757d;
  }

  .loading-spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 모바일 최적화 - 가로 레이아웃 유지 */
  @media (max-width: 768px) {
    .stock-container {
      min-height: calc(100vh - 120px);
    }

    .page-title {
      padding: 0.75rem 0;
      margin-bottom: 1rem;
    }

    .page-title h1 {
      font-size: 1.25rem;
    }

    .main-content {
      padding: 0;
    }

    .search-form {
      margin: 0 0.5rem 1.5rem 0.5rem; /* 양쪽에 최소 마진 추가 */
      padding: 1rem;
    }

    .cards-container {
      padding: 0 0.5rem; /* 양쪽에 최소 패딩 추가 */
    }

    .alert {
      margin: 0 0.5rem 1rem 0.5rem; /* 알림 메시지도 동일한 마진 */
    }

    .no-results {
      margin: 0 0.5rem; /* 결과 없음도 동일한 마진 */
    }

    .radio-options {
      gap: 1px;
    }

    .radio-label {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
    }

    .search-input-group {
      flex-direction: column;
      gap: 0.5rem;
    }

    .btn-search {
      width: 100%;
    }

    /* 모바일에서도 가로 레이아웃 유지 */
    .product-card {
      margin-bottom: 0.5rem;
    }

    .product-image {
      width: 80px;
      height: 100px; /* 높이 조정 */
    }

    .product-img {
      width: 80px;
      height: 100px;
    }

    .no-image {
      height: 100px;
    }

    .product-info {
      padding: 0.4rem;
    }

    .product-code {
      font-size: 0.7rem;
      margin-bottom: 0.2rem;
    }

    .product-name {
      font-size: 0.8rem;
      margin-bottom: 0.2rem;
    }

    .product-cost, .product-price {
      font-size: 0.7rem;
      margin-bottom: 0.2rem;
    }

    .stock-info-area {
      width: 130px; /* 모바일에서 가로 크기 조정 */
      height: 75px; /* 높이 조정 */
      padding: 0.3rem;
    }

    .stock-controls {
      min-width: 120px;
      padding: 4px;
    }

    .stock-adjust-label {
      font-size: 9px;
    }

    .stock-quantity {
      width: 55px;
      padding: 3px;
      font-size: 10px;
    }

    .stock-save-btn {
      padding: 3px 8px;
      font-size: 9px;
      min-width: 38px;
    }

    .discontinued-btn {
      padding: 0.15rem 0.3rem;
      font-size: 0.55rem;
    }
  }

  @media (max-width: 480px) {
    .page-title {
      padding: 0.5rem 0;
    }

    .page-title h1 {
      font-size: 1.1rem;
    }

    .main-content {
      padding: 0;
    }

    .search-form {
      margin: 0 0.3rem 1.5rem 0.3rem; /* 더 작은 마진 */
      padding: 0.75rem;
    }

    .cards-container {
      padding: 0 0.3rem; /* 더 작은 패딩 */
    }

    .alert {
      margin: 0 0.3rem 1rem 0.3rem; /* 알림 메시지도 동일한 마진 */
    }

    .no-results {
      margin: 0 0.3rem; /* 결과 없음도 동일한 마진 */
    }

    /* 작은 모바일에서도 가로 레이아웃 유지 */
    .product-image {
      width: 70px;
      height: 85px; /* 높이 조정 */
    }

    .product-img {
      width: 70px;
      height: 85px;
    }

    .no-image {
      height: 85px;
    }

    .product-info {
      padding: 0.3rem;
    }

    .product-code {
      font-size: 0.65rem;
      margin-bottom: 0.15rem;
    }

    .product-name {
      font-size: 0.7rem;
      margin-bottom: 0.15rem;
    }

    .product-cost, .product-price {
      font-size: 0.65rem;
      margin-bottom: 0.15rem;
    }

    .stock-info-area {
      width: 110px; /* 작은 화면에서 가로 크기 조정 */
      height: 65px; /* 높이 조정 */
      padding: 0.2rem;
    }

    .stock-controls {
      min-width: 100px;
      padding: 3px;
    }

    .stock-adjust-label {
      font-size: 8px;
    }

    .stock-quantity {
      width: 45px;
      padding: 2px;
      font-size: 9px;
    }

    .stock-save-btn {
      padding: 2px 6px;
      font-size: 8px;
      min-width: 30px;
    }

    .discontinued-btn {
      padding: 0.1rem 0.25rem;
      font-size: 0.5rem;
    }
  }

  /* 대형 화면 최적화 - 모바일 기준에서 적당히 확대 */
  @media (min-width: 1200px) {
    .main-content {
      padding: 0;
    }

    .search-form {
      margin: 0 2rem 2rem 2rem; /* 양쪽에 적당한 마진 */
      padding: 2rem;
    }

    .cards-container {
      padding: 0 2rem; /* 양쪽에 적당한 패딩 */
    }

    .product-card {
      margin-bottom: 1rem;
    }

    .product-image {
      width: 120px;
      height: 140px; /* 높이 증가 */
    }

    .product-img {
      width: 120px;
      height: 140px;
    }

    .no-image {
      height: 140px;
    }

    .product-info {
      padding: 0.8rem;
    }

    .product-code {
      font-size: 0.9rem;
      margin-bottom: 0.4rem;
    }

    .product-name {
      font-size: 1rem;
      margin-bottom: 0.4rem;
    }

    .product-cost, .product-price {
      font-size: 0.9rem;
      margin-bottom: 0.4rem;
    }

    .stock-info-area {
      width: 180px; /* 대형화면에서 가로 크기 증가 */
      height: 110px; /* 높이 증가 */
      padding: 0.6rem;
    }

    .stock-controls {
      min-width: 160px;
      padding: 8px;
    }

    .stock-adjust-label {
      font-size: 11px;
      margin-bottom: 6px;
    }

    .stock-quantity {
      width: 75px;
      padding: 5px;
      font-size: 13px;
    }

    .stock-save-btn {
      padding: 5px 12px;
      font-size: 11px;
      min-width: 55px;
    }

    .discontinued-btn {
      padding: 0.3rem 0.6rem;
      font-size: 0.7rem;
    }
  }

  @media (min-width: 1400px) {
    .main-content {
      padding: 0;
    }

    .search-form {
      margin: 0 3rem 2rem 3rem; /* 더 큰 마진 */
    }

    .cards-container {
      padding: 0 3rem; /* 더 큰 패딩 */
    }

    .product-image {
      width: 130px;
      height: 150px;
    }

    .product-img {
      width: 130px;
      height: 150px;
    }

    .no-image {
      height: 150px;
    }

    .stock-info-area {
      width: 200px;
      height: 120px;
    }
  }

  @media (min-width: 1600px) {
    .main-content {
      padding: 0;
    }

    .search-form {
      margin: 0 4rem 2rem 4rem; /* 최대 마진 */
    }

    .cards-container {
      padding: 0 4rem; /* 최대 패딩 */
    }

    .product-image {
      width: 140px;
      height: 160px;
    }

    .product-img {
      width: 140px;
      height: 160px;
    }

    .no-image {
      height: 160px;
    }

    .stock-info-area {
      width: 220px;
      height: 130px;
    }
  }

  /* 터치 최적화 */
  .btn-search,
  .stock-save-btn,
  .discontinued-btn,
  .clear-btn {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  /* Safe Area 지원 */
  @supports (padding: max(0px)) {
    .stock-container {
      padding-left: max(0px, env(safe-area-inset-left));
      padding-right: max(0px, env(safe-area-inset-right));
      padding-bottom: max(10px, env(safe-area-inset-bottom));
    }
  }
</style>