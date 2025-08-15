<!-- src/routes/admin/users/+page.svelte - Tailwind CSS 완전 변환 -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // 상태 변수들
  let users = [];
  let loading = false;
  let searchTerm = '';
  let currentPage = 1;
  let totalPages = 1;
  let totalUsers = 0;
  let isMobile = false;

  // 모달 상태
  let showCreateModal = false;
  let showEditModal = false;

  // 폼 데이터
  let newUser = {
    username: '',
    email: '',
    password: '',
    role: 'user'
  };

  let editUser = {
    id: null,
    username: '',
    email: '',
    password: '',
    role: 'user'
  };

  // 반응형 감지
  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 768;
    }
  }

  // 사용자 목록 로드
  async function loadUsers() {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        search: searchTerm
      });

      console.log('📋 사용자 목록 로드:', `/api/users?${params}`); // 디버깅용

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      console.log('📡 서버 응답:', response.status, data); // 디버깅용

      if (response.ok) {
        // API 응답 구조에 맞게 수정
        users = data.users || [];
        totalPages = data.totalPages || 1;
        totalUsers = data.total || 0;
      } else {
        console.error('❌ 사용자 로드 실패:', data);
        const errorMessage = data.error || data.message || '사용자를 불러오는 데 실패했습니다';
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ 사용자 로드 오류:', error);
      showToast('네트워크 오류가 발생했습니다', 'error');
    } finally {
      loading = false;
    }
  }

  // 새 사용자 생성
  async function createUser() {
    try {
      console.log('🆕 사용자 생성 요청:', newUser); // 디버깅용

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();
      console.log('📡 서버 응답:', response.status, data); // 디버깅용

      if (response.ok) {
        // API 응답에서 success와 message 확인
        showToast(data.message || '사용자가 성공적으로 생성되었습니다', 'success');
        showCreateModal = false;
        newUser = { username: '', email: '', password: '', role: 'user' };
        loadUsers();
      } else {
        // 에러 응답에서 error 필드 확인
        const errorMessage = data.error || data.message || '사용자 생성에 실패했습니다';
        console.error('❌ 사용자 생성 실패:', errorMessage);
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ 네트워크 오류:', error);
      showToast('네트워크 오류가 발생했습니다', 'error');
    }
  }

  // 사용자 편집 모달 열기
  function openEditModal(user) {
    editUser = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role
    };
    showEditModal = true;
  }

  // 사용자 업데이트
  async function updateUser() {
    try {
      const updateData = {
        username: editUser.username,
        email: editUser.email,
        role: editUser.role
      };

      if (editUser.password) {
        updateData.password = editUser.password;
      }

      console.log('✏️ 사용자 수정 요청:', updateData); // 디버깅용

      const response = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      console.log('📡 서버 응답:', response.status, data); // 디버깅용

      if (response.ok) {
        const successMessage = data.message || '사용자가 성공적으로 수정되었습니다';
        showToast(successMessage, 'success');
        showEditModal = false;
        loadUsers();
      } else {
        const errorMessage = data.error || data.message || '사용자 수정에 실패했습니다';
        console.error('❌ 사용자 수정 실패:', errorMessage);
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ 사용자 수정 오류:', error);
      showToast('네트워크 오류가 발생했습니다', 'error');
    }
  }

  // 사용자 삭제
  async function deleteUser(userId, username) {
    if (!confirm(`정말로 "${username}" 사용자를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      console.log('🗑️ 사용자 삭제 요청:', userId, username); // 디버깅용

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      console.log('📡 서버 응답:', response.status, data); // 디버깅용

      if (response.ok) {
        const successMessage = data.message || '사용자가 성공적으로 삭제되었습니다';
        showToast(successMessage, 'success');
        loadUsers();
      } else {
        const errorMessage = data.error || data.message || '사용자 삭제에 실패했습니다';
        console.error('❌ 사용자 삭제 실패:', errorMessage);
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ 사용자 삭제 오류:', error);
      showToast('네트워크 오류가 발생했습니다', 'error');
    }
  }

  // 검색 핸들러
  function handleSearch() {
    currentPage = 1;
    loadUsers();
  }

  // 검색 키다운 핸들러
  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }

  // 날짜 포매팅
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  // 토스트 메시지 표시
  function showToast(message, type = 'info') {
    // 토스트 구현 (기존 코드와 동일)
    if (browser) {
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.className = `fixed bottom-5 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white font-medium z-50 transition-opacity duration-300 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
      }`;
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    }
  }

  // 컴포넌트 마운트
  onMount(() => {
    checkMobile();
    loadUsers();
    
    if (browser) {
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  });
</script>

<svelte:head>
  <title>사용자 관리 - 관리자</title>
</svelte:head>

<!-- 메인 컨테이너 - padding: 24px, max-width: 1200px -->
<div class="p-6 max-w-7xl mx-auto">
  
  <!-- 페이지 헤더 - margin-bottom: 32px, gap: 20px -->
  <div class="flex justify-between items-start mb-8 gap-5">
    <div>
      <!-- h1: font-size: 28px, font-weight: 700, color: #1a202c, margin: 0 0 8px 0 -->
      <h1 class="text-3xl font-bold text-gray-900 mb-2">👥 사용자 관리</h1>
      <!-- subtitle: color: #718096, font-size: 16px -->
      <p class="text-gray-500 text-base m-0">시스템 사용자를 관리하고 권한을 설정할 수 있습니다</p>
    </div>
    
    <!-- 새 사용자 생성 버튼 - 아이콘만 -->
    <button 
      class="bg-blue-500 hover:bg-blue-600 text-white font-semibold w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center"
      on:click={() => showCreateModal = true}
      title="새 사용자 생성"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
        <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" stroke-width="2"/>
        <line x1="22" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2"/>
      </svg>
    </button>
  </div>

  <!-- 검색 섹션 - margin-bottom: 24px -->
  <div class="mb-6">
    <!-- search-container: 가로 배치로 수정 -->
    <div class="flex items-center gap-3 max-w-md">
      <!-- 검색 입력창 with 아이콘 -->
      <div class="relative flex-1">
        <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        
        <input 
          type="text" 
          placeholder="사용자명으로 검색..."
          bind:value={searchTerm}
          on:keydown={handleSearchKeydown}
          class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
        />
      </div>
      
      <!-- 검색 버튼 -->
      <button 
        class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 whitespace-nowrap"
        on:click={handleSearch}
      >
        검색
      </button>
    </div>
  </div>

  <!-- 사용자 목록 컨테이너 -->
  <div>
    {#if loading}
      <!-- 로딩 상태 -->
      <div class="flex flex-col items-center justify-center py-16">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-500">사용자 정보를 불러오는 중...</p>
      </div>
    {:else if isMobile}
      
      <!-- 모바일: 카드 형태 -->
      <div class="space-y-4">
        {#each users as user}
          <!-- user-card: background: white, border-radius: 16px, box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), border: 1px solid #e2e8f0, padding: 20px -->
          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            
            <!-- card-header: display: flex, align-items: center, gap: 12px, margin-bottom: 16px -->
            <div class="flex items-center gap-3 mb-4">
              <!-- user-avatar: width: 48px, height: 48px, background: linear-gradient, border-radius: 50% -->
              <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                {user.username.charAt(0).toUpperCase()}
              </div>
              
              <div class="flex-1">
                <!-- username: font-size: 18px, font-weight: 600, color: #2d3748 -->
                <h3 class="text-lg font-semibold text-gray-700 mb-1">{user.username}</h3>
                
                <!-- 역할 배지 -->
                <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold {user.role === 'admin' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-green-50 text-green-700 border border-green-200'}">
                  {user.role}
                </span>
              </div>
              
              <!-- card-actions: display: flex, gap: 8px, margin-left: auto -->
              <div class="flex gap-2 ml-auto">
                <!-- action-btn: width: 32px, height: 32px, border-radius: 8px -->
                <button 
                  class="w-8 h-8 bg-transparent border border-slate-200 rounded-lg text-blue-500 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 flex items-center justify-center"
                  on:click={() => openEditModal(user)} 
                  title="수정"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
                
                <button 
                  class="w-8 h-8 bg-transparent border border-slate-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-500 transition-all duration-200 flex items-center justify-center"
                  on:click={() => deleteUser(user.id, user.username)} 
                  title="삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="m3 6 18 0M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- card-body: display: grid, gap: 12px -->
            <div class="grid gap-3">
              <!-- info-row: display: flex, justify-content: space-between, align-items: center -->
              <div class="flex justify-between items-center">
                <!-- label: font-weight: 500, color: #718096, font-size: 14px -->
                <span class="font-medium text-gray-500 text-sm">ID</span>
                <!-- value: color: #2d3748, font-size: 14px, font-weight: 500 -->
                <span class="text-gray-700 text-sm font-medium">{user.id}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="font-medium text-gray-500 text-sm">이메일</span>
                <span class="text-gray-700 text-sm font-medium">{user.email || '미설정'}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="font-medium text-gray-500 text-sm">생성일</span>
                <span class="text-gray-500 text-sm">{formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
    {:else}
      
      <!-- 데스크톱: 테이블 형태 -->
      <!-- users-table: background: white, border-radius: 16px, box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), border: 1px solid #e2e8f0 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full border-collapse">
          <thead>
            <!-- th: background: #f8fafc, padding: 16px, font-weight: 600, color: #4a5568, font-size: 14px, border-bottom: 1px solid #e2e8f0 -->
            <tr class="bg-slate-50">
              <th class="px-4 py-4 text-left font-semibold text-gray-600 text-sm border-b border-slate-200">사용자</th>
              <th class="px-4 py-4 text-left font-semibold text-gray-600 text-sm border-b border-slate-200">이메일</th>
              <th class="px-4 py-4 text-left font-semibold text-gray-600 text-sm border-b border-slate-200">역할</th>
              <th class="px-4 py-4 text-left font-semibold text-gray-600 text-sm border-b border-slate-200">생성일</th>
              <th class="px-4 py-4 text-center font-semibold text-gray-600 text-sm border-b border-slate-200">작업</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user}
              <!-- td: padding: 16px, border-bottom: 1px solid #e2e8f0 -->
              <tr class="hover:bg-slate-50 transition-colors duration-150">
                <!-- user-cell: display: flex, align-items: center, gap: 12px -->
                <td class="px-4 py-4 border-b border-slate-200">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <!-- username: font-weight: 600, color: #2d3748, font-size: 14px -->
                      <div class="font-semibold text-gray-700 text-sm">{user.username}</div>
                      <!-- user-id: font-size: 12px, color: #a0aec0 -->
                      <div class="text-xs text-gray-400">ID: {user.id}</div>
                    </div>
                  </div>
                </td>
                
                <!-- email-cell: color: #4a5568, font-size: 14px -->
                <td class="px-4 py-4 border-b border-slate-200 text-gray-600 text-sm">{user.email || '미설정'}</td>
                
                <td class="px-4 py-4 border-b border-slate-200">
                  <!-- role-badge: padding: 6px 12px, border-radius: 20px, font-size: 12px, font-weight: 600 -->
                  <span class="inline-block px-3 py-1.5 rounded-full text-xs font-semibold {user.role === 'admin' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-green-50 text-green-700 border border-green-200'}">
                    {user.role}
                  </span>
                </td>
                
                <!-- date-cell: color: #718096, font-size: 14px -->
                <td class="px-4 py-4 border-b border-slate-200 text-gray-500 text-sm">{formatDate(user.created_at)}</td>
                
                <td class="px-4 py-4 border-b border-slate-200">
                  <div class="flex justify-center gap-2">
                    <button 
                      class="w-8 h-8 bg-transparent border border-slate-200 rounded-lg text-blue-500 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200 flex items-center justify-center"
                      on:click={() => openEditModal(user)} 
                      title="수정"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/>
                      </svg>
                    </button>
                    
                    <button 
                      class="w-8 h-8 bg-transparent border border-slate-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-500 transition-all duration-200 flex items-center justify-center"
                      on:click={() => deleteUser(user.id, user.username)} 
                      title="삭제"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="m3 6 18 0M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- 페이지네이션 -->
    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-6">
        <button 
          class="w-10 h-10 bg-white border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
          disabled={currentPage === 1}
          on:click={() => { currentPage--; loadUsers(); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
        
        <div class="flex items-center gap-1 px-4 py-2 bg-gray-50 rounded-lg text-sm">
          <span class="font-medium text-gray-700">{currentPage}</span>
          <span class="text-gray-400">/</span>
          <span class="text-gray-600">{totalPages}</span>
        </div>
        
        <button 
          class="w-10 h-10 bg-white border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
          disabled={currentPage === totalPages}
          on:click={() => { currentPage++; loadUsers(); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- 새 사용자 생성 모달 -->
{#if showCreateModal}
  <!-- modal-overlay: position: fixed, inset: 0, background: rgba(0, 0, 0, 0.5), z-index: 50 -->
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    role="button"
    tabindex="0"
    on:click={() => showCreateModal = false}
    on:keydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
  >
    <!-- modal: background: white, border-radius: 16px, max-width: 500px, width: 100% -->
    <div 
      class="bg-white rounded-2xl max-w-lg w-full max-h-screen overflow-y-auto"
      on:click|stopPropagation
      role="dialog"
      tabindex="-1"
    >
      <!-- modal-header: padding: 24px 24px 0, display: flex, justify-content: space-between, align-items: center -->
      <div class="flex justify-between items-center px-6 pt-6 pb-0">
        <h2 class="text-xl font-bold text-gray-900">🆕 새 사용자 생성</h2>
        <button 
          class="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 transition-all duration-200 flex items-center justify-center"
          on:click={() => showCreateModal = false}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="m18 6-12 12M6 6l12 12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
      
      <!-- 폼 -->
      <form on:submit|preventDefault={createUser} class="p-6">
        <!-- form-group: margin-bottom: 24px -->
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">사용자명 *</label>
          <input 
            type="text" 
            bind:value={newUser.username} 
            required 
            placeholder="사용자명을 입력하세요"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">이메일</label>
          <input 
            type="email" 
            bind:value={newUser.email} 
            placeholder="이메일을 입력하세요 (선택사항)"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">비밀번호 *</label>
          <input 
            type="password" 
            bind:value={newUser.password} 
            required 
            placeholder="비밀번호를 입력하세요"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>
        
        <div class="mb-8">
          <label class="block text-sm font-semibold text-gray-700 mb-2">역할</label>
          <select 
            bind:value={newUser.role}
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
          >
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        
        <!-- modal-actions: display: flex, gap: 12px, justify-content: flex-end -->
        <div class="flex gap-3 justify-end">
          <button 
            type="button" 
            class="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
            on:click={() => showCreateModal = false}
          >
            취소
          </button>
          <button 
            type="submit" 
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 font-medium"
          >
            생성
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 사용자 편집 모달 -->
{#if showEditModal}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    role="button"
    tabindex="0"
    on:click={() => showEditModal = false}
    on:keydown={(e) => e.key === 'Escape' && (showEditModal = false)}
  >
    <div 
      class="bg-white rounded-2xl max-w-lg w-full max-h-screen overflow-y-auto"
      on:click|stopPropagation
      role="dialog"
      tabindex="-1"
    >
      <div class="flex justify-between items-center px-6 pt-6 pb-0">
        <h2 class="text-xl font-bold text-gray-900">✏️ 사용자 편집</h2>
        <button 
          class="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 transition-all duration-200 flex items-center justify-center"
          on:click={() => showEditModal = false}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="m18 6-12 12M6 6l12 12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
      
      <form on:submit|preventDefault={updateUser} class="p-6">
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">사용자명 *</label>
          <input 
            type="text" 
            bind:value={editUser.username} 
            required 
            placeholder="사용자명을 입력하세요"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">이메일</label>
          <input 
            type="email" 
            bind:value={editUser.email} 
            placeholder="이메일을 입력하세요"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">역할 *</label>
          <select 
            bind:value={editUser.role} 
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
          >
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">새 비밀번호</label>
          <input 
            type="password" 
            bind:value={editUser.password} 
            placeholder="변경하려면 새 비밀번호를 입력하세요 (선택사항)"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
          <small class="text-xs text-gray-500 mt-1 block">비밀번호를 변경하지 않으려면 빈 칸으로 두세요</small>
        </div>
        
        <div class="flex gap-3 justify-end">
          <button 
            type="button" 
            class="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
            on:click={() => showEditModal = false}
          >
            취소
          </button>
          <button 
            type="submit" 
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 font-medium"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}