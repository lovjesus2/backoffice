<script>
  import { goto } from '$app/navigation';
  
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

<div class="login-container">
  <div class="login-box">
    <div class="logo">
      <div class="logo-icon">🔐</div>
      <h1>관리자 시스템</h1>
      <p class="subtitle">로그인이 필요합니다</p>
    </div>
    
    <form on:submit|preventDefault={login} class="login-form">
      <div class="form-group">
        <label for="username">사용자명</label>
        <input
          type="text"
          id="username"
          bind:value={username}
          on:keypress={handleKeyPress}
          disabled={isLoading}
          autocomplete="username"
          placeholder="사용자명을 입력하세요"
        />
      </div>

      <div class="form-group">
        <label for="password">비밀번호</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          on:keypress={handleKeyPress}
          disabled={isLoading}
          autocomplete="current-password"
          placeholder="비밀번호를 입력하세요"
        />
      </div>

      {#if errorMessage}
        <div class="error-message">
          ⚠️ {errorMessage}
        </div>
      {/if}

      <button type="submit" disabled={isLoading} class="login-btn">
        {#if isLoading}
          <span class="loading-spinner"></span>
          로그인 중...
        {:else}
          🚀 로그인
        {/if}
      </button>
    </form>

    <div class="demo-info">
      <p>📝 테스트 계정</p>
      <p><strong>admin / admin123</strong></p>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }

  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  }

  .login-box {
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 400px;
    text-align: center;
  }

  .logo {
    margin-bottom: 30px;
  }

  .logo-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .logo h1 {
    margin: 0 0 8px 0;
    font-size: 28px;
    color: #2c3e50;
    font-weight: 700;
  }

  .subtitle {
    margin: 0 0 20px 0;
    color: #6c757d;
    font-size: 14px;
  }

  .login-form {
    text-align: left;
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #2c3e50;
    font-weight: 600;
    font-size: 14px;
  }

  .form-group input {
    width: 100%;
    padding: 16px 20px;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    font-size: 16px; /* iOS 줌 방지 */
    transition: all 0.3s ease;
    box-sizing: border-box;
    background: #f8f9fa;
  }

  .form-group input:focus {
    outline: none;
    border-color: #667eea;
    background: white;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-group input:disabled {
    background-color: #e9ecef;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .form-group input::placeholder {
    color: #adb5bd;
  }

  .login-btn {
    width: 100%;
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 56px; /* 터치 친화적 */
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .login-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }

  .login-btn:active {
    transform: translateY(0);
  }

  .login-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #ffffff40;
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-message {
    background: #ffebee;
    color: #c62828;
    padding: 16px 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    text-align: center;
    border: 1px solid #ffcdd2;
    font-size: 14px;
    font-weight: 500;
  }

  .demo-info {
    margin-top: 30px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 12px;
    border: 1px dashed #dee2e6;
  }

  .demo-info p {
    margin: 0 0 4px 0;
    font-size: 13px;
    color: #6c757d;
  }

  .demo-info p:last-child {
    margin: 0;
    font-size: 14px;
    color: #495057;
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .login-container {
      padding: 16px;
    }

    .login-box {
      padding: 32px 24px;
      border-radius: 16px;
    }

    .logo-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .logo h1 {
      font-size: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group input {
      padding: 14px 16px;
      font-size: 16px; /* iOS 줌 방지 중요 */
    }

    .login-btn {
      padding: 14px 16px;
      min-height: 52px;
      font-size: 16px;
    }
  }

  /* 작은 모바일 */
  @media (max-width: 480px) {
    .login-container {
      padding: 12px;
    }

    .login-box {
      padding: 24px 20px;
      border-radius: 12px;
    }

    .logo h1 {
      font-size: 22px;
    }

    .form-group input,
    .login-btn {
      padding: 12px 16px;
      font-size: 16px;
    }

    .demo-info {
      padding: 16px;
      margin-top: 24px;
    }
  }

  /* 터치 디바이스 최적화 */
  @media (hover: none) and (pointer: coarse) {
    .login-btn {
      min-height: 56px;
    }

    .form-group input {
      min-height: 48px;
    }
  }

  /* 가로 모드 모바일 */
  @media (max-height: 600px) and (orientation: landscape) {
    .login-container {
      padding: 12px;
    }

    .login-box {
      padding: 20px;
      max-width: 360px;
    }

    .logo {
      margin-bottom: 20px;
    }

    .logo-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .demo-info {
      margin-top: 20px;
      padding: 12px;
    }
  }
</style>
