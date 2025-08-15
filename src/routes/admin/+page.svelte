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
    <h2>알림판</h2>
    <p>알림을 확인하세요.</p>
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
