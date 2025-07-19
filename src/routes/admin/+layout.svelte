<!-- src/routes/admin/+layout.svelte -->
<script>
  import { initPWA } from '$lib/pwa.js';
  import TreeMenu from '$lib/components/TreeMenu.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let data;
  $: ({ user } = data);

  let isMobileMenuOpen = false;

  onMount(() => {
    if (!browser) return;
    
    const handleResize = () => {
      if (browser && window.innerWidth > 768) {
        isMobileMenuOpen = false;
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // PWA 초기화
    initPWA();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  function toggleMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  function closeMenu() {
    isMobileMenuOpen = false;
  }

  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
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
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="overlay" on:click={closeMenu}></div>
  {/if}

  <!-- 사이드바 -->
  <aside class="sidebar" class:open={isMobileMenuOpen}>
    <div class="sidebar-content">
      <TreeMenu />
    </div>
  </aside>

  <!-- 메인 컨텐츠 -->
  <main class="main-content">
    <slot />
  </main>
</div>

<!-- 나머지 스타일은 기존과 동일 -->

<style>
  /* PWA 노치 대응 CSS 변수 */
  :root {
    --safe-area-top: env(safe-area-inset-top, 0px);
  }

  .layout {
    min-height: 100vh;
    background: #f5f5f5;
    padding-top: var(--safe-area-top);
  }

  /* ========== 헤더 ========== */
  .header {
    background: #007bff;
    color: white;
    padding: 1rem;
    padding-top: calc(1rem + var(--safe-area-top)); /* ← 이 줄 추가 */
    display: flex;
    align-items: center;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 50;
    transition: z-index 0.3s;
  }

  /* 모바일 메뉴가 열렸을 때 헤더 z-index 낮추기 */
  .header.menu-open {
    z-index: 98;
  }

  /* ========== 햄버거 버튼 ========== */
  .menu-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    width: 40px;
    height: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 4px;
  }

  .menu-btn:hover {
    background: rgba(255,255,255,0.1);
  }

  .bar {
    width: 20px;
    height: 2px;
    background: white;
    transition: all 0.3s;
    border-radius: 1px;
  }

  .bar.open:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
  }

  .bar.open:nth-child(2) {
    opacity: 0;
  }

  .bar.open:nth-child(3) {
    transform: rotate(-45deg) translate(7px, -6px);
  }

  h1 {
    margin: 0;
    font-size: 1.2rem;
    flex: 1;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .user-name {
    font-weight: 600;
  }

  .user-role {
    color: #cce7ff;
    font-size: 0.8rem;
  }

  .logout-btn {
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: rgba(255,255,255,0.3);
  }

  /* ========== 오버레이 ========== */
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
    display: none;
  }

  /* ========== 사이드바 ========== */
  .sidebar {
    position: fixed;
    top: var(--safe-area-top); /* ← 이 줄 수정 */
    left: -300px;
    width: 300px;
    height: calc(100vh - var(--safe-area-top)); /* ← 이 줄 수정 */
    background: white;
    z-index: 100;
    transition: left 0.3s ease;
    box-shadow: 2px 0 20px rgba(0,0,0,0.1);
    overflow-y: auto;
  }

  .sidebar.open {
    left: 0;
  }

  .sidebar-header {
    background: #f8f9fa;
    padding: 1rem;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.1rem;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0.5rem;
    border-radius: 4px;
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
      top: 70px;
      height: calc(100vh - 70px);
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