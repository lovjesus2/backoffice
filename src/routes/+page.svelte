<script>
  import '../app.postcss';
  import { onMount } from 'svelte';  // ← 추가
  import { browser } from '$app/environment';  // ← 추가
  
  let username = '';
  let password = '';
  let isLoading = false;
  let errorMessage = '';

  // ← 추가: 알림 관련 변수들
  let showNotificationButton = false;
  let notificationPermission = 'default';

  async function login() {
    if (!username || !password) {
        errorMessage = '사용자명과 비밀번호를 입력해주세요.';
        return;
    }

    isLoading = true;
    errorMessage = '';

    try {
        // 🔥 모바일 디바이스 감지 (User Agent 기반)
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        const deviceType = isMobileDevice ? 'mobile' : 'web';
        
        console.log('로그인 디바이스 타입:', deviceType, '- User Agent:', navigator.userAgent);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                username, 
                password,
                deviceType // 디바이스 타입 전송
            }),
        });

        const data = await response.json();

        if (response.ok) {
            // 🔧 수정된 부분: 약간의 지연 후 리다이렉트
            //setTimeout(() => {
            //    goto('/admin', { replaceState: true });
            //}, 100);
            
            // 또는 강제 새로고침 방식
             setTimeout(() => {
                 window.location.href = '/admin';
             }, 100);
        } else {
            errorMessage = data.error || '로그인에 실패했습니다.';
        }
    } catch (error) {
        errorMessage = '서버 오류가 발생했습니다.';
    }

    isLoading = false;
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter') {
      login();
    }
  }
  // ← 추가: onMount에서 알림 상태 체크
  onMount(() => {
    if (browser && 'Notification' in window) {
      notificationPermission = Notification.permission;
      
      // 🔥 PWA 모드인지 체크
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    window.navigator.standalone ||
                    document.referrer.includes('android-app://');
      
      // PWA 모드이고 권한이 default인 경우만 버튼 표시
      showNotificationButton = isPWA && notificationPermission === 'default';
    }
  });

  // ← 추가: 알림 허용 함수
  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      notificationPermission = permission;
      
      if (permission === 'granted') {
        showNotificationButton = false;
        // 성공 피드백 (선택사항)
        errorMessage = '';
      } else {
        // 거부된 경우 메시지 (선택사항)
        console.log('알림 권한이 거부되었습니다.');
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
    }
  }
  
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>관리자 로그인</title>
</svelte:head>

<!-- 전체 화면 배경 -->
<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
  <!-- 로그인 카드 -->
  <div class="max-w-md w-full space-y-8">
    <!-- 배경 카드 -->
    <div class="bg-white rounded-lg shadow-md border border-gray-200 p-8">
      
      <!-- 로고 섹션 -->
      <div class="text-center mb-8">
        <div class="mx-auto h-12 w-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
          <span class="text-xl text-white">🔐</span>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 mb-2">관리자 시스템</h1>
        <p class="text-gray-600 text-sm">로그인이 필요합니다</p>
      </div>

      <!-- 로그인 폼 -->
      <form on:submit|preventDefault={login} class="space-y-6">
        
        <!-- 사용자명 입력 -->
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
            사용자명
          </label>
          <input
            type="text"
            id="username"
            bind:value={username}
            on:keypress={handleKeyPress}
            disabled={isLoading}
            autocomplete="username"
            placeholder="사용자명을 입력하세요"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <!-- 비밀번호 입력 -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
            비밀번호
          </label>
          <input
            type="password"
            id="password"
            bind:value={password}
            on:keypress={handleKeyPress}
            disabled={isLoading}
            autocomplete="current-password"
            placeholder="비밀번호를 입력하세요"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <!-- 알림 허용 섹션 (에러 메시지 위에 추가) -->
        {#if showNotificationButton}
          <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div class="flex items-start space-x-3">
              <span class="text-blue-500 text-xl">🔔</span>
              <div class="flex-1">
                <h3 class="text-sm font-medium text-blue-900 mb-1">알림 허용</h3>
                <p class="text-sm text-blue-700 mb-3">
                  매출 알림을 받으시려면 허용해주세요.
                </p>
                <button 
                  type="button"
                  on:click={enableNotifications}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200"
                >
                  알림 허용기
                </button>
              </div>
            </div>
          </div>
        {/if}
        <!-- 에러 메시지 -->
        {#if errorMessage}
          <div class="bg-red-50 border border-red-200 rounded-md p-3 flex items-center space-x-2">
            <span class="text-red-500">⚠️</span>
            <span class="text-red-700 text-sm">{errorMessage}</span>
          </div>
        {/if}

        <!-- 로그인 버튼 -->
        <button 
          type="submit" 
          disabled={isLoading} 
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {#if isLoading}
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>로그인 중...</span>
          {:else}
            <span>로그인</span>
          {/if}
        </button>
      </form>
    </div>
  </div>
</div>