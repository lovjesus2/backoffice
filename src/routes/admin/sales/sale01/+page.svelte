<!-- src/routes/admin/sales/sale01/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { simpleCache } from '$lib/utils/simpleImageCache.js';

  // 상태 변수들
  let date1 = new Date().toISOString().split('T')[0];
  let date2 = new Date().toISOString().split('T')[0];
  let postcardStatus = 'all';
  let searchType = 'name';
  let text1 = '';
  let searchSubmitted = false;
  let salesGroups = [];
  let grandTotal = null;
  let searchResultCount = 0;
  let postSlipCount = 0;
  let loading = false;
  let error = '';

  // 검색 함수
  async function searchSales() {
    if (!browser) return;

    loading = true;
    error = '';
    searchSubmitted = true;

    try {
      const params = new URLSearchParams({
        date1,
        date2,
        postcard_status: postcardStatus,
        search_type: searchType,
        text1,
        search_submitted: '1'
      });

      const response = await fetch(`/api/sales/sale01?${params}`);
      const data = await response.json();

      if (data.success) {
        salesGroups = data.salesGroups || [];
        grandTotal = data.grandTotal || null;
        searchResultCount = data.searchResultCount || 0;
        postSlipCount = data.postSlipCount || 0;
      } else {
        error = data.message || '검색에 실패했습니다.';
        salesGroups = [];
        grandTotal = null;
        searchResultCount = 0;
        postSlipCount = 0;
      }
    } catch (err) {
      console.error('검색 오류:', err);
      error = '서버 오류가 발생했습니다.';
      salesGroups = [];
      grandTotal = null;
      searchResultCount = 0;
      postSlipCount = 0;
    } finally {
      loading = false;
    }
  }

  // 이미지 캐싱 (기존 프로젝트 유틸리티 사용)
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  // 숫자 포맷팅
  function formatNumber(num) {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
  }

  // 날짜 포맷팅
  function formatDate(dateString) {
    if (!dateString) return '';
    if (dateString.length === 8) {
      return `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
    }
    return dateString;
  }

  // 날짜/시간 포맷팅
  function formatDateTime(dateTime) {
    if (!dateTime) return '';
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateTime;
    }
  }

  // 엽서 링크 생성
  function getPostcardUrl(slipNo, rand) {
    return `https://postcard.akojeju.com/receipt.php?sale_id=${slipNo}_${rand}`;
  }

  // 폼 제출 핸들러
  function handleSubmit(event) {
    event.preventDefault();
    searchSales();
  }

  onMount(() => {
    // 페이지 로드 시 안내 메시지만 표시
  });
</script>

<svelte:head>
  <title>매출 조회 - 아코제주 관리시스템</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<div class="page">
  <header class="header">
    <h1>매출 조회</h1>
  </header>

  <main class="content">
    <form on:submit={handleSubmit}>
      <!-- 기간 선택 -->
      <div class="form-group">
        <div class="search-row">
          <div class="search-field date-range-field">
            <label>기간:</label>
            <div class="date-inputs">
              <input 
                type="date" 
                bind:value={date1}
                id="date1"
              >
              <input 
                type="date" 
                bind:value={date2}
                id="date2"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- 엽서 상태 선택 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>엽서 상태:</legend>
          <div class="radio-options">
            <div class="radio-option">
              <input 
                type="radio" 
                bind:group={postcardStatus}
                value="all"
                id="postcard_all"
              >
              <label for="postcard_all">전체</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                bind:group={postcardStatus}
                value="registered"
                id="postcard_registered"
              >
              <label for="postcard_registered">등록</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                bind:group={postcardStatus}
                value="unregistered"
                id="postcard_unregistered"
              >
              <label for="postcard_unregistered">미등록</label>
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
                bind:group={searchType}
                value="name"
                id="search_name"
              >
              <label for="search_name">제품 검색</label>
            </div>
            <div class="radio-option">
              <input 
                type="radio" 
                bind:group={searchType}
                value="code"
                id="search_code"
              >
              <label for="search_code">코드 검색</label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- 검색어 입력 -->
      <div class="form-group search-input-group">
        <input 
          type="text" 
          bind:value={text1}
          class="form-control" 
          placeholder="검색어를 입력하세요"
        >
        <button type="submit" class="btn btn-search" disabled={loading}>
          {loading ? '검색중...' : '검색'}
        </button>
      </div>
    </form>

    <!-- 에러 메시지 -->
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    <!-- 로딩 -->
    {#if loading}
      <div class="no-results">
        <p>검색 중...</p>
      </div>
    {/if}

    <!-- 검색 결과가 없을 때 -->
    {#if !loading && searchSubmitted && salesGroups.length === 0}
      <div class="no-results">
        <p>검색 결과가 없습니다.</p>
      </div>
    {/if}

    <!-- 검색 전 안내 메시지 -->
    {#if !searchSubmitted && !loading}
      <div class="no-results">
        <p>검색 조건을 입력하고 검색 버튼을 클릭하세요.</p>
      </div>
    {/if}

    <!-- 검색 결과 -->
    {#if salesGroups.length > 0}
      <!-- 검색 결과 수 표시 -->
      <div class="page-title">
        <span>검색 결과: {formatNumber(searchResultCount)}건</span>
        <span class="formatted-date">{formatDate(date1.replace(/-/g, ''))} ~ {formatDate(date2.replace(/-/g, ''))}</span>
      </div>

      <!-- 전체 합계 표시 -->
      {#if grandTotal}
        <div class="grand-total">
          <div class="grand-total-title">
            전체 합계
            <span class="sales-group-count">{formatNumber(searchResultCount)}건</span>
          </div>
          <div class="grand-total-row">
            <span>현금:</span>
            <span class="cash-payment">{formatNumber(grandTotal.cashAmount)}원</span>
          </div>
          <div class="grand-total-row">
            <span>카드:</span>
            <span class="card-payment">{formatNumber(grandTotal.cardAmount)}원</span>
          </div>
          <div class="grand-total-row">
            <span>총합계:</span>
            <span class="total-amount">{formatNumber(grandTotal.totalAmount)}원</span>
          </div>
          <div class="grand-total-row">
            <span>총수량:</span>
            <span>{formatNumber(grandTotal.totalQty)}개</span>
          </div>
          <div class="grand-total-row">
            <span>엽서 발송:</span>
            <span>{formatNumber(postSlipCount)}건 / {formatNumber(searchResultCount)}건</span>
          </div>
        </div>
      {/if}

      <!-- 매출 그룹 목록 -->
      <div class="sales-groups-container">
        {#each salesGroups as group (group.slipNo)}
          <div class="sales-group">
            <!-- 그룹 헤더 -->
            <div class="sales-group-header">
              <div class="sales-group-title">
                <div class="sales-group-number">
                  {group.slipNo}
                  <span class="sales-group-count">{formatNumber(group.totalQty)}개</span>
                  <div class="sales-group-date-time">
                    {formatDateTime(group.regTime)}
                  </div>
                </div>

                <!-- 현금/카드/금액 요약 -->
                <div class="header-summary">
                  <div class="header-summary-item header-cash">
                    <span class="header-summary-label">현금:</span>
                    <span class="cash-payment">{formatNumber(group.cashTotal)}원</span>
                  </div>
                  <div class="header-summary-item header-card">
                    <span class="header-summary-label">카드:</span>
                    <span class="card-payment">{formatNumber(group.cardTotal)}원</span>
                  </div>
                  <div class="header-summary-item header-total">
                    <span class="header-summary-label">합계:</span>
                    <span class="total-amount">{formatNumber(group.totalAmount)}원</span>
                  </div>
                </div>

                <!-- 비고 표시 (있는 경우에만) -->
                {#if group.memo}
                  <div class="sales-group-bigo">
                    <span class="bigo-label">비고:</span>
                    <span class="bigo-content">{group.memo}</span>
                  </div>
                {/if}
              </div>

              <!-- 엽서 버튼 -->
              <div class="sales-group-controls">
                <a 
                  href={getPostcardUrl(group.slipNo, group.rand)}
                  target="_blank"
                  class="digital-postcard"
                  class:has-post-slip={group.postSlip}
                >
                  엽서
                </a>
              </div>
            </div>

            <!-- 그룹 내용 -->
            <div class="sales-group-content">
              {#each group.items as item}
                <div 
                  class="sales-item"
                  class:cash-payment-item={item.hygb === '1'}
                  data-item-code={item.itemCode}
                >
                  <!-- 재고 배지 (재고 관리 상품만) -->
                  {#if item.stockManagementFlag === '1'}
                    <div 
                      class="stock-badge"
                      class:low-stock={item.currentStock <= 5}
                      class:medium-stock={item.currentStock > 5 && item.currentStock <= 20}
                      class:zero-stock={item.currentStock === 0}
                    >
                      {item.currentStock}개
                    </div>
                  {/if}

                  <!-- 이미지 컨테이너 -->
                  <div class="item-image-container">
                    {#if item.itemCode !== 'ZZ' && item.itemCode !== 'zz'}
                      <img 
                        src="/proxy-images/{item.itemCode}_1.jpg"
                        alt={item.productName}
                        class="item-image"
                        on:load={cacheImage}
                        on:error={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div class="no-image" style="display: none;">
                        이미지<br>없음
                      </div>
                    {:else}
                      <div class="no-image">이미지 없음</div>
                    {/if}
                  </div>

                  <!-- 상품 정보 -->
                  <div class="sales-item-content">
                    <div class="sales-item-header">
                      <div class="sales-item-title">
                        {#if item.qrCode}
                          <a href={item.qrCode} target="_blank">
                            {item.productName}
                          </a>
                        {:else}
                          {item.productName}
                        {/if}
                      </div>
                    </div>

                    <div class="sales-item-info">
                      <!-- 품목 코드 -->
                      <div 
                        class="sales-item-code"
                        class:cash-payment={item.hygb === '1'}
                        class:card-payment={item.hygb !== '1'}
                      >
                        {item.itemCode}
                      </div>

                      <!-- 비고 표시 (ZZ 상품인 경우) -->
                      {#if item.itemCode === 'ZZ' || item.itemCode === 'zz'}
                        <div class="sales-item-code">{group.memo || ''}</div>
                      {/if}

                      <!-- 수량과 금액 -->
                      <div class="sales-item-amounts">
                        <div class="sales-item-quantity">
                          {formatNumber(item.qty)}개
                        </div>
                        <div class="sales-item-price">
                          {formatNumber(item.totalAmt)}원
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  /* ==========================================
     SALE_01 완전 동일한 integrated_styles.css
     ========================================== */

  /* 기본 스타일 리셋 */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: 'Malgun Gothic', Arial, sans-serif;
    background-color: #f8f8f8;
    line-height: 1.6;
    color: #333;
  }

  /* 페이지 레이아웃 */
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
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
    position: relative;
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
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  /* 폼 및 입력 요소 스타일 */
  form {
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

  .form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    background-color: #ffffff;
    color: #374151;
    transition: all 0.2s ease;
  }

  .form-control:focus {
    outline: none;
    border-color: #2a69ac;
    box-shadow: 0 0 0 2px rgba(42, 105, 172, 0.1);
  }

  .btn {
    background-color: #2a69ac;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .btn:hover:not(:disabled) {
    background-color: #1e5085;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
    transform: none;
  }

  .btn-search {
    min-width: 80px;
    white-space: nowrap;
  }

  /* 검색 행 */
  .search-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .search-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .date-range-field {
    flex: 1;
    width: 100%;
  }

  .search-field label {
    width: 3rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }

  .date-inputs {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }

  .search-field input[type="date"] {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    background-color: #ffffff;
    color: #374151;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .search-field input[type="date"]:focus {
    outline: none;
    border-color: #2a69ac;
    box-shadow: 0 0 0 2px rgba(42, 105, 172, 0.1);
  }

  .search-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  /* 라디오 그룹 */
  .radio-group {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1rem;
    background-color: #ffffff;
  }

  .radio-group legend {
    padding: 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .radio-options {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .radio-option {
    display: flex;
    align-items: center;
  }

  .radio-option input[type="radio"] {
    margin: 0;
    margin-right: 0.5rem;
    transform: scale(1.2);
  }

  .radio-option label {
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    transition: all 0.2s ease;
    font-size: 0.9rem;
    font-weight: 500;
    color: #374151;
    min-height: 40px;
    display: flex;
    align-items: center;
  }

  .radio-option input[type="radio"]:checked + label {
    background-color: #eff6ff;
    border-color: #2a69ac;
    color: #2a69ac;
  }

  /* 페이지 제목 */
  .page-title {
    font-size: 1rem;
    font-weight: bold;
    color: #92400e;
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .formatted-date {
    font-size: 0.85rem;
    color: #666;
    font-weight: normal;
  }

  /* 전체 합계 스타일 */
  .grand-total {
    margin: 0 0 1rem;
    padding: 1rem;
    background-color: #fffbf5;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-left: 4px solid #92400e;
  }

  .grand-total-title {
    font-size: 1.1rem;
    font-weight: bold;
    color: #92400e;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
  }

  .grand-total-title .sales-group-count {
    background-color: #92400e;
    color: white;
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    margin-left: 0.5rem;
    vertical-align: middle;
  }

  .grand-total-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eaeaea;
  }

  .grand-total-row:last-child {
    border-bottom: none;
    font-weight: bold;
  }

  /* 매출 그룹 스타일 */
  .sales-groups-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sales-group {
    margin-bottom: 1rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .sales-group:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  /* 매출 그룹 헤더 */
  .sales-group-header {
    padding: 0.6rem 1rem;
    background-color: #fef3c7;
    border-bottom: 1px solid #fde68a;
    color: #92400e;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .sales-group-title {
    flex: 1;
    min-width: 0;
  }

  .sales-group-number {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: bold;
    margin-bottom: 0.25rem;
    flex-wrap: wrap;
    font-family: 'Courier New', monospace;
  }

  .sales-group-count {
    background-color: #92400e;
    color: white;
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  .sales-group-date-time {
    display: block;
    font-size: 0.75rem;
    color: #666;
    font-weight: normal;
    margin-bottom: 0.5rem;
    font-family: 'Courier New', monospace;
  }

  .header-summary {
    display: flex;
    gap: 0.75rem;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }

  .header-summary-item {
    white-space: nowrap;
    display: flex;
    align-items: center;
  }

  .header-summary-label {
    margin-right: 0.25rem;
    color: #666;
    font-weight: normal;
  }

  .sales-group-controls {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
  }

  /* 엽서 버튼 */
  .digital-postcard {
    background-color: #9c27b0;
    color: white;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .digital-postcard:hover {
    background-color: #7b1fa2;
    text-decoration: none;
  }

  .digital-postcard.has-post-slip {
    background-color: #4caf50;
  }

  .digital-postcard.has-post-slip:hover {
    background-color: #45a049;
  }

  /* 비고 표시 스타일 */
  .sales-group-bigo {
    margin-top: 0.5rem;
    padding: 0.3rem 0.6rem;
    background-color: rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    font-size: 0.8rem;
    border: 1px solid rgba(146, 64, 14, 0.2);
  }

  .bigo-label {
    color: #666;
    font-weight: 500;
    margin-right: 0.25rem;
  }

  .bigo-content {
    color: #333;
  }

  /* 매출 아이템 */
  .sales-group-content {
    padding: 0;
  }

  .sales-item {
    display: flex;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f0f0f0;
    align-items: flex-start;
    gap: 0.75rem;
    position: relative;
    transition: background-color 0.2s ease;
  }

  .sales-item:last-child {
    border-bottom: none;
  }

  .sales-item:hover {
    background-color: #f8f9fa;
  }

  .sales-item.cash-payment-item {
    background-color: rgba(16, 185, 129, 0.05);
    border-left: 3px solid #10b981;
  }

  .sales-item.cash-payment-item:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  /* 재고 배지 */
  .stock-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background-color: #ffc107;
    color: #333;
    font-size: 0.7rem;
    font-weight: bold;
    padding: 0.2rem 0.4rem;
    border-radius: 12px;
    min-width: 30px;
    text-align: center;
    z-index: 10;
  }

  .stock-badge.low-stock {
    background-color: #ffc107;
    color: #333;
  }

  .stock-badge.medium-stock {
    background-color: #ffc107;
    color: #333;
  }

  .stock-badge.zero-stock {
    background-color: #6c757d;
    color: white;
  }

  /* 이미지 컨테이너 */
  .item-image-container {
    width: 80px;
    min-width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    background-color: #f8f9fa;
    border: 1px solid #e5e7eb;
    flex-shrink: 0;
    position: relative;
    margin-right: 0.75rem;
  }

  .item-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.7rem;
    color: #999;
    text-align: center;
    line-height: 1.2;
    background-color: #f3f4f6;
    padding: 25px 5px;
  }

  /* 매출 아이템 컨텐츠 */
  .sales-item-content {
    flex: 1;
    min-width: 0;
  }

  .sales-item-header {
    margin-bottom: 0.5rem;
  }

  .sales-item-title {
    font-size: 0.95rem;
    font-weight: bold;
    color: #333;
    line-height: 1.3;
    word-wrap: break-word;
    margin: 0.25rem 0;
  }

  .sales-item-title a {
    color: inherit;
    text-decoration: none;
  }

  .sales-item-title a:hover {
    text-decoration: underline;
  }

  .sales-item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .sales-item-code {
    font-size: 0.9rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
    width: 50%;
    color: #666;
    margin-top: 0.25rem;
  }

  .sales-item-code.cash-payment {
    background-color: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .sales-item-code.card-payment {
    background-color: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .sales-item-amounts {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    width: 50%;
  }

  .sales-item-quantity {
    font-size: 0.9rem;
    color: #666;
    font-weight: normal;
    width: 50px;
    text-align: center;
    white-space: nowrap;
    margin-top: 0.25rem;
  }

  .sales-item-price {
    font-size: 0.9rem;
    color: #2a69ac;
    font-weight: bold;
    text-align: right;
    white-space: nowrap;
  }

  /* 결제 방식 구분 */
  .cash-payment { color: #10b981; font-weight: bold; }
  .card-payment { color: #3b82f6; font-weight: bold; }
  .total-amount { color: #92400e; font-size: 1.1rem; font-weight: bold; }

  /* 기타 UI 요소 */
  .no-results {
    text-align: center;
    padding: 2rem;
    color: #666;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .error-message {
    background-color: #fee;
    border: 1px solid #fcc;
    color: #c66;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  /* ==========================================
     반응형 스타일 - 완전 동일
     ========================================== */

  @media (max-width: 768px) {
    .content {
      padding: 0.75rem;
    }
    
    .search-row {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: nowrap;
    }
    
    .search-field {
      flex: 1;
      min-width: 0;
    }
    
    .date-range-field {
      width: 100%;
    }
    
    .search-field label {
      width: 2.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #374151;
    }
    
    .date-inputs {
      gap: 1px;
    }
    
    .search-field input[type="date"] {
      padding: 0.6rem;
      font-size: 0.9rem;
      min-height: 40px;
    }
    
    .search-input-group {
      flex-direction: row !important;
      gap: 0.375rem;
      flex-wrap: nowrap !important;
    }
    
    .search-input-group .btn-search {
      padding: 0.6rem 0.875rem;
      font-size: 0.9rem;
      min-width: 70px;
    }
    
    .sales-group {
      margin-bottom: 0.75rem;
    }
    
    .grand-total {
      margin: 0 0 0.75rem;
    }
    
    .radio-option label {
      padding: 0.45rem 0.6rem;
      font-size: 0.8rem;
      min-height: 34px;
    }
    
    /* 모바일에서 매출 그룹 헤더 완전 재구성 */
    .sales-group-header {
      display: block !important;
      padding: 0.6rem !important;
      position: relative;
    }
    
    .sales-group-title {
      width: 100% !important;
      margin-bottom: 0 !important;
      padding-right: 4rem; /* 엽서 버튼 공간 확보 */
    }
    
    .sales-group-number {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      margin-bottom: 0.3rem !important;
      font-size: 1rem !important;
      flex-wrap: wrap !important;
    }
    
    .sales-group-date-time {
      font-size: 0.75rem !important;
      color: #666 !important;
      font-weight: normal !important;
      margin-left: auto !important;
    }
    
    .header-summary {
      display: flex !important;
      flex-direction: row !important;
      gap: 0.3rem !important;
      margin: 0 !important;
      padding: 0.3rem !important;
      background-color: rgba(255, 255, 255, 0.3) !important;
      border-radius: 6px !important;
      font-size: 0.75rem !important;
    }
    
    .header-summary-item {
      white-space: nowrap !important;
      display: flex !important;
      align-items: center !important;
      padding: 0.2rem 0.4rem !important;
      background-color: rgba(255, 255, 255, 0.6) !important;
      border-radius: 4px !important;
      border: 1px solid rgba(146, 64, 14, 0.2) !important;
    }
    
    .header-summary-label {
      margin-right: 0.2rem !important;
      font-size: 0.75rem !important;
      color: #666 !important;
    }
    
    .sales-group-controls {
      position: absolute !important;
      top: 0.6rem !important;
      right: 0.6rem !important;
      display: block !important;
    }
    
    .digital-postcard {
      padding: 0.4rem 0.8rem !important;
      font-size: 0.8rem !important;
    }
    
    .item-image-container {
      width: 70px;
      min-width: 70px;
      height: 70px;
      margin-right: 0.75rem;
    }
    
    .sales-item {
      padding: 0.5rem 0.75rem;
    }
    
    .sales-item-info {
      flex-wrap: nowrap;
    }
    
    .sales-item-code {
      width: 40%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.8rem;
      color: #666;
    }
    
    .sales-item-amounts {
      width: 60%;
      gap: 0.5rem;
    }
    
    .sales-item-quantity {
      width: 40px;
      font-size: 0.85rem;
      color: #666;
    }

    .sales-item-price {
      font-size: 0.9rem;
      color: #e63946;
      font-weight: bold;
    }

    .sales-item-title {
      font-size: 0.9rem;
      font-weight: bold;
      margin: 0.25rem 0;
    }
    
    /* 모바일에서 비고 스타일 */
    .sales-group-bigo {
      margin-top: 0.4rem !important;
      padding: 0.25rem 0.5rem !important;
      font-size: 0.8rem !important;
    }
    
    .bigo-label {
      font-size: 0.8rem !important;
    }
    
    .bigo-content {
      font-size: 0.8rem !important;
    }
  }

  @media (max-width: 480px) {
    form {
      padding: 0.875rem;
      border-radius: 10px;
    }
    
    .form-control {
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
      min-height: 38px;
    }
    
    .search-field label {
      width: 2rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #374151;
    }
    
    .date-inputs {
      gap: 1px;
    }
    
    .search-field input[type="date"] {
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
      min-height: 38px;
    }
    
    .search-input-group {
      flex-direction: row !important;
      gap: 0.375rem;
      flex-wrap: nowrap !important;
    }
    
    .search-input-group .btn-search {
      padding: 0.6rem 0.75rem;
      font-size: 0.85rem;
      min-height: 38px;
      min-width: 60px;
      white-space: nowrap;
    }
    
    .sales-group {
      margin-bottom: 0.6rem;
    }
    
    .grand-total {
      margin: 0 0 0.6rem;
    }
    
    .sales-item {
      padding: 0.5rem 0.75rem;
    }
    
    .radio-group legend {
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }
    
    .radio-option label {
      padding: 0.4rem 0.5rem;
      font-size: 0.75rem;
      min-height: 32px;
    }
    
    .item-image-container {
      width: 60px;
      min-width: 60px;
      height: 60px;
      margin-right: 0.5rem;
    }
    
    .sales-item-info {
      flex-wrap: nowrap;
    }
    
    .sales-item-code {
      width: 40%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.8rem;
      color: #666;
    }
    
    .sales-item-amounts {
      width: 60%;
      gap: 0.5rem;
    }
    
    .sales-item-quantity {
      width: 40px;
      font-size: 0.8rem;
      color: #666;
    }

    .sales-item-price {
      font-size: 0.85rem;
      color: #e63946;
      font-weight: bold;
    }

    .sales-item-title {
      font-size: 0.85rem;
      font-weight: bold;
      margin: 0.25rem 0;
    }
    
    /* 모바일에서 매출 그룹 헤더 더 컴팩트하게 */
    .sales-group-header {
      padding: 0.5rem !important;
    }
    
    .sales-group-title {
      padding-right: 3.5rem !important;
    }
    
    .sales-group-number {
      display: flex !important;
      align-items: center !important;
      gap: 0.4rem !important;
      font-size: 0.95rem !important;
      margin-bottom: 0.25rem !important;
      flex-wrap: wrap !important;
    }
    
    .sales-group-date-time {
      font-size: 0.7rem !important;
      margin-left: auto !important;
    }
    
    .header-summary {
      gap: 0.25rem !important;
      padding: 0.25rem !important;
      font-size: 0.7rem !important;
    }
    
    .header-summary-item {
      white-space: nowrap !important;
      padding: 0.15rem 0.3rem !important;
      background-color: rgba(255, 255, 255, 0.6) !important;
      border-radius: 3px !important;
      border: 1px solid rgba(146, 64, 14, 0.2) !important;
    }
    
    .header-summary-label {
      font-size: 0.7rem !important;
    }
    
    .sales-group-controls {
      top: 0.5rem !important;
      right: 0.5rem !important;
    }
    
    .digital-postcard {
      padding: 0.35rem 0.7rem !important;
      font-size: 0.75rem !important;
    }
    
    .page-title {
      margin-bottom: 0.6rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
    
    /* 작은 화면에서 비고 스타일 */
    .sales-group-bigo {
      margin-top: 0.35rem !important;
      padding: 0.2rem 0.4rem !important;
      font-size: 0.75rem !important;
    }
    
    .bigo-label {
      font-size: 0.75rem !important;
    }
    
    .bigo-content {
      font-size: 0.75rem !important;
    }
  }

  @media (max-width: 320px) {
    .search-input-group {
      flex-direction: row !important;
      gap: 0.25rem;
      flex-wrap: nowrap !important;
    }
    
    .search-input-group .btn-search {
      padding: 0.5rem 0.6rem;
      font-size: 0.8rem;
      min-width: 50px;
    }
    
    .sales-group {
      margin-bottom: 0.5rem;
    }
    
    .grand-total {
      margin: 0 0 0.5rem;
    }
    
    .sales-item {
      padding: 0.4rem 0.6rem;
    }
    
    .search-field label {
      width: 1.8rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: #374151;
    }
    
    .date-inputs {
      gap: 1px;
    }
    
    .search-field input[type="date"] {
      padding: 0.5rem 0.6rem;
      font-size: 0.85rem;
      min-height: 36px;
    }

    .sales-item-title {
      font-size: 0.8rem;
      font-weight: bold;
      margin: 0.2rem 0;
    }

    .sales-item-code {
      font-size: 0.75rem;
      color: #666;
    }

    .sales-item-quantity {
      font-size: 0.75rem;
      color: #666;
    }

    .sales-item-price {
      font-size: 0.8rem;
      color: #e63946;
      font-weight: bold;
    }
    
    /* 매우 작은 화면에서 매출 그룹 헤더 최적화 */
    .sales-group-header {
      padding: 0.4rem !important;
    }
    
    .sales-group-title {
      padding-right: 3rem !important;
    }
    
    .sales-group-number {
      display: flex !important;
      align-items: center !important;
      gap: 0.3rem !important;
      font-size: 0.85rem !important;
      margin-bottom: 0.2rem !important;
      flex-wrap: wrap !important;
    }
    
    .sales-group-date-time {
      font-size: 0.65rem !important;
      margin-left: auto !important;
    }
    
    .header-summary {
      gap: 0.2rem !important;
      padding: 0.2rem !important;
      font-size: 0.65rem !important;
    }
    
    .header-summary-item {
      white-space: nowrap !important;
      padding: 0.1rem 0.25rem !important;
      background-color: rgba(255, 255, 255, 0.6) !important;
      border-radius: 3px !important;
      border: 1px solid rgba(146, 64, 14, 0.2) !important;
    }
    
    .header-summary-label {
      font-size: 0.65rem !important;
    }
    
    .sales-group-controls {
      top: 0.4rem !important;
      right: 0.4rem !important;
    }
    
    .digital-postcard {
      padding: 0.3rem 0.6rem !important;
      font-size: 0.7rem !important;
    }
    
    /* 매우 작은 화면에서 비고 스타일 */
    .sales-group-bigo {
      margin-top: 0.3rem !important;
      padding: 0.15rem 0.35rem !important;
      font-size: 0.7rem !important;
    }
    
    .bigo-label {
      font-size: 0.7rem !important;
    }
    
    .bigo-content {
      font-size: 0.7rem !important;
    }
  }
</style>