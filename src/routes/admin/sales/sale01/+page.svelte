<!-- src/routes/admin/sales/sale01/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { simpleCache } from '$lib/utils/simpleImageCache';

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

<div class="page">
  <header class="header">
    <h1>매출 조회</h1>
  </header>

  <main class="main-content">
    <!-- 검색 폼 -->
    <form on:submit|preventDefault={handleSearch}>
      <div class="search-field">
        <label>기간</label>
        <div class="date-inputs">
          <input
            type="date"
            bind:value={date1}
            class="form-control"
            required
          />
          <span class="date-separator">~</span>
          <input
            type="date"
            bind:value={date2}
            class="form-control"
            required
          />
        </div>
      </div>

      <div class="search-field">
        <fieldset class="radio-group">
          <legend>엽서상태</legend>
          <div class="radio-options">
            <div class="radio-option">
              <input type="radio" id="all" name="postcardStatus" value="all" bind:group={postcardStatus} />
              <label for="all">전체</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="sent" name="postcardStatus" value="sent" bind:group={postcardStatus} />
              <label for="sent">발송</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="not-sent" name="postcardStatus" value="not-sent" bind:group={postcardStatus} />
              <label for="not-sent">미발송</label>
            </div>
          </div>
        </fieldset>
      </div>

      <div class="search-field">
        <label>검색</label>
        <div class="search-input-group">
          <select bind:value={searchType} class="form-control">
            <option value="name">상품명</option>
            <option value="code">상품코드</option>
          </select>
          <input
            type="text"
            bind:value={text1}
            class="search-input form-control"
            placeholder="검색어를 입력하세요"
            on:keydown={handleKeydown}
          />
          <button type="submit" class="btn btn-search" disabled={loading}>
            {loading ? '검색중...' : '검색'}
          </button>
        </div>
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
      <div class="loading">
        <div class="loading-spinner">🔄</div>
        <p>검색 중...</p>
      </div>
    {/if}

    <!-- 검색 결과 요약 (calendar daily-summary 스타일 정확히 적용) -->
    {#if searchSubmitted && grandTotal}
      <div class="daily-summary">
        <h4>검색 결과 합계</h4>
        <div class="daily-summary-grid">
          <div class="daily-summary-row">
            <div>현금:</div>
            <div class="cash-payment">{formatNumber(grandTotal.cashTotal)}원</div>
          </div>
          <div class="daily-summary-row">
            <div>카드:</div>
            <div class="card-payment">{formatNumber(grandTotal.cardTotal)}원</div>
          </div>
          <div class="daily-summary-row">
            <div>총 수량:</div>
            <div class="total-quantity">{formatNumber(grandTotal.totalQty)}개</div>
          </div>
          <div class="daily-summary-row">
            <div>총 금액:</div>
            <div class="total-amount">{formatNumber(grandTotal.totalAmount)}원</div>
          </div>
        </div>
        <div class="search-stats">
          <span>매출 건수: {searchResultCount}건</span>
          <span>엽서 발송: {postSlipCount}건</span>
        </div>
      </div>
    {/if}

    <!-- 매출 그룹 목록 (calendar 스타일 정확히 100% 적용) -->
    {#if searchSubmitted && salesGroups.length > 0}
      <div class="sales-groups-container">
        {#each salesGroups as group}
          <div class="sales-group">
            <!-- 매출 그룹 헤더 -->
            <div class="sales-group-header">
              <div class="sales-group-title">
                <div class="sales-group-number">
                  {group.slipNo}
                  <span class="sales-group-count">{formatNumber(group.totalQty)}개</span>
                  <span class="sales-group-date-time">{group.regTime || ''}</span>
                </div>
                
                <div class="sales-group-summary">
                  <div class="summary-item-inline">
                    <span>현금:</span>
                    <span class="cash-value">{formatNumber(group.cashTotal)}원</span>
                  </div>
                  <div class="summary-item-inline">
                    <span>카드:</span>
                    <span class="card-value">{formatNumber(group.cardTotal)}원</span>
                  </div>
                  <div class="summary-item-inline">
                    <span>금액:</span>
                    <span class="total-value">{formatNumber(group.totalAmount)}원</span>
                  </div>
                </div>
              </div>
              
              <div class="sales-group-controls">
                <a 
                  href="https://postcard.akojeju.com/receipt.php?sale_id={group.slipNo}_{group.rand}" 
                  target="_blank"
                  class="digital-postcard {group.postSlip && group.postSlip.trim() !== '' ? 'has-post-slip' : ''}"
                >
                  엽서
                </a>
              </div>
            </div>
            
            <!-- 매출 상품 목록 -->
            <div class="sales-group-content">
              {#each group.items as item}
                <div class="sales-item {item.hygb === '1' ? 'cash-payment-item' : ''}">
                  
                  <div class="item-image-container">
                    {#if item.stockManaged && item.currentStock !== undefined}
                      <div class="stock-badge {item.currentStock === 0 ? 'zero-stock' : item.currentStock <= 5 ? 'low-stock' : item.currentStock <= 20 ? 'medium-stock' : ''}">
                        {item.currentStock}개
                      </div>
                    {/if}
                    
                    <img 
                      src="/proxy-images/{item.itemCode}_1.jpg"
                      alt={item.itemName}
                      class="item-image"
                      on:load={cacheImage}
                      on:error={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                    />
                    <div class="no-image" style="display:none;">이미지 없음</div>
                  </div>
                  
                  <div class="sales-item-content">
                    <div class="sales-item-header">
                      <div class="sales-item-title">
                        {#if item.qrCode}
                          <a href={item.qrCode} target="_blank">{item.itemName}</a>
                        {:else}
                          {item.itemName}
                        {/if}
                      </div>
                    </div>
                    
                    <div class="sales-item-info">
                      <div class="sales-item-code {item.hygb === '1' ? 'cash-payment' : 'card-payment'}">
                        {item.itemCode}
                      </div>
                      <div class="sales-item-amounts">
                        <div class="sales-item-quantity">{formatNumber(item.qty)}개</div>
                        <div class="sales-item-price">{formatNumber(item.totalAmount)}원</div>
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
      <div class="no-data">
        검색 결과가 없습니다.
      </div>
    {/if}
  </main>
</div>

<style>
  /* 기본 스타일 */
  .page {
    min-height: 100vh;
    background-color: #f8f9fa;
  }

  /* 헤더 스타일 */
  .header {
      background: white;
      padding: 15px 5px;
      margin-bottom: 5px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
  }

  .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
  }

  /* 메인 컨텐츠 */
  .main-content {
    padding: 0;
  }

  /* 폼 스타일 */
  form {
    background: white;
    margin: 0.2rem; /* 0.5rem에서 0.2rem로 줄임 */
    border-radius: 8px;
    padding: 0.8rem; /* 1rem에서 0.8rem로 줄임 */
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .search-field {
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .search-field label {
    min-width: 80px;
    font-weight: 600;
    color: #333;
    font-size: 0.95rem;
  }

  .form-control {
    padding: 0.75rem;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    font-size: 0.9rem;
    transition: border-color 0.2s;
  }

  .form-control:focus {
    outline: none;
    border-color: #2a69ac;
    box-shadow: 0 0 0 2px rgba(42, 105, 172, 0.2);
  }

  .date-inputs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .date-separator {
    font-weight: bold;
    color: #666;
  }

  .radio-group {
    border: none;
    margin: 0;
    padding: 0;
    flex: 1;
  }

  .radio-group legend {
    display: none;
  }

  .radio-options {
    display: flex;
    gap: 0.5rem;
  }

  .radio-option {
    position: relative;
  }

  .radio-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .radio-option label {
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

  .search-input-group {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    align-items: stretch;
  }

  .search-input {
    flex: 1;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
  }

  .btn-search {
    background: linear-gradient(135deg, #2a69ac 0%, #1e4f7a 100%);
    color: white;
    min-width: 80px;
  }

  .btn-search:hover:not(:disabled) {
    background: linear-gradient(135deg, #1e4f7a 0%, #164063 100%);
    transform: translateY(-2px);
  }

  .btn-search:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* 알림 스타일 */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .alert.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* 로딩 스타일 */
  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .loading-spinner {
    font-size: 2rem;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Calendar daily-summary 스타일 정확히 100% 복사 */
  .daily-summary {
    padding: 10px 15px;
    border-radius: 6px;
    margin-bottom: 15px;
      /* 기존 스타일에 추가 */
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border: 1px solid #e0e0e0;
    background: white; /* 기존 #f8f9fa에서 변경 */

  }

  .daily-summary h4 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: #333;
    font-weight: 600;
    text-align: center;
  }

  .daily-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    max-width: 400px;
    margin: 0 auto;
  }

  .daily-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    /* 기존 스타일에 추가 */
    border-bottom: 1px solid #e9ecef;
    padding: 8px 0; /* 기존 4px에서 늘림 */
  }

  .daily-summary-row div:first-child {
    color: #666;
    font-weight: 500;
  }

  .daily-summary-row .cash-payment {
    color: #28a745;
    font-weight: bold;
  }

  .daily-summary-row .card-payment {
    color: #007bff;
    font-weight: bold;
  }

  .daily-summary-row .total-amount {
    color: #dc3545;
    font-weight: bold;
    font-size: 16px;
  }

  .daily-summary-row .total-quantity {
    color: #333;
    font-weight: bold;
  }

  .search-stats {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 14px;
    color: #666;
    margin-top: 10px;
  }

  /* Calendar sales-group 스타일 정확히 100% 복사 */
  .sales-groups-container {
    space-y: 1rem;
  }

  .sales-group {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 15px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .sales-group-header {
    background: #f8f9fa;
    padding: 12px 15px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 15px;
  }

  .sales-group-title {
    flex: 1;
    min-width: 200px;
    display: block;
    overflow: visible;
  }

  .sales-group-number {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    font-weight: bold;
    color: #333;
    word-break: break-all;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sales-group-count {
    background: #007bff;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: bold;
    margin-left: 8px;
  }

  .sales-group-date-time {
      font-size: 10px;
      margin: 0;
      padding: 0;
      font-family: 'Malgun Gothic', sans-serif;
      display: inline;
      white-space: nowrap;
      letter-spacing: -0.3px;
  }

  .sales-group-summary {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    align-items: center;
    width: 100%;
    margin: 0;
  }

  .summary-item-inline {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
  }

  .summary-item-inline span:first-child {
    color: #666;
  }

  .summary-item-inline .cash-value {
    color: #28a745;
    font-weight: bold;
  }

  .summary-item-inline .card-value {
    color: #007bff;
    font-weight: bold;
  }

  .summary-item-inline .total-value {
    color: #dc3545;
    font-weight: bold;
  }

  .sales-group-controls {
    flex-shrink: 0;
    align-self: flex-start;
  }

  .digital-postcard {
    display: inline-block;
    padding: 6px 10px;
    border: 1px solid #6c757d;
    border-radius: 4px;
    color: #6c757d;
    text-decoration: none;
    font-size: 12px;
    font-weight: bold;
    white-space: nowrap;
  }

  .digital-postcard.has-post-slip {
    background: #28a745;
    color: white;
    border-color: #28a745;
  }

  .digital-postcard:hover {
    background: #5a6268;
    color: white;
  }

  .sales-group-content {
    padding: 0;
  }

  /* Calendar sales-item 스타일 정확히 100% 복사 */
  .sales-item {
    display: flex;
    padding: 12px 15px;
    border-bottom: 1px solid #f0f0f0;
    align-items: flex-start;
    gap: 12px;
  }

  .sales-item:last-child {
    border-bottom: none;
  }

  .sales-item:hover {
    background: #f8f9fa;
  }

  .sales-item.cash-payment-item {
    background: rgba(40, 167, 69, 0.05);
    border-left: 3px solid #28a745;
  }

  .sales-item.cash-payment-item:hover {
    background: rgba(40, 167, 69, 0.1);
  }

  .item-image-container {
    width: 70px;
    height: 70px;
    border-radius: 6px;
    overflow: hidden;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    flex-shrink: 0;
    position: relative;
  }

  .item-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-image {
    font-size: 10px;
    color: #999;
    text-align: center;
    padding: 25px 5px;
    line-height: 1.2;
  }

  .stock-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #ffc107;
    color: #333;
    padding: 2px 5px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: bold;
    min-width: 25px;
    text-align: center;
    z-index: 10;
  }

  .stock-badge.low-stock {
    background: #ffc107;
    color: #333;
  }

  .stock-badge.medium-stock {
    background: #ffc107;
    color: #333;
  }

  .stock-badge.zero-stock {
    background: #6c757d;
    color: white;
  }

  .sales-item-content {
    flex: 1;
    min-width: 0;
  }

  .sales-item-header {
    margin-bottom: 8px;
  }

  .sales-item-title {
    font-size: 15px;
    font-weight: 600;
    color: #333;
    line-height: 1.3;
    margin-bottom: 4px;
  }

  .sales-item-title a {
    color: inherit;
    text-decoration: none;
  }

  .sales-item-title a:hover {
    color: #007bff;
    text-decoration: underline;
  }

  .sales-item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .sales-item-code {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: bold;
    color: #495057;
  }

  .sales-item-code.cash-payment {
    color: #155724;
  }

  .sales-item-code.card-payment {
    color: #004085;
  }

  .sales-item-amounts {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .sales-item-quantity {
    font-size: 13px;
    font-weight: 600;
    color: #495057;
  }

  .sales-item-price {
    font-size: 15px;
    font-weight: bold;
    color: #dc3545;
    text-align: right;
    min-width: 70px;
  }

  .no-data {
    text-align: center;
    padding: 3rem;
    color: #666;
    font-size: 1.1rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  /* Calendar 모바일 반응형 정확히 100% 복사 */
  @media (max-width: 768px) {
    .page {
      padding: 1px 0px;
      width: 100%;
      margin: 0;
    }
    
    .header {
      padding: 10px 2px;
      margin-bottom: 5px;
    }
    
    .header h1 {
      font-size: 20px;
    }
    
    .content {
      padding: 0.5rem;
    }

    .search-field {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .search-field label {
      min-width: auto;
    }

    .date-inputs,
    .search-input-group {
      width: 100%;
    }

    .radio-options {
      width: 100%;
      justify-content: space-between;
    }

    .daily-summary-grid {
      grid-template-columns: 1fr;
      max-width: 300px;
    }

    .item-image-container {
      width: 60px;
      height: 60px;
    }

    .sales-item {
      padding: 10px 12px;
      gap: 10px;
    }
  }

  @media (max-width: 480px) {
    .search-stats {
      flex-direction: column;
      gap: 8px;
    }
  }
</style>