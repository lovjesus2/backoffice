<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let settings = [];
  let systemInfo = {};
  let loading = true;
  let saving = false;
  let message = '';
  let messageType = '';
  let searchQuery = '';
  let filteredSettings = [];

  // 설정 카테고리 정의
  const categories = {
    site: { name: '사이트 설정', icon: '🌐', color: 'blue' },
    security: { name: '보안 설정', icon: '🔒', color: 'red' },
    system: { name: '시스템 설정', icon: '⚙️', color: 'gray' },
    user: { name: '사용자 설정', icon: '👥', color: 'green' }
  };

  // 설정을 카테고리별로 분류
  function categorizeSettings(settings) {
    return settings.map(setting => ({
      ...setting,
      category: getCategory(setting.setting_key)
    }));
  }

  function getCategory(key) {
    if (key.includes('site_') || key.includes('admin_email')) return 'site';
    if (key.includes('login') || key.includes('session') || key.includes('password')) return 'security';
    if (key.includes('maintenance') || key.includes('enable_')) return 'system';
    return 'user';
  }

  // 시스템 정보 로드
  async function loadSystemInfo() {
    if (!browser) return;
    
    try {
      const response = await fetch('/api/system?mode=info');
      const data = await response.json();
      
      if (data.success) {
        systemInfo = data.data;
        console.log('시스템 정보 로드 완료:', systemInfo);
      } else {
        console.log('시스템 정보 로드 실패:', data.error);
      }
    } catch (error) {
      console.log('시스템 정보 로드 실패 (무시됨):', error);
    }
  }

  // 설정 로드
  async function loadSettings() {
    if (!browser) return;
    
    try {
      loading = true;
      const response = await fetch('/api/system');
      const data = await response.json();
      
      if (data.success) {
        settings = categorizeSettings(data.data);
        filteredSettings = settings;
      } else {
        showMessage('설정을 불러오는데 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('설정 로드 오류:', error);
      showMessage('설정을 불러오는데 실패했습니다.', 'error');
    } finally {
      loading = false;
    }
  }

  // 설정 저장
  async function saveSettings() {
    if (!browser) return;
    
    try {
      saving = true;
      
      const response = await fetch('/api/system', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('설정이 저장되었습니다.', 'success');
        // 햅틱 피드백 (모바일)
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      } else {
        showMessage(data.error || '저장에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('설정 저장 오류:', error);
      showMessage('저장에 실패했습니다.', 'error');
    } finally {
      saving = false;
    }
  }

  // 검색 필터링
  function filterSettings() {
    if (!searchQuery.trim()) {
      filteredSettings = settings;
      return;
    }
    
    filteredSettings = settings.filter(setting => 
      setting.setting_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (setting.description && setting.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  // 메시지 표시
  function showMessage(text, type) {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 4000);
  }

  // 값 변경 핸들러
  function handleValueChange(index, value) {
    const settingIndex = settings.findIndex(s => s.id === filteredSettings[index].id);
    if (settingIndex >= 0) {
      settings[settingIndex].setting_value = value;
      filteredSettings[index].setting_value = value;
    }
  }

  // 불린 값 토글
  function toggleBoolean(index) {
    const currentValue = filteredSettings[index].setting_value;
    const newValue = !currentValue;
    handleValueChange(index, newValue);
  }

  // 카테고리별 그룹화
  $: groupedSettings = filteredSettings.reduce((groups, setting) => {
    const category = setting.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(setting);
    return groups;
  }, {});

  $: {
    searchQuery;
    filterSettings();
  }

  onMount(() => {
    loadSystemInfo();
    loadSettings();
  });
</script>

<svelte:head>
  <title>시스템 설정 - 관리자 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="settings-container">
  <!-- 헤더 섹션 -->
  <div class="header-section">
    <div class="header-content">
      <div class="header-icon">🔧</div>
      <h1>시스템 설정</h1>
      <p>시스템 전반의 설정을 관리합니다</p>
      
      <!-- 시스템 정보 표시 -->
      {#if systemInfo.site_name}
        <div class="system-info">
          <span class="info-badge">{systemInfo.site_name}</span>
          {#if systemInfo.user_role}
            <span class="role-badge">{systemInfo.user_role}</span>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- 검색 바 -->
    <div class="search-container">
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="설정 검색..."
          bind:value={searchQuery}
          class="search-input"
        />
        {#if searchQuery}
          <button class="clear-search" on:click={() => searchQuery = ''}>✕</button>
        {/if}
      </div>
    </div>
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

  <!-- 로딩 상태 -->
  {#if loading}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">설정을 불러오는 중...</p>
    </div>
  {:else}
    <!-- 설정 그룹 -->
    <div class="settings-content">
      {#each Object.entries(groupedSettings) as [categoryKey, categorySettings]}
        {#if categorySettings.length > 0}
          <div class="category-section">
            <div class="category-header">
              <span class="category-icon">{categories[categoryKey]?.icon}</span>
              <h2 class="category-title">{categories[categoryKey]?.name}</h2>
              <span class="category-count">{categorySettings.length}</span>
            </div>
            
            <div class="settings-grid">
              {#each categorySettings as setting, index}
                <div class="setting-card">
                  <div class="setting-header">
                    <h3 class="setting-title">
                      {setting.description || setting.setting_key}
                    </h3>
                    <div class="setting-meta">
                      <span class="setting-key">{setting.setting_key}</span>
                      <span class="setting-type type-{setting.setting_type}">
                        {setting.setting_type}
                      </span>
                      {#if setting.is_public}
                        <span class="public-badge">공개</span>
                      {/if}
                    </div>
                  </div>
                  
                  <div class="setting-input-container">
                    {#if setting.setting_type === 'boolean'}
                      <!-- 작고 깔끔한 토글 -->
                      <div class="compact-toggle">
                        <span class="status-text" class:active={setting.setting_value}>
                          {setting.setting_value ? '✅ ON' : '❌ OFF'}
                        </span>
                        <button 
                          class="mini-toggle"
                          class:active={setting.setting_value}
                          on:click={() => toggleBoolean(filteredSettings.indexOf(setting))}
                          type="button"
                        >
                          <span class="mini-slider"></span>
                        </button>
                      </div>
                    {:else if setting.setting_type === 'number'}
                      <div class="input-wrapper">
                        <label class="input-label">숫자 값</label>
                        <input 
                          type="number"
                          bind:value={setting.setting_value}
                          on:input={(e) => handleValueChange(filteredSettings.indexOf(setting), parseFloat(e.target.value))}
                          class="form-input number-input"
                          placeholder="숫자를 입력하세요"
                        />
                      </div>
                    {:else if setting.setting_type === 'json'}
                      <div class="input-wrapper">
                        <label class="input-label">JSON 데이터</label>
                        <textarea 
                          bind:value={setting.setting_value}
                          on:input={(e) => handleValueChange(filteredSettings.indexOf(setting), e.target.value)}
                          class="form-textarea json-textarea"
                          rows="4"
                          placeholder="JSON 형식으로 입력하세요"
                        ></textarea>
                      </div>
                    {:else}
                      <div class="input-wrapper">
                        <label class="input-label">텍스트 값</label>
                        <input 
                          type="text"
                          bind:value={setting.setting_value}
                          on:input={(e) => handleValueChange(filteredSettings.indexOf(setting), e.target.value)}
                          class="form-input text-input"
                          placeholder="값을 입력하세요"
                        />
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- 저장 버튼 -->
  <div class="save-section">
    <button 
      class="save-button"
      on:click={saveSettings}
      disabled={saving || loading}
    >
      {#if saving}
        <span class="button-spinner"></span>
        저장 중...
      {:else}
        <span class="save-icon">💾</span>
        설정 저장
      {/if}
    </button>
  </div>
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .settings-container {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 1rem;
    padding-bottom: 2rem;
  }

  .header-section {
    background: white;
    padding: 2rem;
    margin-bottom: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid #e9ecef;
  }

  .header-content {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .header-section h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 0.5rem;
  }

  .header-section p {
    color: #6c757d;
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .system-info {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .info-badge, .role-badge {
    padding: 0.4rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .info-badge {
    background: #007bff;
    color: white;
  }

  .role-badge {
    background: #28a745;
    color: white;
  }

  .search-container {
    max-width: 500px;
    margin: 0 auto;
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    font-size: 1.2rem;
    color: #6c757d;
    z-index: 1;
  }

  .search-input {
    width: 100%;
    padding: 1rem 1rem 1rem 3rem;
    border: 2px solid #dee2e6;
    border-radius: 25px;
    font-size: 1rem;
    transition: all 0.3s ease;
    background: white;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .clear-search {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1rem;
    color: #6c757d;
    cursor: pointer;
    transition: color 0.2s;
  }

  .clear-search:hover {
    color: #dc3545;
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

  .toast-icon {
    font-size: 1.2rem;
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
    margin: 0 auto 1.5rem;
  }

  .loading-text {
    color: #6c757d;
    font-size: 1.1rem;
  }

  .settings-content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .category-section {
    margin-bottom: 3rem;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding: 1rem 1.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid #e9ecef;
  }

  .category-icon {
    font-size: 1.5rem;
  }

  .category-title {
    flex: 1;
    color: #2c3e50;
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
  }

  .category-count {
    background: #6c757d;
    color: white;
    padding: 0.3rem 0.8rem;
    border-radius: 15px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .settings-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  }

  .setting-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #e9ecef;
    transition: all 0.2s ease;
    overflow: hidden;
    word-wrap: break-word;
  }

  .setting-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .setting-header {
    margin-bottom: 1rem;
  }

  .setting-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 0.75rem 0;
    word-wrap: break-word;
    line-height: 1.4;
  }

  .setting-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .setting-key {
    font-size: 0.8rem;
    color: #6c757d;
    font-family: 'Monaco', 'Consolas', monospace;
    background: #f8f9fa;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #dee2e6;
    word-break: break-all;
    max-width: 100%;
  }

  .setting-type {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .type-string { background: #e3f2fd; color: #1565c0; }
  .type-number { background: #fff3e0; color: #ef6c00; }
  .type-boolean { background: #e8f5e8; color: #2e7d32; }
  .type-json { background: #fce4ec; color: #c2185b; }

  .public-badge {
    font-size: 0.75rem;
    background: #28a745;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .setting-input-container {
    width: 100%;
    min-width: 0;
  }

  .input-wrapper {
    width: 100%;
    min-width: 0;
  }

  .input-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #495057;
    margin-bottom: 0.5rem;
  }

  /* 작고 깔끔한 토글 */
  .compact-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    gap: 1rem;
  }

  .status-text {
    font-size: 0.9rem;
    font-weight: 600;
    flex: 1;
  }

  .status-text.active {
    color: #28a745;
  }

  .status-text:not(.active) {
    color: #6c757d;
  }

  .mini-toggle {
    width: 50px;
    height: 24px;
    background: #ccc;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    flex-shrink: 0;
  }

  .mini-toggle.active {
    background: #28a745;
  }

  .mini-slider {
    display: block;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 3px;
    left: 3px;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .mini-toggle.active .mini-slider {
    transform: translateX(26px);
  }

  .mini-toggle:hover {
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .form-input, .form-textarea {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 0.75rem;
    border: 2px solid #dee2e6;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.3s ease;
    background: white;
    box-sizing: border-box;
    resize: vertical;
  }

  .form-input:focus, .form-textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .json-textarea {
    font-family: 'Monaco', 'Consolas', monospace;
    min-height: 100px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .text-input {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .save-section {
    text-align: center;
    margin-top: 3rem;
    padding: 2rem;
  }

  .save-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
  }

  .save-button:hover:not(:disabled) {
    background: #0056b3;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
  }

  .save-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .save-icon {
    font-size: 1.2rem;
  }

  .button-spinner {
    width: 20px;
    height: 20px;
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
    .settings-container {
      padding: 0.5rem;
    }

    .settings-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .header-section {
      padding: 1rem;
    }

    .header-section h1 {
      font-size: 1.5rem;
    }

    .setting-card {
      padding: 1rem;
    }

    .setting-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .compact-toggle {
      padding: 0.5rem;
    }
  }

  @media (max-width: 480px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
    
    .setting-card {
      min-width: 0;
      width: 100%;
    }
  }
</style>
