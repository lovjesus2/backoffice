<script>
  import { initPWA } from '$lib/pwa.js';
  import { stateManager } from '$lib/utils/stateManager.js';
  import TreeMenu from '$lib/components/TreeMenu.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import '../../app.postcss';  // 👈 이 한 줄만 추가

  export let data;
  $: ({ user } = data);

  let isMobileMenuOpen = false;
  
  // 디바운스용 타이머
  let saveTimeout;

  // 디바운스된 상태 저장 (너무 자주 저장하지 않도록)
  function debouncedSave(path) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await stateManager.saveState(path);
    }, 1000); // 1초 후 저장
  }

  // 페이지 변경 시마다 상태 저장
  $: if (browser && $page.url.pathname && $page.url.pathname !== '/') {
    debouncedSave($page.url.pathname);
  }

  onMount(async () => {
    // 화면 크기 변경 감지
    const handleResize = () => {
      if (window.innerWidth > 768) {
        isMobileMenuOpen = false;
      }
    };
    window.addEventListener('resize', handleResize);
    
    // PWA 초기화
    initPWA();
    
    // 초기 로드 시 상태 복원
    const restoredPath = await stateManager.restoreState();
    if (restoredPath && restoredPath !== $page.url.pathname && restoredPath !== '/admin') {
      console.log('초기 상태 복원:', restoredPath);
      goto(restoredPath);
    }
    
    // 백그라운드 복원 감지
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    
    // 앱 종료 시 저장
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 디버깅용 (개발 시에만)
    if (import.meta.env.DEV) {
      window.getStorageInfo = () => stateManager.getStorageInfo();
      window.clearPWAState = () => stateManager.clearAll();
    }
    
    // 정리 함수
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('resize', handleResize);
      clearTimeout(saveTimeout);
    };
  });

  // 백그라운드에서 포그라운드로 복원
  async function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log('PWA 포그라운드 복원');
      const restoredPath = await stateManager.restoreState();
      if (restoredPath && restoredPath !== $page.url.pathname && restoredPath !== '/admin') {
        console.log('백그라운드 복원:', restoredPath);
        goto(restoredPath);
      }
    }
  }

  // iOS PWA 전용: 페이지 복원 감지
  async function handlePageShow(event) {
    if (event.persisted) {
      console.log('iOS PWA 캐시 복원');
      const restoredPath = await stateManager.restoreState();
      if (restoredPath && restoredPath !== $page.url.pathname) {
        goto(restoredPath);
      }
    }
  }

  // 앱 종료 시 현재 상태 저장
  async function handleBeforeUnload() {
    if ($page.url.pathname && $page.url.pathname !== '/') {
      await stateManager.saveState($page.url.pathname);
    }
  }

  function toggleMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  function closeMenu() {
    isMobileMenuOpen = false;
  }

  // 로그아웃 시 상태 정리
  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        // 저장된 상태 모두 정리
        await stateManager.clearAll();
        await goto('/');
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  }
</script>

<div class="layout">
  <!-- 헤더 -->
  <header class="header" class:menu-open={isMobileMenuOpen}>
    <button class="menu-btn" on:click={toggleMenu}>
      <span class="bar" class:open={isMobileMenuOpen}></span>
      <span class="bar" class:open={isMobileMenuOpen}></span>
      <span class="bar" class:open={isMobileMenuOpen}></span>
    </button>
    <h1>백오피스</h1>
    <div class="user-info">
      <span class="user-name">{user?.username}</span>
      <span class="user-role">({user?.role})</span>
      <button class="logout-btn" on:click={handleLogout}>로그아웃</button>
    </div>
  </header>

  <!-- 오버레이 -->
  {#if isMobileMenuOpen}
    <div class="overlay" on:click={closeMenu} role="button" tabindex="0" aria-label="메뉴 닫기"></div>
  {/if}

  <!-- 사이드바 -->
  <nav class="sidebar" class:open={isMobileMenuOpen}>
    <div class="sidebar-header">
      <h2>메뉴</h2>
      <button class="close-btn" on:click={closeMenu} aria-label="메뉴 닫기">✕</button>
    </div>
    <TreeMenu on:navigate={closeMenu} />
  </nav>

  <!-- 메인 콘텐츠 -->
  <main class="main">
    <slot />
  </main>
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .layout {
    min-height: 100vh;
    background: #f8f9fa;
  }

  /* ========== 헤더 ========== */
  .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 70px;
    background: white;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* PC: 백오피스 헤더 피하기 */
  @media (min-width: 769px) {
    .header {
      /* top: 60px; 이 줄 삭제 */
      position: relative; /* fixed에서 relative로 변경 */
      top: auto;
    }
    
    .main {
      margin-top: 0; /* 130px에서 0으로 변경 */
    }
  }

  /* iOS: 노치 처리 */
  @supports (padding: max(0px)) {
    @media (max-width: 768px) {
      .header {
        top: env(safe-area-inset-top, 0px);
      }
    }
  }

  .menu-btn {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    width: 30px;
    height: 30px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .bar {
    width: 25px;
    height: 3px;
    background: #333;
    border-radius: 2px;
    transition: all 0.3s ease;
    transform-origin: center;
  }

  .bar.open:nth-child(1) {
    transform: rotate(45deg) translate(7px, 7px);
  }

  .bar.open:nth-child(2) {
    opacity: 0;
  }

  .bar.open:nth-child(3) {
    transform: rotate(-45deg) translate(7px, -7px);
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #333;
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .user-name {
    font-weight: 600;
    color: #333;
  }

  .user-role {
    color: #666;
  }

  .logout-btn {
    padding: 0.5rem 1rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .logout-btn:hover {
    background: #c82333;
  }

  /* ========== 오버레이 ========== */
  .overlay {
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 90;
    backdrop-filter: blur(2px);
  }

  /* iOS: 오버레이 노치 처리 */
  @supports (padding: max(0px)) {
    @media (max-width: 768px) {
      .overlay {
        top: calc(70px + env(safe-area-inset-top, 0px));
      }
    }
  }

  /* ========== 사이드바 ========== */
  .sidebar {
    position: fixed;
    top: 70px;
    left: -280px;
    width: 280px;
    height: calc(100vh - 70px);
    background: white;
    overflow-y: auto;
    transition: left 0.3s ease;
    z-index: 95;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  }

  /* iOS: 사이드바 노치 처리 */
  @supports (padding: max(0px)) {
    @media (max-width: 768px) {
      .sidebar {
        top: calc(70px + env(safe-area-inset-top, 0px));
        height: calc(100vh - 70px - env(safe-area-inset-top, 0px));
      }
    }
  }

  .sidebar.open {
    left: 0;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #dee2e6;
    background: #f8f9fa;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #666;
    width: 35px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #e9ecef;
  }

  .main {
    padding: 0.5rem;
    max-width: none;
    margin: 0 auto;
    margin-top: 70px;
  }

  /* PC: 메인 영역 */
  @media (min-width: 769px) {
    .main {
      margin-top: 130px; /* 백오피스 헤더(60px) + 메뉴 헤더(70px) */
    }
  }

  /* iOS: 메인 영역 노치 처리 */
  @supports (padding: max(0px)) {
    @media (max-width: 768px) {
      .main {
        margin-top: calc(70px + env(safe-area-inset-top, 0px));
      }
    }
  }

  .error-banner {
    background: #f8d7da;
    color: #721c24;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
    border: 1px solid #f5c6cb;
  }

  /* ========== 데스크톱 ========== */
  @media (min-width: 769px) {
    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      grid-template-rows: auto 1fr;
      grid-template-areas: 
        "header header"
        "sidebar main";
    }

    .header {
      grid-area: header;
      z-index: 50;
    }

    .menu-btn {
      display: none;
    }

    .overlay {
      display: none !important;
    }

    .sidebar {
      grid-area: sidebar;
      position: sticky;
      top: 130px; /* 백오피스 헤더(60px) + 메뉴 헤더(70px) */
      height: calc(100vh - 130px);
      left: 0;
      z-index: 10;
      box-shadow: none;
      border-right: 1px solid #dee2e6;
    }

    .sidebar-header {
      display: none;
    }

    .main {
      grid-area: main;
      padding: 1rem;
      max-width: none;
      margin: 0;
      margin-top: 0;
    }
  }

  /* ========== 모바일 ========== */
  @media (max-width: 768px) {
    .overlay {
      display: block;
    }

    .user-name, .user-role {
      display: none;
    }

    .main {
      padding: 1rem;
    }
  }

  @media (max-width: 480px) {
    .header {
      padding: 0.8rem;
    }
    
    h1 {
      font-size: 1.1rem;
    }
    
    .main {
      padding: 0.1rem;
    }

    .sidebar {
      width: 280px;
    }
  }
</style>