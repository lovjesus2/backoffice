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
      console.error('검색 오류:', err);
      error = err.message;
      salesGroups = [];
      grandTotal = null;
      searchResultCount = 0;
      postSlipCount = 0;
    } finally {
      loading = false;
    }
  }

  // 폼 제출 핸들러
  function handleSubmit(event) {
    event.preventDefault();
    handleSearch();
  }
</script>

<svelte:head>
  <title>매출 조회 (SALE01) - 관리자 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

{#if user && user.role === 'admin'}
<div class="page">
  <header class="header">
    <h1>매출 조회 (SALE01)</h1>
  </header>

  <main class="content">
    <!-- 검색 폼 -->
    <form on:submit={handleSubmit}>
      <!-- 날짜 검색 -->
      <div class="form-group">
        <div class="search-row">
          <div class="search-field date-range-field">
            <label>기간:</label>
            <div class="date-inputs">
              <input type="date" bind:value={date1} required />
              <input type="date" bind:value={date2} required />
            </div>
          </div>
        </div>
      </div>

      <!-- 엽서 발송 상태 -->
      <div class="form-group">
        <fieldset class="radio-group">
          <legend>엽서 상태:</legend>
          <div class="radio-options">
            <div class="radio-option">
              <input type="radio" id="postcard_all" bind:group={postcardStatus} value="all" />
              <label for="postcard_all">전체</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="postcard_sent" bind:group={postcardStatus} value="sent" />
              <label for="postcard_sent">발송완료</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="postcard_not_sent" bind:group={postcardStatus} value="not_sent" />
              <label for="postcard_not_sent">미발송</label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- 검색 조건 -->
      <div class="form-group">
        <div class="search-row">
          <div class="search-field">
            <label>검색:</label>
            <div class="search-input-group">
              <select bind:value={searchType} class="form-control">
                <option value="name">상품명</option>
                <option value="code">상품코드</option>
                <option value="slip">매출번호</option>
              </select>
              <input 
                type="text" 
                bind:value={text1} 
                placeholder="검색어 입력"
                class="form-control search-input"
              />
              <button type="submit" disabled={loading} class="btn btn-search">
                {loading ? '검색중...' : '검색'}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </form>

    <!-- 검색 결과 -->
    {#if salesGroups.length > 0}
      <!-- 전체 합계 -->
      {#if grandTotal}
        <div class="total-card">
          <div class="total-info">
            <div class="sales-name">전체 합계</div>
            <div class="sales-qty">{formatNumber(grandTotal.totalQty)}개</div>
            <div class="sales-amount">{formatNumber(grandTotal.totalAmount)}원</div>
          </div>
        </div>
      {/if}

      <!-- 매출 그룹들 -->
      {#each salesGroups as group (group.slipNo)}
        <div class="sales-group">
          <!-- 그룹 헤더 -->
          <div class="sales-group-header">
            <div class="sales-group-title">
              <div class="sales-group-number">
                {group.slipNo}
                <span class="sales-group-count">{formatNumber(group.totalQty)}개</span>
                <div class="sales-group-date-time">
                  {group.regTime || ''}
                </div>
              </div>
              
              <!-- 현금/카드/금액 요약 -->
              <div class="sales-group-summary">
                <div class="sales-group-summary-item">
                  <span class="sales-group-summary-label">현금:</span>
                  <span>{formatNumber(group.cashAmount)}원</span>
                </div>
                <div class="sales-group-summary-item">
                  <span class="sales-group-summary-label">카드:</span>
                  <span>{formatNumber(group.cardAmount)}원</span>
                </div>
                <div class="sales-group-summary-item">
                  <span class="sales-group-summary-label">금액:</span>
                  <span>{formatNumber(group.totalAmount)}원</span>
                </div>
              </div>
            </div>

            <div class="sales-group-controls">
              <a 
                href="https://postcard.akojeju.com/receipt.php?sale_id={group.slipNo}_{group.rand || ''}" 
                target="_blank"
                class="digital-postcard {group.postSlip ? 'has-post-slip' : ''}"
              >
                엽서
              </a>
            </div>
          </div>

          <!-- 그룹에 속한 상품들 -->
          {#each group.items as item}
            <div class="sales-card">
              <!-- 재고 배지 (재고 관리 상품만) -->
              {#if item.stockManaged && item.currentStock !== undefined}
                <div 
                  class="current-stock-badge"
                  class:low-stock={item.currentStock <= 5}
                  class:medium-stock={item.currentStock > 5 && item.currentStock <= 20}
                  class:zero-stock={item.currentStock === 0}
                >
                  {item.currentStock}
                </div>
              {/if}

              <div class="sales-image">
                <img 
                  src="/proxy-images/{item.itemCode}_1.jpg"
                  alt={item.itemName}
                  class="item-image"
                  on:load={cacheImage}
                  on:error={(e) => {
                    e.target.style.display = 'none';
                    const noImageDiv = document.createElement('div');
                    noImageDiv.className = 'no-image';
                    noImageDiv.textContent = '이미지 없음';
                    e.target.parentNode.appendChild(noImageDiv);
                  }}
                />
              </div>
              <div class="sales-info">
                <div class="sales-name">{item.itemName}</div>
                <div class="product-cost">{item.itemCode}</div>
                <div class="sales-qty">{formatNumber(item.qty)}개</div>
                <div class="sales-amount">{formatNumber(item.totalAmount)}원</div>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </main>
</div>
{:else}
  <div class="auth-error">
    <div class="auth-error-content">
      <h2>🔒 접근 권한이 없습니다</h2>
      <p>이 페이지는 관리자만 접근할 수 있습니다.</p>
      <button class="btn btn-primary" on:click={() => goto('/')}>
        로그인 페이지로 이동
      </button>
    </div>
  </div>
{/if}

<style>
  /* ==========================================
   통합 스타일시트 - 월별매출조회와 완전 동일
   ========================================== */

  /* 기본 스타일 리셋 */
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

  /* ==========================================
   페이지 레이아웃
   ========================================== */

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

  /* ==========================================
   폼 및 입력 요소 스타일
   ========================================== */

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
    border: 1px solid #dee2e6;
    border-radius: 6px;
    font-size: 0.9rem;
    background-color: white;
  }

  .search-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .search-field label {
    font-weight: bold;
    color: #333;
    font-size: 0.9rem;
    white-space: nowrap;
    min-width: 2rem;
  }

  .date-range-field {
    width: 100%;
  }

  .date-inputs {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex: 1;
  }

  .date-inputs input[type="date"] {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  /* 라디오 그룹 */
  .radio-group {
    border: none;
    padding: 0;
    margin: 0;
  }

  .radio-group legend {
    font-weight: bold;
    color: #333;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    padding: 0;
  }

  .radio-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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
    display: flex;
    gap: 0.5rem;
    flex: 1;
    align-items: stretch;
  }

  .search-input {
    flex: 1;
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

  /* 버튼 스타일 */
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
  }

  .btn-search:hover {
    background: linear-gradient(135deg, #1e4f7a 0%, #164063 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(42, 105, 172, 0.35);
  }

  .btn-search:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  /* ==========================================
   카드 스타일 - 월별매출조회와 완전 동일
   ========================================== */

  .total-card {
    background-color: #f0f4f8;
    border: 1px solid #2a69ac;
    margin-bottom: 1rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .total-info {
    padding: 1rem;
  }

  .total-info .sales-name {
    font-size: 1.2rem;
    color: #2a69ac;
    margin: 0.25rem 0;
    font-weight: bold;
  }

  .total-info .sales-qty,
  .total-info .sales-amount {
    font-size: 1rem;
    font-weight: bold;
    color: #333;
    margin-top: 0.25rem;
  }

  .total-info .sales-amount {
    color: #2a69ac;
    font-size: 1.1rem;
  }

  .sales-card {
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

  .sales-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }

  .sales-image {
    flex: 0 0 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9f9f9;
    position: relative;
  }

  .sales-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .no-image {
    color: #999;
    font-size: 12px;
    text-align: center;
    padding: 20px;
  }

  .sales-info {
    flex: 1;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .sales-name {
    font-size: 1.1rem;
    margin: 0.25rem 0;
    font-weight: bold;
    color: #333;
  }

  .product-cost, .sales-qty, .sales-amount {
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .sales-amount {
    color: #2a69ac;
    font-weight: bold;
  }

  /* ==========================================
   매출 그룹 스타일 - 월별매출조회와 완전 동일
   ========================================== */

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

  .sales-group-summary {
    display: flex;
    gap: 0.75rem;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }

  .sales-group-summary-item {
    white-space: nowrap;
    display: flex;
    align-items: center;
  }

  .sales-group-summary-label {
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
    display: inline-block;
    padding: 6px 10px;
    border: 1px solid #6c757d;
    border-radius: 4px;
    color: #6c757d;
    text-decoration: none;
    font-size: 12px;
    font-weight: bold;
    white-space: nowrap;
    transition: all 0.2s ease;
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

  /* 재고 배지 - 이미지 위에 표시 */
  .current-stock-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(220, 53, 69, 0.9);
    color: white;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    min-width: 35px;
    text-align: center;
    z-index: 10;
  }

  .current-stock-badge.low-stock {
    background: rgba(255, 193, 7, 0.9);
    color: #333;
  }

  .current-stock-badge.medium-stock {
    background: rgba(255, 193, 7, 0.9);
    color: #333;
  }

  .current-stock-badge.zero-stock {
    background: rgba(108, 117, 125, 0.9);
    color: white;
  }

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

  /* 인증 에러 */
  .auth-error {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #f5f5f5;
    padding: 20px;
  }

  .auth-error-content {
    text-align: center;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    max-width: 400px;
    width: 100%;
  }

  .auth-error-content h2 {
    color: #dc3545;
    margin-bottom: 16px;
    font-size: 18px;
  }

  .auth-error-content p {
    color: #666;
    margin-bottom: 20px;
    font-size: 14px;
  }

  /* ==========================================
     반응형 스타일 - 월별매출조회와 완전 동일
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
    
    .radio-option label {
      padding: 0.45rem 0.6rem;
      font-size: 0.8rem;
      min-height: 34px;
    }
    
    .sales-group-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .sales-group-summary {
      gap: 8px;
      font-size: 0.8rem;
      flex-direction: row !important;
      flex-wrap: wrap;
    }
    
    .sales-card {
      margin-bottom: 0.5rem;
    }
    
    .sales-image {
      flex: 0 0 100px;
      height: 100px;
    }
    
    .sales-info {
      padding: 0.5rem;
    }
    
    .sales-name {
      font-size: 1rem;
    }
    
    .product-cost, .sales-qty, .sales-amount {
      font-size: 0.8rem;
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
    
    .sales-card {
      margin-bottom: 0.5rem;
    }
    
    .sales-group {
      margin-bottom: 0.6rem;
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
    
    .sales-image {
      flex: 0 0 100px;
      height: 100px;
    }
    
    .sales-info {
      padding: 0.5rem;
    }
    
    .sales-name {
      font-size: 1rem;
    }
    
    .product-cost, .sales-qty, .sales-amount {
      font-size: 0.8rem;
    }
    
    .sales-group-summary {
      gap: 4px;
      font-size: 0.75rem;
      flex-direction: row !important;
      flex-wrap: wrap;
    }
  }
</style>