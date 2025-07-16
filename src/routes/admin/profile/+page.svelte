<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let user = {};
  let loading = true;
  let saving = false;
  let changingPassword = false;
  let message = '';
  let messageType = '';
  
  // 프로필 수정 폼
  let username = '';
  let email = '';
  
  // 비밀번호 변경 폼
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let showPasswordForm = false;

  // 프로필 로드
  async function loadProfile() {
    if (!browser) return;
    
    try {
      loading = true;
      const response = await fetch('/api/profile');
      const data = await response.json();
      
      if (data.success) {
        user = data.data;
        username = user.username;
        email = user.email || '';
      } else {
        showMessage(data.error || '프로필을 불러올 수 없습니다.', 'error');
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
      showMessage('프로필을 불러오는데 실패했습니다.', 'error');
    } finally {
      loading = false;
    }
  }

  // 프로필 수정
  async function saveProfile() {
    if (!browser) return;
    
    try {
      saving = true;
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('프로필이 저장되었습니다.', 'success');
        user = data.data;
      } else {
        showMessage(data.error || '저장에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('프로필 저장 오류:', error);
      showMessage('저장에 실패했습니다.', 'error');
    } finally {
      saving = false;
    }
  }

  // 비밀번호 변경
  async function changePassword() {
    if (!browser) return;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('모든 비밀번호 필드를 입력해주세요.', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showMessage('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    
    if (newPassword.length < 6) {
      showMessage('새 비밀번호는 최소 6자 이상이어야 합니다.', 'error');
      return;
    }
    
    try {
      changingPassword = true;
      
      console.log('🔐 비밀번호 변경 요청 시작');
      
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
      
      console.log('🔐 비밀번호 변경 응답:', data);
      
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

  onMount(() => {
    loadProfile();
  });
</script>

<svelte:head>
  <title>내 정보 - 관리자 백오피스</title>
</svelte:head>

<div class="profile-container">
  <!-- 헤더 -->
  <div class="header-section">
    <h1>👤 내 정보</h1>
    <p>계정 정보를 관리하고 비밀번호를 변경할 수 있습니다</p>
  </div>

  <!-- 메시지 토스트 -->
  {#if message}
    <div class="toast toast-{messageType}" class:show={message}>
      <div class="toast-content">
        <span class="toast-icon">
          {messageType === 'success' ? '✅' : '❌'}
        </span>
        <span class="toast-text">{message}</span>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>프로필을 불러오는 중...</p>
    </div>
  {:else}
    <div class="content-grid">
      <!-- 프로필 정보 카드 -->
      <div class="profile-card">
        <div class="card-header">
          <h2>🔧 기본 정보</h2>
        </div>
        
        <div class="form-group">
          <label for="username">사용자명</label>
          <input 
            type="text" 
            id="username"
            bind:value={username}
            class="form-input"
            placeholder="사용자명을 입력하세요"
          />
        </div>
        
        <div class="form-group">
          <label for="email">이메일</label>
          <input 
            type="email" 
            id="email"
            bind:value={email}
            class="form-input"
            placeholder="이메일을 입력하세요"
          />
        </div>
        
        <div class="form-group">
          <label>권한</label>
          <div class="role-badge role-{user.role}">
            {user.role === 'admin' ? '👑 관리자' : '👤 사용자'}
          </div>
        </div>
        
        <div class="form-group">
          <label>가입일</label>
          <div class="date-info">
            {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '정보 없음'}
          </div>
        </div>
        
        <button 
          class="save-button"
          on:click={saveProfile}
          disabled={saving}
        >
          {#if saving}
            <span class="spinner"></span>
            저장 중...
          {:else}
            💾 정보 저장
          {/if}
        </button>
      </div>

      <!-- 비밀번호 변경 카드 -->
      <div class="password-card">
        <div class="card-header">
          <h2>🔐 보안</h2>
        </div>
        
        <div class="password-section">
          <p class="section-description">
            계정 보안을 위해 정기적으로 비밀번호를 변경하세요.
          </p>
          
          <button 
            class="toggle-password-btn"
            on:click={togglePasswordForm}
            type="button"
          >
            {showPasswordForm ? '🔒 취소' : '🔓 비밀번호 변경'}
          </button>
          
          {#if showPasswordForm}
            <div class="password-form">
              <div class="form-group">
                <label for="currentPassword">현재 비밀번호</label>
                <input 
                  type="password" 
                  id="currentPassword"
                  bind:value={currentPassword}
                  class="form-input"
                  placeholder="현재 비밀번호를 입력하세요"
                />
              </div>
              
              <div class="form-group">
                <label for="newPassword">새 비밀번호</label>
                <input 
                  type="password" 
                  id="newPassword"
                  bind:value={newPassword}
                  class="form-input"
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                />
              </div>
              
              <div class="form-group">
                <label for="confirmPassword">비밀번호 확인</label>
                <input 
                  type="password" 
                  id="confirmPassword"
                  bind:value={confirmPassword}
                  class="form-input"
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
              </div>
              
              <button 
                class="change-password-btn"
                on:click={changePassword}
                disabled={changingPassword}
                type="button"
              >
                {#if changingPassword}
                  <span class="spinner"></span>
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

<style>
  .profile-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    background: #f8f9fa;
    min-height: 100vh;
  }

  .header-section {
    text-align: center;
    margin-bottom: 2rem;
    padding: 2rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .header-section h1 {
    font-size: 2rem;
    color: #2c3e50;
    margin-bottom: 0.5rem;
  }

  .header-section p {
    color: #6c757d;
    font-size: 1rem;
  }

  .toast {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    opacity: 0;
    transform: translateX(100px);
    transition: all 0.3s ease;
    pointer-events: none;
  }

  .toast.show {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  .toast-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .toast-success .toast-content {
    background: #28a745;
  }

  .toast-error .toast-content {
    background: #dc3545;
  }

  .loading-container {
    text-align: center;
    padding: 4rem 2rem;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #dee2e6;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  .content-grid {
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  }

  .profile-card, .password-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #e9ecef;
  }

  .card-header {
    margin-bottom: 1.5rem;
  }

  .card-header h2 {
    font-size: 1.3rem;
    color: #2c3e50;
    margin: 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    color: #495057;
    margin-bottom: 0.5rem;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #dee2e6;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.3s ease;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .role-badge {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .role-admin {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  }

  .role-user {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .date-info {
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 8px;
    color: #6c757d;
    border: 1px solid #dee2e6;
  }

  .save-button, .change-password-btn {
    width: 100%;
    padding: 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .save-button:hover:not(:disabled),
  .change-password-btn:hover:not(:disabled) {
    background: #0056b3;
    transform: translateY(-2px);
  }

  .save-button:disabled,
  .change-password-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .section-description {
    color: #6c757d;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .toggle-password-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 1rem;
  }

  .toggle-password-btn:hover {
    background: #138496;
    transform: translateY(-1px);
  }

  .password-form {
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #dee2e6;
  }

  .change-password-btn {
    background: #dc3545;
    margin-top: 1rem;
  }

  .change-password-btn:hover:not(:disabled) {
    background: #c82333;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .profile-container {
      padding: 0.5rem;
    }

    .content-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .profile-card, .password-card {
      padding: 1rem;
    }

    .header-section {
      padding: 1rem;
    }

    .header-section h1 {
      font-size: 1.5rem;
    }
  }
</style>
