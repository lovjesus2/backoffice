<script>
  import { goto } from '$app/navigation';
  import '../app.postcss';
  
  let username = '';
  let password = '';
  let isLoading = false;
  let errorMessage = '';

  async function login() {
    if (!username || !password) {
      errorMessage = '사용자명과 비밀번호를 입력해주세요.';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        goto('/admin');
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