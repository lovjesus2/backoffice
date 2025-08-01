<script>
  import { initPWA } from '$lib/pwa.js';
  import { stateManager } from '$lib/utils/stateManager.js';
  import TreeMenu from '$lib/components/TreeMenu.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import '../../app.postcss';  // Tailwind

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

<div class="min-h-screen bg-gray-50">
  <!-- 헤더 -->
  <header class="fixed left-0 right-0 h-[70px] bg-white border-b border-gray-200 flex items-center justify-between px-4 z-[100] shadow-sm
                 top-[env(safe-area-inset-top,0px)]
                 md:relative md:top-auto">
    
    <!-- 햄버거 버튼 -->
    <button class="flex flex-col justify-around w-9 h-9 bg-none border-none cursor-pointer p-1.5 rounded-md transition-colors hover:bg-gray-50
                   md:hidden
                   max-[480px]:w-8 max-[480px]:h-8 max-[480px]:p-1"
            on:click={toggleMenu}>
      <span class="w-5 h-0.5 bg-gray-800 rounded-sm transition-all duration-300 transform origin-center
                   max-[480px]:w-[18px] max-[480px]:h-0.5
                   {isMobileMenuOpen ? 'rotate-45 translate-y-[8px] max-[480px]:translate-y-[6px]' : ''}"></span>
      <span class="w-5 h-0.5 bg-gray-800 rounded-sm transition-all duration-300
                   max-[480px]:w-[18px] max-[480px]:h-0.5
                   {isMobileMenuOpen ? 'opacity-0' : ''}"></span>
      <span class="w-5 h-0.5 bg-gray-800 rounded-sm transition-all duration-300 transform origin-center
                   max-[480px]:w-[18px] max-[480px]:h-0.5
                   {isMobileMenuOpen ? '-rotate-45 -translate-y-[8px] max-[480px]:-translate-y-[6px]' : ''}"></span>
    </button>
    
    <!-- 제목과 로그아웃 버튼 -->
    <div class="flex items-center gap-3 flex-1 justify-center">
      <h1 class="m-0 text-xl font-semibold text-gray-800 max-[768px]:text-lg">백오피스</h1>
      <button class="bg-red-50 text-red-600 border border-red-200 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-all duration-200 flex items-center justify-center min-w-9 h-9 select-none
                     hover:bg-red-100 hover:border-red-300 hover:scale-105
                     active:scale-95
                     max-[768px]:min-w-8 max-[768px]:h-8 max-[768px]:text-xs"
              on:click={handleLogout} 
              title="로그아웃">⏻</button>
    </div>
    
    <!-- 사용자 정보 -->
    <div class="flex items-center gap-2 mr-[60px]
                max-[768px]:mr-[45px] max-[768px]:[&>span]:hidden
                max-[480px]:mr-[40px]">
      <span class="font-semibold text-gray-800">{user?.username}</span>
      <span class="text-gray-600">({user?.role})</span>
    </div>
  </header>

  <!-- 오버레이 -->
  {#if isMobileMenuOpen}
    <div class="fixed top-[calc(env(safe-area-inset-top,0px)+70px)] left-0 right-0 bottom-0 bg-black/50 z-[90] backdrop-blur-sm
                md:hidden" 
         on:click={closeMenu} 
         role="button" 
         tabindex="0" 
         aria-label="메뉴 닫기"></div>
  {/if}

  <!-- 사이드바 -->
  <nav class="fixed top-[calc(env(safe-area-inset-top,0px)+70px)] -left-[280px] w-[280px] h-[calc(100vh-env(safe-area-inset-top,0px)-70px)] bg-white overflow-y-auto transition-all duration-300 z-[95] shadow-xl
             md:static md:top-auto md:left-0 md:shadow-none md:border-r md:border-gray-200 md:h-[calc(100vh-70px)]
             {isMobileMenuOpen ? 'left-0' : ''}">
    
    <!-- 사이드바 헤더 (모바일만) -->
    <div class="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 md:hidden">
      <h2 class="m-0 text-lg font-semibold text-gray-800">메뉴</h2>
      <button class="bg-none border-none text-xl cursor-pointer text-gray-600 w-[35px] h-[35px] flex items-center justify-center hover:bg-gray-200"
              on:click={closeMenu} 
              aria-label="메뉴 닫기">✕</button>
    </div>
    
    <TreeMenu on:navigate={closeMenu} />
  </nav>

  <!-- 메인 콘텐츠 -->
  <main class="p-2 max-w-none mx-auto mt-[calc(env(safe-area-inset-top,0px)+70px)]
              md:mt-0 md:p-4 md:ml-[280px]
              max-[768px]:p-4
              max-[480px]:p-1">
    <slot />
  </main>
</div>

<!-- 에러 배너 스타일 (필요시 사용) -->
<style>
  .error-banner {
    @apply bg-red-100 text-red-800 p-4 rounded border border-red-200 mb-6;
  }
</style>