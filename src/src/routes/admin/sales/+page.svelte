<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let recentStats = {
    todaySales: 0,
    yesterdaySales: 0,
    thisMonthSales: 0,
    lastMonthSales: 0
  };
  let loading = false;

  onMount(() => {
    loadRecentStats();
  });

  async function loadRecentStats() {
    loading = true;
    try {
      // 오늘과 어제, 이번달과 지난달 매출 요약 데이터 로드
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // 오늘 매출
      const todayResponse = await fetch(`/api/sales/monthly?date1=${todayStr}&date2=${todayStr}&sort=amt`);
      const todayResult = await todayResponse.json();
      if (todayResult.success) {
        recentStats.todaySales = todayResult.summary.totalAmt;
      }

      // 어제 매출
      const yesterdayResponse = await fetch(`/api/sales/monthly?date1=${yesterdayStr}&date2=${yesterdayStr}&sort=amt`);
      const yesterdayResult = await yesterdayResponse.json();
      if (yesterdayResult.success) {
        recentStats.yesterdaySales = yesterdayResult.summary.totalAmt;
      }

      // 이번달 매출 (1일부터 오늘까지)
      const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const thisMonthResponse = await fetch(`/api/sales/monthly?date1=${thisMonthStart}&date2=${todayStr}&sort=amt`);
      const thisMonthResult = await thisMonthResponse.json();
      if (thisMonthResult.success) {
        recentStats.thisMonthSales = thisMonthResult.summary.totalAmt;
      }

      // 지난달 매출 (지난달 전체)
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      const lastMonthStartStr = lastMonth.toISOString().split('T')[0];
      const lastMonthEndStr = lastMonthEnd.toISOString().split('T')[0];
      
      const lastMonthResponse = await fetch(`/api/sales/monthly?date1=${lastMonthStartStr}&date2=${lastMonthEndStr}&sort=amt`);
      const lastMonthResult = await lastMonthResponse.json();
      if (lastMonthResult.success) {
        recentStats.lastMonthSales = lastMonthResult.summary.totalAmt;
      }

    } catch (error) {
      console.error('최근 통계 로드 오류:', error);
    } finally {
      loading = false;
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  }

  function getGrowthRate(current, previous) {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const rate = ((current - previous) / previous) * 100;
    return (rate >= 0 ? '+' : '') + rate.toFixed(1) + '%';
  }

  function getGrowthClass(current, previous) {
    if (current > previous) return 'growth-positive';
    if (current < previous) return 'growth-negative';
    return 'growth-neutral';
  }
</script>

<svelte:head>
  <title>매출 관리 - 관리자 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="sales-index">
  <!-- 헤더 -->
  <div class="page-header">
    <button class="back-btn" on:click={() => goto('/admin')}>
      ← 대시보드
    </button>
    <h1>📊 매출 관리</h1>
  </div>

  <!-- 최근 매출 요약 -->
  <div class="stats-section">
    <h2>📈 최근 매출 현황</h2>
    {#if loading}
      <div class="loading-stats">
        <div class="loading-spinner"></div>
        <p>데이터 로딩 중...</p>
      </div>
    {:else}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <h3>오늘 매출</h3>
            <span class="stat-icon">📅</span>
          </div>
          <div class="stat-value">{formatCurrency(recentStats.todaySales)}</div>
          <div class="stat-comparison">
            <span class={getGrowthClass(recentStats.todaySales, recentStats.yesterdaySales)}>
              {getGrowthRate(recentStats.todaySales, recentStats.yesterdaySales)}
            </span>
            <span class="comparison-label">vs 어제</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <h3>어제 매출</h3>
            <span class="stat-icon">📋</span>
          </div>
          <div class="stat-value">{formatCurrency(recentStats.yesterdaySales)}</div>
          <div class="stat-description">전일 총 매출액</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <h3>이번달 매출</h3>
            <span class="stat-icon">📊</span>
          </div>
          <div class="stat-value">{formatCurrency(recentStats.thisMonthSales)}</div>
          <div class="stat-comparison">
            <span class={getGrowthClass(recentStats.thisMonthSales, recentStats.lastMonthSales)}>
              {getGrowthRate(recentStats.thisMonthSales, recentStats.lastMonthSales)}
            </span>
            <span class="comparison-label">vs 지난달</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <h3>지난달 매출</h3>
            <span class="stat-icon">📈</span>
          </div>
          <div class="stat-value">{formatCurrency(recentStats.lastMonthSales)}</div>
          <div class="stat-description">전월 총 매출액</div>
        </div>
      </div>
    {/if}
  </div>

  <!-- 메뉴 섹션 -->
  <div class="menu-section">
    <h2>🛠️ 매출 관리 도구</h2>
    <div class="menu-grid">
      <button class="menu-card" on:click={() => goto('/admin/sales/monthly')}>
        <div class="menu-icon">🔍</div>
        <div class="menu-content">
          <h3>BEST 매출 조회</h3>
          <p>기간별 상품 매출 순위를 확인하세요</p>
          <div class="menu-features">
            <span class="feature-tag">상품별 순위</span>
            <span class="feature-tag">재고 현황</span>
            <span class="feature-tag">검색 필터</span>
          </div>
        </div>
        <div class="menu-arrow">→</div>
      </button>

      <button class="menu-card" on:click={() => goto('/admin/sales/calendar')}>
        <div class="menu-icon">📅</div>
        <div class="menu-content">
          <h3>매출 캘린더</h3>
          <p>일별 매출 현황을 캘린더로 확인하세요</p>
          <div class="menu-features">
            <span class="feature-tag">일별 매출</span>
            <span class="feature-tag">상세 내역</span>
            <span class="feature-tag">월별 통계</span>
          </div>
        </div>
        <div class="menu-arrow">→</div>
      </button>

      <!-- 추후 확장 가능한 메뉴들 -->
      <div class="menu-card coming-soon">
        <div class="menu-icon">📈</div>
        <div class="menu-content">
          <h3>매출 분석</h3>
          <p>매출 트렌드와 분석 리포트</p>
          <div class="coming-soon-badge">Coming Soon</div>
        </div>
      </div>

      <div class="menu-card coming-soon">
        <div class="menu-icon">📊</div>
        <div class="menu-content">
          <h3>대시보드</h3>
          <p>실시간 매출 모니터링</p>
          <div class="coming-soon-badge">Coming Soon</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 빠른 액션 -->
  <div class="quick-actions">
    <h2>⚡ 빠른 액션</h2>
    <div class="action-buttons">
      <button class="action-btn primary" on:click={() => goto('/admin/sales/monthly')}>
        <span class="action-icon">🔍</span>
        오늘 매출 확인
      </button>
      
      <button class="action-btn secondary" on:click={() => goto('/admin/sales/calendar')}>
        <span class="action-icon">📅</span>
        이번달 캘린더
      </button>
      
      <button class="action-btn tertiary" on:click={loadRecentStats}>
        <span class="action-icon">🔄</span>
        데이터 새로고침
      </button>
    </div>
  </div>
</div>

<style>
  .sales-index {
    max-width: 1200px;
    margin: 0 auto;
    padding: 10px 5px;
    background-color: #f8f9fa;
    min-height: 100vh;
  }

  /* 페이지 헤더 */
  .page-header {
    display: flex;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    margin-bottom: 20px;
    color: white;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .back-btn {
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    margin-right: 16px;
    backdrop-filter: blur(10px);
    transition: background 0.2s;
  }

  .back-btn:hover {
    background: rgba(255,255,255,0.3);
  }

  .page-header h1 {
    font-size: 24px;
    margin: 0;
    text-align: center;
    flex: 1;
    font-weight: 600;
  }

  /* 통계 섹션 */
  .stats-section {
    margin-bottom: 30px;
  }

  .stats-section h2 {
    font-size: 20px;
    margin-bottom: 16px;
    color: #333;
    font-weight: 600;
  }

  .loading-stats {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .stat-card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  }

  .stat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .stat-header h3 {
    font-size: 14px;
    color: #666;
    margin: 0;
    font-weight: 500;
  }

  .stat-icon {
    font-size: 20px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #333;
    margin-bottom: 8px;
  }

  .stat-comparison {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .growth-positive {
    color: #28a745;
    font-weight: 600;
  }

  .growth-negative {
    color: #dc3545;
    font-weight: 600;
  }

  .growth-neutral {
    color: #6c757d;
    font-weight: 600;
  }

  .comparison-label {
    color: #999;
  }

  .stat-description {
    font-size: 12px;
    color: #999;
  }

  /* 메뉴 섹션 */
  .menu-section {
    margin-bottom: 30px;
  }

  .menu-section h2 {
    font-size: 20px;
    margin-bottom: 16px;
    color: #333;
    font-weight: 600;
  }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .menu-card {
    background: white;
    border: none;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    position: relative;
  }

  .menu-card:hover:not(.coming-soon) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  }

  .menu-card.coming-soon {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .menu-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .menu-content {
    flex: 1;
  }

  .menu-content h3 {
    font-size: 18px;
    margin: 0 0 8px 0;
    color: #333;
    font-weight: 600;
  }

  .menu-content p {
    font-size: 14px;
    color: #666;
    margin: 0 0 12px 0;
    line-height: 1.4;
  }

  .menu-features {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .feature-tag {
    background: #e9ecef;
    color: #495057;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
  }

  .menu-arrow {
    font-size: 20px;
    color: #007bff;
    align-self: center;
    transition: transform 0.2s;
  }

  .menu-card:hover:not(.coming-soon) .menu-arrow {
    transform: translateX(4px);
  }

  .coming-soon-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #ffc107;
    color: #333;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
  }

  /* 빠른 액션 */
  .quick-actions {
    margin-bottom: 30px;
  }

  .quick-actions h2 {
    font-size: 20px;
    margin-bottom: 16px;
    color: #333;
    font-weight: 600;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn.primary {
    background: #007bff;
    color: white;
  }

  .action-btn.primary:hover {
    background: #0056b3;
  }

  .action-btn.secondary {
    background: #28a745;
    color: white;
  }

  .action-btn.secondary:hover {
    background: #1e7e34;
  }

  .action-btn.tertiary {
    background: #6c757d;
    color: white;
  }

  .action-btn.tertiary:hover {
    background: #545b62;
  }

  .action-icon {
    font-size: 16px;
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .sales-index {
      padding: 5px 2px;
    }

    .page-header {
      padding: 16px;
      margin-bottom: 16px;
    }

    .page-header h1 {
      font-size: 20px;
    }

    .back-btn {
      padding: 8px 12px;
      font-size: 13px;
    }

    .stats-section h2,
    .menu-section h2,
    .quick-actions h2 {
      font-size: 18px;
      margin-bottom: 12px;
    }

    .stats-grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .stat-card {
      padding: 16px;
    }

    .stat-value {
      font-size: 20px;
    }

    .menu-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .menu-card {
      padding: 20px;
      gap: 12px;
    }

    .menu-icon {
      font-size: 28px;
    }

    .menu-content h3 {
      font-size: 16px;
    }

    .action-buttons {
      flex-direction: column;
    }

    .action-btn {
      justify-content: center;
      padding: 14px 20px;
    }
  }

  /* 아이폰 Safe Area 지원 */
  @supports (padding: max(0px)) {
    .sales-index {
      padding-left: max(5px, env(safe-area-inset-left));
      padding-right: max(5px, env(safe-area-inset-right));
      padding-bottom: max(10px, env(safe-area-inset-bottom));
    }
  }

  /* 터치 최적화 */
  .menu-card,
  .action-btn,
  .back-btn {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
</style>