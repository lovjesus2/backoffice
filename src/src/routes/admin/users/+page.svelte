<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let users = [];
  let loading = false;
  let currentPage = 1;
  let totalPages = 1;
  let searchTerm = '';
  let showCreateModal = false;
  let showEditModal = false;
  let editingUser = null;
  
  // 모바일 감지
  let isMobile = false;
  
  // 새 사용자 생성 폼
  let newUser = {
    username: '',
    email: '',
    password: '',
    role: 'user'
  };

  // 사용자 편집 폼
  let editUser = {
    id: '',
    username: '',
    email: '',
    role: '',
    password: ''
  };

  onMount(() => {
    loadUsers();
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

  function checkMobile() {
    isMobile = window.innerWidth < 768;
  }

  async function loadUsers() {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        search: searchTerm
      });
      
      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        users = data.users;
        totalPages = data.totalPages;
      } else {
        alert(data.error || '데이터 로드 실패');
      }
    } catch (error) {
      alert('서버 오류');
    }
    loading = false;
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) {
      alert('사용자명과 비밀번호는 필수입니다.');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('사용자가 생성되었습니다.');
        showCreateModal = false;
        newUser = { username: '', email: '', password: '', role: 'user' };
        loadUsers();
      } else {
        alert(data.error || '생성 실패');
      }
    } catch (error) {
      alert('서버 오류');
    }
  }

  async function updateUser() {
    try {
      const updateData = {
        username: editUser.username,
        email: editUser.email,
        role: editUser.role
      };
      
      // 비밀번호가 입력된 경우에만 포함
      if (editUser.password.trim()) {
        updateData.password = editUser.password;
      }

      const response = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('사용자 정보가 수정되었습니다.');
        showEditModal = false;
        editUser = { id: '', username: '', email: '', role: '', password: '' };
        loadUsers();
      } else {
        alert(data.error || '수정 실패');
      }
    } catch (error) {
      alert('서버 오류');
    }
  }

  async function deleteUser(userId, username) {
    if (!confirm(`${username} 사용자를 삭제하시겠습니까?`)) return;
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('사용자가 삭제되었습니다.');
        loadUsers();
      } else {
        alert(data.error || '삭제 실패');
      }
    } catch (error) {
      alert('서버 오류');
    }
  }

  function openEditModal(user) {
    editUser = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role,
      password: ''
    };
    showEditModal = true;
  }

  function handleSearch() {
    currentPage = 1;
    loadUsers();
  }

  function clearSearch() {
    searchTerm = '';
    currentPage = 1;
    loadUsers();
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ko-KR');
  }
</script>

<div class="users-page">
  <div class="page-header">
    <div class="header-content">
      <h1>👥 사용자 관리</h1>
      <p class="subtitle">시스템 사용자를 관리하고 권한을 설정하세요</p>
    </div>
    <button class="btn-primary" on:click={() => showCreateModal = true}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>새 사용자</span>
    </button>
  </div>

  <!-- 검색 섹션 -->
  <div class="search-section">
    <div class="search-container">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
      </svg>
      <input 
        type="text" 
        placeholder="사용자명 또는 이메일 검색..."
        bind:value={searchTerm}
        on:keyup={(e) => e.key === 'Enter' && handleSearch()}
        class="search-input"
      >
      {#if searchTerm}
        <button class="clear-btn" on:click={clearSearch} title="검색어 지우기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="m18 6-12 12M6 6l12 12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      {/if}
      <button class="search-btn" on:click={handleSearch}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span class="btn-text">검색</span>
      </button>
    </div>
  </div>

  <!-- 사용자 목록 -->
  <div class="users-container">
    {#if loading}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    {:else if isMobile}
      <!-- 모바일: 카드 형태 -->
      <div class="user-cards">
        {#each users as user}
          <div class="user-card">
            <div class="card-header">
              <div class="user-avatar">
                <span class="avatar-text">{user.username.charAt(0).toUpperCase()}</span>
              </div>
              <div class="user-info">
                <h3>{user.username}</h3>
                <span class="role-badge role-{user.role}">{user.role}</span>
              </div>
              <div class="card-actions">
                <button class="action-btn edit-btn" on:click={() => openEditModal(user)} title="수정">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
                <button class="action-btn delete-btn" on:click={() => deleteUser(user.id, user.username)} title="삭제">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="m3 6 18 0M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="card-body">
              <div class="info-row">
                <span class="label">ID</span>
                <span class="value">{user.id}</span>
              </div>
              <div class="info-row">
                <span class="label">이메일</span>
                <span class="value">{user.email || '미설정'}</span>
              </div>
              <div class="info-row">
                <span class="label">생성일</span>
                <span class="value">{formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- 데스크톱: 테이블 형태 -->
      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>사용자</th>
              <th>이메일</th>
              <th>역할</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user}
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="user-avatar small">
                      <span class="avatar-text">{user.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="user-details">
                      <span class="username">{user.username}</span>
                      <span class="user-id">ID: {user.id}</span>
                    </div>
                  </div>
                </td>
                <td class="email-cell">{user.email || '미설정'}</td>
                <td>
                  <span class="role-badge role-{user.role}">{user.role}</span>
                </td>
                <td class="date-cell">{formatDate(user.created_at)}</td>
                <td>
                  <div class="table-actions">
                    <button class="action-btn edit-btn" on:click={() => openEditModal(user)} title="수정">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/>
                      </svg>
                    </button>
                    <button class="action-btn delete-btn" on:click={() => deleteUser(user.id, user.username)} title="삭제">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
  </div>

  <!-- 페이징 -->
  {#if totalPages > 1}
    <div class="pagination">
      <button 
        class="page-btn"
        disabled={currentPage === 1}
        on:click={() => { currentPage--; loadUsers(); }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
      
      <div class="page-info">
        <span class="current-page">{currentPage}</span>
        <span class="divider">/</span>
        <span class="total-pages">{totalPages}</span>
      </div>
      
      <button 
        class="page-btn"
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

<!-- 새 사용자 생성 모달 -->
{#if showCreateModal}
  <div class="modal-overlay" on:click={() => showCreateModal = false}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🆕 새 사용자 생성</h2>
        <button class="close-btn" on:click={() => showCreateModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="m18 6-12 12M6 6l12 12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
      
      <form on:submit|preventDefault={createUser}>
        <div class="form-group">
          <label>사용자명 *</label>
          <input type="text" bind:value={newUser.username} required placeholder="사용자명을 입력하세요">
        </div>
        
        <div class="form-group">
          <label>이메일</label>
          <input type="email" bind:value={newUser.email} placeholder="이메일을 입력하세요 (선택사항)">
        </div>
        
        <div class="form-group">
          <label>비밀번호 *</label>
          <input type="password" bind:value={newUser.password} required placeholder="비밀번호를 입력하세요">
        </div>
        
        <div class="form-group">
          <label>역할</label>
          <select bind:value={newUser.role}>
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn-cancel" on:click={() => showCreateModal = false}>취소</button>
          <button type="submit" class="btn-primary">생성</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 사용자 편집 모달 -->
{#if showEditModal}
  <div class="modal-overlay" on:click={() => showEditModal = false}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>✏️ 사용자 편집</h2>
        <button class="close-btn" on:click={() => showEditModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="m18 6-12 12M6 6l12 12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
      
      <form on:submit|preventDefault={updateUser}>
        <div class="form-group">
          <label>사용자명 *</label>
          <input type="text" bind:value={editUser.username} required placeholder="사용자명을 입력하세요">
        </div>
        
        <div class="form-group">
          <label>이메일</label>
          <input type="email" bind:value={editUser.email} placeholder="이메일을 입력하세요">
        </div>
        
        <div class="form-group">
          <label>역할 *</label>
          <select bind:value={editUser.role} required>
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>새 비밀번호</label>
          <input type="password" bind:value={editUser.password} placeholder="변경하려면 새 비밀번호를 입력하세요 (선택사항)">
          <small class="form-hint">비밀번호를 변경하지 않으려면 빈 칸으로 두세요</small>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn-cancel" on:click={() => showEditModal = false}>취소</button>
          <button type="submit" class="btn-primary">저장</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .users-page {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    gap: 20px;
  }

  .header-content h1 {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 700;
    color: #1a202c;
  }

  .subtitle {
    margin: 0;
    color: #718096;
    font-size: 16px;
  }

  /* 검색 섹션 */
  .search-section {
    margin-bottom: 24px;
  }

  .search-container {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 500px;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    color: #a0aec0;
    z-index: 1;
  }

  .search-input {
    flex: 1;
    padding: 12px 16px 12px 48px;
    border: 2px solid #e2e8f0;
    border-radius: 12px 0 0 12px;
    font-size: 14px;
    background: white;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
  }

  .clear-btn {
    position: absolute;
    right: 80px;
    background: none;
    border: none;
    color: #a0aec0;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    z-index: 1;
  }

  .clear-btn:hover {
    color: #718096;
    background: #f7fafc;
  }

  .search-btn {
    background: #4299e1;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 0 12px 12px 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
    border-left: 1px solid #3182ce;
  }

  .search-btn:hover {
    background: #3182ce;
  }

  /* 버튼 스타일 */
  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  /* 사용자 아바타 */
  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .user-avatar.small {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  /* 모바일 카드 */
  .user-cards {
    display: grid;
    gap: 16px;
  }

  .user-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
    transition: all 0.2s;
  }

  .user-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .user-info h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
    color: #2d3748;
  }

  .card-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .card-body {
    display: grid;
    gap: 12px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .label {
    font-weight: 500;
    color: #718096;
    font-size: 14px;
  }

  .value {
    color: #2d3748;
    font-size: 14px;
    font-weight: 500;
  }

  /* 데스크톱 테이블 */
  .users-table {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    background: #f8fafc;
    padding: 16px;
    text-align: left;
    font-weight: 600;
    color: #4a5568;
    font-size: 14px;
    border-bottom: 1px solid #e2e8f0;
  }

  td {
    padding: 16px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .username {
    font-weight: 600;
    color: #2d3748;
    font-size: 14px;
  }

  .user-id {
    font-size: 12px;
    color: #a0aec0;
  }

  .email-cell {
    color: #4a5568;
    font-size: 14px;
  }

  .date-cell {
    color: #718096;
    font-size: 14px;
  }

  /* 역할 배지 */
  .role-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    display: inline-block;
  }

  .role-admin { 
    background: #e6fffa; 
    color: #00695c; 
    border: 1px solid #26a69a;
  }
  
  .role-user { 
    background: #f0fff4; 
    color: #2e7d57; 
    border: 1px solid #48bb78;
  }

  /* 액션 버튼 */
  .action-btn {
    background: none;
    border: 1px solid #e2e8f0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .edit-btn {
    color: #4299e1;
    border-color: #bee3f8;
  }

  .edit-btn:hover {
    background: #ebf8ff;
    border-color: #4299e1;
  }

  .delete-btn {
    color: #f56565;
    border-color: #fed7d7;
  }

  .delete-btn:hover {
    background: #fff5f5;
    border-color: #f56565;
  }

  .table-actions {
    display: flex;
    gap: 8px;
  }

  /* 페이징 */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
  }

  .page-btn {
    background: white;
    border: 1px solid #e2e8f0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4a5568;
    transition: all 0.2s;
  }

  .page-btn:hover:not(:disabled) {
    background: #f7fafc;
    border-color: #cbd5e0;
  }

  .page-btn:disabled {
    background: #f7fafc;
    color: #cbd5e0;
    cursor: not-allowed;
  }

  .page-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #4a5568;
  }

  .current-page {
    color: #4299e1;
  }

  .divider {
    color: #cbd5e0;
  }

  /* 모달 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: white;
    border-radius: 20px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 24px 0 24px;
    margin-bottom: 24px;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #2d3748;
  }

  .close-btn {
    background: none;
    border: none;
    color: #a0aec0;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f7fafc;
    color: #718096;
  }

  .modal form {
    padding: 0 24px 24px 24px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #2d3748;
    font-size: 14px;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 14px;
    box-sizing: border-box;
    transition: border-color 0.2s;
    background: white;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
  }

  .form-hint {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #a0aec0;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 32px;
  }

  .btn-cancel {
    background: #edf2f7;
    color: #4a5568;
    border: none;
    padding: 12px 20px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: background-color 0.2s;
  }

  .btn-cancel:hover {
    background: #e2e8f0;
  }

  /* 로딩 */
  .loading {
    text-align: center;
    padding: 60px 20px;
    color: #718096;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top: 3px solid #4299e1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .users-page {
      padding: 16px;
    }

    .page-header {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
    }

    .header-content h1 {
      font-size: 24px;
    }

    .search-container {
      max-width: none;
    }

    .search-input {
      font-size: 16px; /* iOS 줌 방지 */
    }

    .btn-text {
      display: none;
    }

    .search-btn {
      padding: 12px 16px;
    }

    .modal {
      margin: 16px;
      border-radius: 16px;
    }

    .modal-header {
      padding: 20px 20px 0 20px;
    }

    .modal form {
      padding: 0 20px 20px 20px;
    }

    .modal-actions {
      flex-direction: column;
      gap: 8px;
    }

    .btn-cancel,
    .btn-primary {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .users-page {
      padding: 12px;
    }

    .user-card {
      padding: 16px;
    }

    .header-content h1 {
      font-size: 20px;
    }

    .subtitle {
      font-size: 14px;
    }
  }
</style>
