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
  let isMobile = false;

  // 설정 카테고리 정의
  const categories = {
    site: { name: '사이트 설정', icon: '🌐', color: 'blue' },
    security: { name: '보안 설정', icon: '🔒', color: 'red' },
    system: { name: '시스템 설정', icon: '⚙️', color: 'blue' },
    user: { name: '사용자 설정', icon: '👥', color: 'blue' },
    sales: { name: '매출 설정', icon: '💰', color: 'blue' },
    printer: { name: '프린터 설정', icon: '🖨️', color: 'blue' },
    menu: { name: '메뉴 설정', icon: '📋', color: 'blue' }
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
    if (key.includes('login_') || key.includes('session_')) return 'security';
    if (key.includes('maintenance_') || key.includes('enable_')) return 'system';
    if (key.includes('user_')) return 'user';
    if (key.includes('sales_')) return 'sales';
    if (key.includes('printer_') || key.includes('computer_')) return 'printer';
    if (key.includes('menu_save')) return 'menu';
    return 'system'; // 기본값
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

  // 🔧 수정된 값 변경 핸들러 - setting ID로 찾기
  function handleValueChange(settingId, value) {
    const settingIndex = settings.findIndex(s => s.id === settingId);
    if (settingIndex >= 0) {
      settings[settingIndex].setting_value = value;
      
      // filteredSettings에서도 동일한 ID를 찾아서 업데이트
      const filteredIndex = filteredSettings.findIndex(s => s.id === settingId);
      if (filteredIndex >= 0) {
        filteredSettings[filteredIndex].setting_value = value;
      }
    }
  }

  // 🔧 수정된 불린 값 토글 - setting ID 사용
  function toggleBoolean(settingId) {
    const setting = settings.find(s => s.id === settingId);
    if (setting) {
      const newValue = !setting.setting_value;
      handleValueChange(settingId, newValue);
    }
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

  // 모바일 체크
  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 768;
    }
  }

  onMount(() => {
    checkMobile();
    loadSystemInfo();
    loadSettings();
    
    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<svelte:head>
  <title>시스템 설정 - 관리자 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-8">
  <!-- 헤더 섹션 -->
  <div class="bg-white shadow-sm border-b border-gray-200 mb-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="text-center mb-6">
        <div class="text-5xl mb-4">🔧</div>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">시스템 설정</h1>
        <p class="text-gray-600">시스템 전반의 설정을 관리합니다</p>
        
        <!-- 시스템 정보 표시 -->
        {#if systemInfo.site_name}
          <div class="flex justify-center gap-2 mt-4 flex-wrap">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {systemInfo.site_name}
            </span>
            {#if systemInfo.user_role}
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {systemInfo.user_role}
              </span>
            {/if}
          </div>
        {/if}
      </div>
      
      <!-- 검색 바 -->
      <div class="max-w-md mx-auto">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span class="text-gray-400 text-lg">🔍</span>
          </div>
          <input 
            type="text" 
            placeholder="설정 검색..."
            bind:value={searchQuery}
            class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          {#if searchQuery}
            <button 
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
              on:click={() => searchQuery = ''}
            >
              <span class="text-gray-400 hover:text-red-500 cursor-pointer text-sm">✕</span>
            </button>
          {/if}
        </div>
      </div>
    </div>
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

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- 로딩 상태 -->
    {#if loading}
      <div class="flex flex-col items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p class="text-gray-600">설정을 불러오는 중...</p>
      </div>
    {:else}
      <!-- 설정 그룹 -->
      <div class="space-y-8">
        {#each Object.entries(groupedSettings) as [categoryKey, categorySettings]}
          {#if categorySettings.length > 0}
            <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <!-- 카테고리 헤더 -->
              <div class="bg-gradient-to-r from-{categories[categoryKey]?.color}-500 to-{categories[categoryKey]?.color}-600 px-6 py-4">
                <div class="flex items-center gap-3">
                  <span class="text-2xl">{categories[categoryKey]?.icon}</span>
                  <h2 class="text-xl font-bold text-white">{categories[categoryKey]?.name}</h2>
                  <span class="ml-auto bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-sm font-medium">
                    {categorySettings.length}
                  </span>
                </div>
              </div>
              
              <!-- 설정 목록 -->
              <div class="divide-y divide-gray-200">
                {#each categorySettings as setting, index}
                  <div class="p-6 hover:bg-gray-50 transition-colors">
                    <div class="flex flex-col space-y-4">
                      <!-- 설정 헤더 -->
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">
                          {setting.description || setting.setting_key}
                        </h3>
                        <div class="flex flex-wrap gap-2 text-sm">
                          <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 font-mono">
                            {setting.setting_key}
                          </span>
                          <span class="inline-flex items-center px-2 py-1 rounded bg-{categories[categoryKey]?.color}-100 text-{categories[categoryKey]?.color}-800">
                            {setting.setting_type}
                          </span>
                          {#if setting.is_public}
                            <span class="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">
                              공개
                            </span>
                          {/if}
                        </div>
                      </div>
                      
                      <!-- 설정 입력 -->
                      <div class="max-w-lg">
                        {#if setting.setting_type === 'boolean'}
                          <!-- 토글 스위치 -->
                          <div class="flex items-center gap-3">
                            <button
                              type="button"
                              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {setting.setting_value ? 'bg-blue-600' : 'bg-gray-200'}"
                              on:click={() => toggleBoolean(setting.id)}
                            >
                              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {setting.setting_value ? 'translate-x-5' : 'translate-x-0'}"></span>
                            </button>
                            <span class="text-sm font-medium {setting.setting_value ? 'text-green-600' : 'text-gray-500'}">
                              {setting.setting_value ? '활성화' : '비활성화'}
                            </span>
                          </div>
                        {:else if setting.setting_type === 'number'}
                          <!-- 숫자 입력 -->
                          <input 
                            type="number"
                            bind:value={setting.setting_value}
                            on:change={() => handleValueChange(setting.id, setting.setting_value)}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        {:else if setting.setting_type === 'json'}
                          <!-- JSON 텍스트 영역 -->
                          <textarea
                            bind:value={setting.setting_value}
                            on:change={() => handleValueChange(setting.id, setting.setting_value)}
                            rows="4"
                            class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                            placeholder="JSON 형식으로 입력하세요"
                          ></textarea>
                        {:else}
                          <!-- 텍스트 입력 -->
                          <input 
                            type="text"
                            bind:value={setting.setting_value}
                            on:change={() => handleValueChange(setting.id, setting.setting_value)}
                            class="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder={setting.setting_key.includes('printer') || setting.setting_key.includes('computer') ? '프린터 또는 컴퓨터 이름을 입력하세요' : ''}
                          />
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- 저장 버튼 -->
      <div class="text-center mt-12 pb-8">
        <button 
          type="button"
          on:click={saveSettings}
          disabled={saving || loading}
          class="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 disabled:transform-none disabled:cursor-not-allowed"
        >
          {#if saving}
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            저장 중...
          {:else}
            <span class="text-lg">💾</span>
            설정 저장
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>