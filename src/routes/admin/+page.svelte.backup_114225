<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let stats = {
    users: 0,
    posts: 0,
    views: 0,
    revenue: 0
  };

  let isMobile = false;

  onMount(async () => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    // 실제 데이터로 교체 예정
    stats = {
      users: 1247,
      posts: 89,
      views: 12543,
      revenue: 15690
    };

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  });

  function checkScreenSize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
    }
  }
</script>

<svelte:head>
  <title>관리자 대시보드</title>
</svelte:head>

<div class="dashboard" class:mobile={isMobile}>
  <div class="page-header">
    <h2>📊 대시보드</h2>
    <p>시스템 현황을 한눈에 확인하세요</p>
  </div>

  <div class="stats-grid" class:mobile={isMobile}>
    <div class="stat-card users">
      <div class="stat-icon">👥</div>
      <div class="stat-content">
        <h3>사용자</h3>
        <div class="stat-number">{stats.users.toLocaleString()}</div>
        <div class="stat-change">+12% 이번 달</div>
      </div>
    </div>

    <div class="stat-card posts">
      <div class="stat-icon">📝</div>
      <div class="stat-content">
        <h3>게시글</h3>
        <div class="stat-number">{stats.posts.toLocaleString()}</div>
        <div class="stat-change">+5% 이번 달</div>
      </div>
    </div>

    <div class="stat-card views">
      <div class="stat-icon">👁️</div>
      <div class="stat-content">
        <h3>페이지 뷰</h3>
        <div class="stat-number">{stats.views.toLocaleString()}</div>
        <div class="stat-change">+18% 이번 달</div>
      </div>
    </div>

    <div class="stat-card revenue">
      <div class="stat-icon">💰</div>
      <div class="stat-content">
        <h3>수익</h3>
        <div class="stat-number">₩{stats.revenue.toLocaleString()}</div>
        <div class="stat-change">+22% 이번 달</div>
      </div>
    </div>
  </div>

  <div class="dashboard-content" class:mobile={isMobile}>
    <div class="left-panel">
      <div class="panel recent-activity">
        <h3>🔔 최근 활동</h3>
        <div class="activity-list">
          <div class="activity-item">
            <div class="activity-time">10분 전</div>
            <div class="activity-text">새로운 사용자가 가입했습니다.</div>
          </div>
          <div class="activity-item">
            <div class="activity-time">30분 전</div>
            <div class="activity-text">게시글 "공지사항"이 게시되었습니다.</div>
          </div>
          <div class="activity-item">
            <div class="activity-time">1시간 전</div>
            <div class="activity-text">시스템 백업이 완료되었습니다.</div>
          </div>
          <div class="activity-item">
            <div class="activity-time">2시간 전</div>
            <div class="activity-text">댓글 5개가 새로 달렸습니다.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="right-panel">
      <div class="panel quick-actions">
        <h3>⚡ 빠른 작업</h3>
        <div class="action-buttons" class:mobile={isMobile}>
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a href="#" on:click|preventDefault={() => window.location.href = '/admin/users'} class="action-btn">
            <div class="btn-icon">👥</div>
            <div class="btn-text">사용자 관리</div>
          </a>
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a href="#" on:click|preventDefault={() => window.location.href = '/admin/content/posts'} class="action-btn">
            <div class="btn-icon">📝</div>
            <div class="btn-text">게시글 작성</div>
          </a>
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a href="#" on:click|preventDefault={() => window.location.href = '/admin/system/settings'} class="action-btn">
            <div class="btn-icon">⚙️</div>
            <div class="btn-text">시스템 설정</div>
          </a>
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a href="#" on:click|preventDefault={() => window.location.href = '/admin/system/logs'} class="action-btn">
            <div class="btn-icon">📋</div>
            <div class="btn-text">로그 확인</div>
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .dashboard {
    max-width: 1200px;
  }

  .dashboard.mobile {
    max-width: none;
  }

  .page-header {
    margin-bottom: 25px;
  }

  .page-header h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    color: #2c3e50;
  }

  .page-header p {
    margin: 0;
    color: #7f8c8d;
    font-size: 14px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
  }

  .stats-grid.mobile {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }

  .stat-card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 15px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .stat-card:active {
    transform: scale(0.98);
  }

  .stat-icon {
    font-size: 32px;
    padding: 12px;
    border-radius: 50%;
    background: #f8f9fa;
    flex-shrink: 0;
  }

  .users .stat-icon { background: #e3f2fd; }
  .posts .stat-icon { background: #f3e5f5; }
  .views .stat-icon { background: #e8f5e8; }
  .revenue .stat-icon { background: #fff3e0; }

  .stat-content h3 {
    margin: 0 0 5px 0;
    font-size: 12px;
    color: #7f8c8d;
    text-transform: uppercase;
    font-weight: 600;
  }

  .stat-number {
    font-size: 24px;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 3px;
  }

  .stat-change {
    font-size: 12px;
    color: #27ae60;
    font-weight: 500;
  }

  .dashboard-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .dashboard-content.mobile {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .panel {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .panel h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #2c3e50;
  }

  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .activity-item {
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #3498db;
  }

  .activity-time {
    font-size: 11px;
    color: #7f8c8d;
    margin-bottom: 4px;
  }

  .activity-text {
    color: #2c3e50;
    font-weight: 500;
    font-size: 13px;
    line-height: 1.4;
  }

  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .action-buttons.mobile {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    text-decoration: none;
    transition: background-color 0.2s, transform 0.1s;
    min-height: 44px;
    justify-content: center;
  }

  .action-btn:hover, .action-btn:focus {
    background: #e9ecef;
    outline: none;
  }

  .action-btn:active {
    transform: scale(0.98);
  }

  .btn-icon {
    font-size: 20px;
    margin-bottom: 6px;
  }

  .btn-text {
    font-size: 13px;
    color: #2c3e50;
    font-weight: 500;
    text-align: center;
  }

  /* 모바일 추가 스타일 */
  @media (max-width: 768px) {
    .page-header h2 {
      font-size: 20px;
    }
    
    .stat-card {
      padding: 15px;
      gap: 12px;
    }
    
    .stat-icon {
      font-size: 28px;
      padding: 10px;
    }
    
    .stat-number {
      font-size: 20px;
    }
    
    .panel {
      padding: 15px;
    }
    
    .panel h3 {
      font-size: 15px;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }
    
    .stat-card {
      flex-direction: column;
      text-align: center;
      padding: 12px;
    }
    
    .stat-icon {
      margin-bottom: 8px;
    }
    
    .stat-content h3 {
      font-size: 11px;
    }
    
    .stat-number {
      font-size: 18px;
    }
  }
</style>
