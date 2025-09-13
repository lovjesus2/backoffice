<script>
  import { initPWA } from '$lib/pwa.js';
  import { stateManager } from '$lib/utils/stateManager.js';
  import TreeMenu from '$lib/components/TreeMenu.svelte';
  import ImageModal from '$lib/components/ImageModal.svelte';
  import { imageModalStore, initAutoImageModal } from '$lib/utils/imageModalUtils';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import '../../app.postcss';  // Tailwind

  export let data;
  $: ({ user } = data);

  let isMobileMenuOpen = false;
  let isPcSidebarOpen = true; // PC 사이드바 상태 추가
  
  // 디바운스용 타이머
  let saveTimeout;
  
  // 자동 이미지 모달 정리 함수
  let cleanupImageModal;

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

  // 이미지 모달 닫기 핸들러
  function handleImageModalClose() {
    imageModalStore.update(state => ({
      ...state,
      show: false
    }));
  }



// +layout.svelte의 onMount 부분 (중복 초기화 방지)

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
  
  // 자동 이미지 모달 초기화
  if (browser) {
    cleanupImageModal = initAutoImageModal(true);
  }
  
  // PC 사이드바 상태 복원
  if (browser) {
    const savedPcSidebar = localStorage.getItem('pcSidebarOpen');
    if (savedPcSidebar) {
      isPcSidebarOpen = JSON.parse(savedPcSidebar);
    }
  }
  
  // 초기 로드 시 상태 복원
  const restoredPath = await stateManager.restoreState();
  if (restoredPath && restoredPath !== $page.url.pathname) {
    goto(restoredPath);
  }

  // 🔥 Firebase Messaging 초기화 (중복 방지)
  if (typeof window !== 'undefined') {
    // 🚫 중복 초기화 방지 체크
    if (window.__firebaseMessagingInitialized) {
      console.log('ℹ️ Firebase Messaging 이미 초기화됨');
      return;
    }
    
    console.log('🔥 Firebase Messaging 초기화 시작...');
    
    try {
      // Service Worker 지원 확인
      if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker를 지원하지 않는 브라우저');
        return;
      }
      
      // Firebase 푸시 모듈 로드
      const { getFCMToken, setupForegroundMessaging } = await import('$lib/utils/pushNotification.js');
      console.log('✅ Firebase 푸시 모듈 로드 성공');
      
      // FCM 토큰 획득
      const fcmToken = await getFCMToken();
      
      if (fcmToken) {
        console.log('✅ FCM 토큰 획득 성공');
        
        // 🔥 중복 초기화 방지 플래그 설정
        window.__firebaseMessagingInitialized = true;
        
        // 포그라운드 메시징 설정 (한번만)
        setupForegroundMessaging();
        console.log('✅ 포그라운드 메시징 설정 완료');
        
        // 서버에 토큰 저장
        try {
          const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              token: fcmToken,
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                timestamp: new Date().toISOString(),
                url: window.location.href
              }
            })
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            console.log('✅ FCM 토큰 서버 저장 성공');
          } else {
            console.warn('⚠️ FCM 토큰 서버 저장 실패:', result.message);
          }
          
        } catch (saveError) {
          console.error('❌ FCM 토큰 서버 저장 오류:', saveError);
        }
        
      } else {
        console.warn('⚠️ FCM 토큰 획득 실패');
      }
      
    } catch (error) {
      console.error('❌ Firebase Messaging 초기화 실패:', error);
    }
  }

  // cleanup 함수
  return () => {
    window.removeEventListener('resize', handleResize);
    if (cleanupImageModal) {
      cleanupImageModal();
    }
  };
});

// 🔥 페이지 언로드 시 초기화 플래그 리셋 (선택사항)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // 다음 페이지 로드 시 다시 초기화할 수 있도록
    // window.__firebaseMessagingInitialized = false;
  });
}

// 🔄 페이지 가시성 변경 시 Service Worker 상태 체크
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && 'serviceWorker' in navigator) {
      // 페이지가 다시 보일 때 Service Worker 업데이트 체크
      navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').then(registration => {
        if (registration && registration.waiting) {
          console.log('🔄 페이지 복귀 시 Service Worker 업데이트 감지');
          if (confirm('앱 업데이트가 있습니다. 적용하시겠습니까?')) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    }
  });
}

// 🔥 페이지 언로드 시 초기화 플래그 리셋 (선택사항)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // 다음 페이지 로드 시 다시 초기화할 수 있도록
    // window.__firebaseMessagingInitialized = false;
  });
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

  // PC 사이드바 토글 함수 + localStorage 저장
  function togglePcSidebar() {
    isPcSidebarOpen = !isPcSidebarOpen;
    
    // localStorage에 저장
    if (browser) {
      localStorage.setItem('pcSidebarOpen', JSON.stringify(isPcSidebarOpen));
    }
  }

  // 로그아웃 시 상태 정리
  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        // 저장된 상태 모두 정리
        await stateManager.clearAll();
        
        // PC 사이드바 상태도 초기화
        if (browser) {
          localStorage.removeItem('pcSidebarOpen');
        }
        
        await goto('/');
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- 헤더 -->
  <header class="fixed left-0 right-0 h-[var(--header-height)] bg-white border-b border-gray-200 flex items-center justify-between px-4 z-[100] shadow-sm
                 top-[var(--safe-area-top)]">
    
    <!-- 햄버거 버튼 (모바일) -->
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

    <!-- PC 햄버거 버튼 추가 -->
    <button class="hidden md:flex flex-col justify-around w-9 h-9 bg-none border-none cursor-pointer p-1.5 rounded-md transition-colors hover:bg-gray-50"
            on:click={togglePcSidebar}>
      <span class="w-5 h-0.5 bg-gray-800 rounded-sm"></span>
      <span class="w-5 h-0.5 bg-gray-800 rounded-sm"></span>
      <span class="w-5 h-0.5 bg-gray-800 rounded-sm"></span>
    </button>
    
    <!-- 제목과 로그아웃 버튼 -->
    <div class="flex items-center gap-2 flex-1 justify-center">
      <h1 class="m-0 text-lg font-semibold text-gray-800 max-[768px]:text-base">백오피스</h1>
      <button class="bg-red-50 text-red-600 border border-red-200 rounded-lg px-1.5 py-1 text-sm cursor-pointer transition-all duration-200 flex items-center justify-center min-w-8 h-8 select-none
                    hover:bg-red-100 hover:border-red-300 hover:scale-105
                    active:scale-95
                    max-[768px]:min-w-7 max-[768px]:h-7 max-[768px]:text-xs"
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
    <div class="fixed top-[var(--header-total-height)] left-0 right-0 bottom-0 bg-black/50 z-[90] backdrop-blur-sm
                md:hidden" 
         on:click={closeMenu} 
         role="button" 
         tabindex="0" 
         aria-label="메뉴 닫기"></div>
  {/if}

  <!-- 사이드바 -->
  <nav class="fixed top-[var(--header-total-height)] -left-[280px] w-[280px] h-[calc(100vh-env(safe-area-inset-top,0px)-var(--header-height))] bg-white overflow-y-auto transition-all duration-300 z-[95] shadow-xl
             md:fixed md:top-[var(--header-height)] {isPcSidebarOpen ? 'md:left-0' : 'md:-left-[280px]'} md:shadow-none md:border-r md:border-gray-200 md:h-[calc(100vh-70px)]
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
  <main class="p-2 max-w-none mx-auto mt-[var(--header-total-height)]
              md:mt-[var(--header-height)] md:p-4 {isPcSidebarOpen ? 'md:ml-[280px]' : 'md:ml-0'} transition-all duration-300
              max-[768px]:p-4
              max-[480px]:p-1">
    <slot />
  </main>
</div>

<!-- 글로벌 이미지 확대 모달 -->
<ImageModal 
  show={$imageModalStore.show}
  imageSrc={$imageModalStore.imageSrc}
  imageAlt={$imageModalStore.imageAlt}
  zIndex={$imageModalStore.zIndex}
  on:close={handleImageModalClose}
/>

<!-- 에러 배너 스타일 (필요시 사용) -->
<style>
  .error-banner {
    @apply bg-red-100 text-red-800 p-4 rounded border border-red-200 mb-6;
  }
</style>