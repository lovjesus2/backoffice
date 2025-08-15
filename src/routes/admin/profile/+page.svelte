<script>
  import { onMount } from 'svelte';

  let user = {};
  let username = '';
  let email = '';
  let loading = true;
  let saving = false;
  let changingPassword = false;
  let message = '';
  let messageType = '';

  // 비밀번호 변경 관련
  let showPasswordForm = false;
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';

  // 프로필 불러오기
  async function loadProfile() {
    try {
      const response = await fetch('/api/profile');
      const data = await response.json();
      
      if (data.success) {
        user = data.data;  // API 응답 구조에 맞게 수정
        username = user.username;
        email = user.email || '';
      } else {
        showMessage(data.error || '프로필을 불러올 수 없습니다.', 'error');
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
      showMessage('프로필을 불러올 수 없습니다.', 'error');
    } finally {
      loading = false;
    }
  }

  // 프로필 업데이트
  async function updateProfile() {
    if (!username.trim() || !email.trim()) {
      showMessage('사용자명과 이메일을 입력해주세요.', 'error');
      return;
    }

    saving = true;
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        user = data.data;  // API 응답 구조에 맞게 수정
        username = user.username;
        email = user.email || '';
        showMessage('프로필이 성공적으로 업데이트되었습니다.', 'success');
      } else {
        showMessage(data.error || '프로필 업데이트에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      showMessage('프로필 업데이트에 실패했습니다.', 'error');
    } finally {
      saving = false;
    }
  }

  // 비밀번호 변경
  async function changePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('모든 비밀번호 필드를 입력해주세요.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showMessage('비밀번호는 최소 6자 이상이어야 합니다.', 'error');
      return;
    }

    changingPassword = true;
    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage('비밀번호가 성공적으로 변경되었습니다.', 'success');
        // 폼 초기화
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        showPasswordForm = false;
      } else {
        showMessage(data.error || '비밀번호 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      showMessage('비밀번호 변경에 실패했습니다.', 'error');
    } finally {
      changingPassword = false;
    }
  }

  // 메시지 표시
  function showMessage(text, type) {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 4000);
  }

  // 비밀번호 폼 토글
  function togglePasswordForm() {
    showPasswordForm = !showPasswordForm;
    if (!showPasswordForm) {
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    }
  }

  let isMobile = false;
  
  onMount(() => {
    loadProfile();
    
    // 모바일 체크
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });
</script>

<svelte:head>
  <title>내 정보 - 관리자 백오피스</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 p-4 md:p-6">
  <!-- 헤더 -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 flex items-center gap-3">
      <span class="text-blue-600">👤</span>
      내 정보
    </h1>
    <p class="text-gray-600 mt-2">계정 정보를 관리하고 비밀번호를 변경할 수 있습니다</p>
  </div>

  <!-- 메시지 토스트 -->
  {#if message}
    <div class="fixed top-32 z-50 transition-all duration-300 {message ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}" 
         style="left: {isMobile ? '50%' : 'calc(50% + 128px)'}; transform: translateX(-50%);">
      <div class="flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl {messageType === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white min-w-80 max-w-sm">
        <span class="text-xl">
          {messageType === 'success' ? '✅' : '❌'}
        </span>
        <span class="text-sm font-medium">{message}</span>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex flex-col items-center justify-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="text-gray-600 mt-4">프로필을 불러오는 중...</p>
    </div>
  {:else}
    <div class="max-w-4xl mx-auto grid gap-6 lg:grid-cols-2">
      <!-- 프로필 정보 카드 -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <h2 class="text-xl font-semibold text-white flex items-center gap-2">
            <span>🔧</span>
            기본 정보
          </h2>
        </div>
        
        <div class="p-6 space-y-6">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-2">사용자명</label>
            <input 
              type="text" 
              id="username"
              bind:value={username}
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="사용자명을 입력하세요"
            />
          </div>
          
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input 
              type="email" 
              id="email"
              bind:value={email}
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="이메일을 입력하세요"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">권한</label>
            <div class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium {user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
              {user.role === 'admin' ? '👑 관리자' : '👤 사용자'}
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">가입일</label>
            <div class="text-gray-900 bg-gray-50 px-4 py-3 rounded-lg">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '정보 없음'}
            </div>
          </div>
          
          <button 
            type="button"
            on:click={updateProfile}
            disabled={saving}
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {#if saving}
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              저장 중...
            {:else}
              💾 정보 저장
            {/if}
          </button>
        </div>
      </div>

      <!-- 비밀번호 변경 카드 -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <h2 class="text-xl font-semibold text-white flex items-center gap-2">
            <span>🔒</span>
            보안 설정
          </h2>
        </div>
        
        <div class="p-6 space-y-6">
          <div class="text-sm text-gray-600">
            정기적인 비밀번호 변경으로 계정을 안전하게 보호하세요.
          </div>
          
          <button 
            type="button"
            on:click={togglePasswordForm}
            class="w-full {showPasswordForm ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'} text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {showPasswordForm ? '❌ 취소' : '🔑 비밀번호 변경'}
          </button>
          
          {#if showPasswordForm}
            <div class="space-y-4 border-t pt-4">
              <div>
                <label for="currentPassword" class="block text-sm font-medium text-gray-700 mb-2">현재 비밀번호</label>
                <input 
                  type="password" 
                  id="currentPassword"
                  bind:value={currentPassword}
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  placeholder="현재 비밀번호"
                />
              </div>
              
              <div>
                <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
                <input 
                  type="password" 
                  id="newPassword"
                  bind:value={newPassword}
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  placeholder="새 비밀번호 (최소 6자)"
                />
              </div>
              
              <div>
                <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
                <input 
                  type="password" 
                  id="confirmPassword"
                  bind:value={confirmPassword}
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  placeholder="새 비밀번호 확인"
                />
              </div>
              
              <button 
                type="button"
                on:click={changePassword}
                disabled={changingPassword}
                class="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {#if changingPassword}
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  변경 중...
                {:else}
                  🔐 비밀번호 변경
                {/if}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>