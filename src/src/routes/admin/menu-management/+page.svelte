<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let menus = [];
  let flatMenus = []; // 원본 평면 배열 (드래그용)
  let loading = true;
  let error = '';
  let showAddForm = false;
  let editingMenu = null;
  let showDeleteConfirm = false;
  let menuToDelete = null;
  
  // 폼 데이터
  let formData = {
    title: '',
    icon: '📄',
    href: '',
    parent_id: null,
    roles: ['admin'],
    is_active: true
  };

  // 터치 이벤트 개선
  let touchStartTime = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let isDragging = false;
  let draggedItem = null;
  let dragOverItem = null;
  let longPressTimeout = null;

  const availableRoles = ['admin', 'user'];
  const availableIcons = ['🏠', '👥', '⚙️', '👤', '📊', '📋', '📁', '🔧', '💼', '🎯', '📈', '🛡️', '📱', '💻', '🌟', '🎨'];

  onMount(() => {
    loadMenus();
    
    // 전체 페이지 텍스트 선택 방지 (드래그 중일 때)
    document.addEventListener('selectstart', preventSelection);
    document.addEventListener('dragstart', preventSelection);
    
    return () => {
      document.removeEventListener('selectstart', preventSelection);
      document.removeEventListener('dragstart', preventSelection);
    };
  });

  function preventSelection(e) {
    if (isDragging) {
      e.preventDefault();
      return false;
    }
  }

  async function loadMenus() {
    try {
      loading = true;
      const response = await fetch('/api/menus');
      const result = await response.json();
      
      if (result.success) {
        flatMenus = result.data.sort((a, b) => a.sort_order - b.sort_order);
        // 계층 구조로 변환
        menus = buildMenuTree(flatMenus);
        console.log('메뉴 트리 구조:', menus);
      } else {
        error = result.error || '메뉴를 불러올 수 없습니다.';
      }
    } catch (err) {
      error = '서버와 연결할 수 없습니다.';
      console.error('메뉴 로딩 오류:', err);
    } finally {
      loading = false;
    }
  }

  // 평면 메뉴 배열을 계층 구조로 변환 (표시용)
  function buildMenuTree(flatMenus) {
    const result = [];
    
    // 최상위 메뉴들 먼저 추가
    const rootMenus = flatMenus.filter(menu => !menu.parent_id);
    
    rootMenus.forEach(rootMenu => {
      result.push({ ...rootMenu, level: 0 });
      
      // 해당 부모의 자식 메뉴들 추가
      const children = flatMenus.filter(menu => menu.parent_id === rootMenu.id);
      children.forEach(child => {
        result.push({ ...child, level: 1 });
      });
    });
    
    return result;
  }

  // 평면 배열로 다시 변환 (드래그용)
  function flattenMenus(treeMenus) {
    return treeMenus.map(({ level, ...menu }) => menu);
  }

  function resetForm() {
    formData = {
      title: '',
      icon: '📄',
      href: '',
      parent_id: null,
      roles: ['admin'],
      is_active: true
    };
    editingMenu = null;
    showAddForm = false;
  }

  function showAddMenuForm() {
    resetForm();
    showAddForm = true;
  }

  function editMenu(menu) {
    formData = {
      title: menu.title,
      icon: menu.icon,
      href: menu.href,
      parent_id: menu.parent_id,
      roles: menu.allowed_roles || ['admin'],
      is_active: Boolean(menu.is_active)
    };
    editingMenu = menu;
    showAddForm = true;
  }

  async function saveMenu() {
    if (!formData.title || !formData.title.trim()) {
      showErrorToast("메뉴 제목을 입력해주세요.");
      return;
    }

    try {
      const url = editingMenu ? `/api/menus/${editingMenu.id}` : "/api/menus";
      const method = editingMenu ? "PUT" : "POST";
      
      // undefined 값 완전 제거한 안전한 데이터 생성
      const safeData = {
        title: (formData.title || "").trim(),
        icon: formData.icon || "",
        href: formData.href || "",
        parent_id: formData.parent_id || null,
        roles: Array.isArray(formData.roles) ? formData.roles : ["admin"],
        is_active: Boolean(formData.is_active)
      };
      
      console.log("전송할 안전한 데이터:", JSON.stringify(safeData, null, 2));
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safeData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadMenus();
        resetForm();
        showSuccessToast(editingMenu ? "메뉴가 수정되었습니다." : "메뉴가 추가되었습니다.");
      } else {
        showErrorToast(result.error);
      }
    } catch (err) {
      showErrorToast("저장 중 오류가 발생했습니다.");
      console.error("저장 오류:", err);
    }
  }

  function confirmDelete(menu) {
    menuToDelete = menu;
    showDeleteConfirm = true;
  }

  async function deleteMenu() {
    if (!menuToDelete) return;
    
    try {
      const response = await fetch(`/api/menus/${menuToDelete.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadMenus();
        showSuccessToast('메뉴가 삭제되었습니다.');
      } else {
        showErrorToast(result.error);
      }
    } catch (err) {
      showErrorToast('삭제 중 오류가 발생했습니다.');
      console.error('삭제 오류:', err);
    } finally {
      showDeleteConfirm = false;
      menuToDelete = null;
    }
  }

  function toggleRole(role) {
    if (formData.roles.includes(role)) {
      formData.roles = formData.roles.filter(r => r !== role);
    } else {
      formData.roles = [...formData.roles, role];
    }
  }

  function getParentMenuName(parentId) {
    if (!parentId) return null;
    const parent = flatMenus.find(m => m.id === parentId);
    return parent ? parent.title : '알 수 없음';
  }

  // 개선된 터치 이벤트 핸들러 (최상위 메뉴만 드래그 가능)
  function handleTouchStart(event, menu) {
    // 하위 메뉴는 드래그 불가
    if (menu.level > 0) return;
    
    // 버튼 클릭은 무시
    if (event.target.closest('.action-button')) {
      return;
    }
    
    touchStartTime = Date.now();
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
    isDragging = false;
    
    longPressTimeout = setTimeout(() => {
      if (!isDragging) {
        startDragMode(event, menu);
      }
    }, 600);
  }

  function handleTouchMove(event) {
    const touch = event.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const deltaX = Math.abs(touch.clientX - touchStartX);
    
    if (deltaY > deltaX && deltaY > 15 && !isDragging) {
      clearTimeout(longPressTimeout);
      return;
    }
    
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const menuCard = elementBelow?.closest('.menu-card:not(.submenu-card)'); // 최상위 메뉴만
      
      document.querySelectorAll('.menu-card').forEach(card => {
        card.classList.remove('drop-target');
      });
      
      if (menuCard && menuCard !== event.target.closest('.menu-card')) {
        menuCard.classList.add('drop-target');
        const menuId = parseInt(menuCard.dataset.menuId);
        dragOverItem = flatMenus.find(m => m.id === menuId);
      }
    }
  }

  function handleTouchEnd(event) {
    clearTimeout(longPressTimeout);
    
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      
      const cardElement = event.target.closest('.menu-card');
      if (cardElement) {
        cardElement.style.opacity = '1';
        cardElement.classList.remove('dragging');
      }
      
      document.querySelectorAll('.menu-card').forEach(card => {
        card.classList.remove('drop-target');
      });
      
      if (dragOverItem && draggedItem && draggedItem.id !== dragOverItem.id) {
        reorderMenus(draggedItem, dragOverItem);
      }
      
      isDragging = false;
      draggedItem = null;
      dragOverItem = null;
    }
  }

  function startDragMode(event, menu) {
    isDragging = true;
    draggedItem = menu;
    
    const cardElement = event.target.closest('.menu-card');
    if (cardElement) {
      cardElement.style.opacity = '0.8';
      cardElement.classList.add('dragging');
    }
    
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    showSuccessToast('드래그 모드 활성화');
  }

  async function reorderMenus(draggedMenu, targetMenu) {
    try {
      const currentIndex = flatMenus.findIndex(m => m.id === draggedMenu.id);
      const targetIndex = flatMenus.findIndex(m => m.id === targetMenu.id);
      
      const newMenus = [...flatMenus];
      const [movedMenu] = newMenus.splice(currentIndex, 1);
      newMenus.splice(targetIndex, 0, movedMenu);
      
      const menuOrders = newMenus.map((menu, index) => ({
        id: menu.id,
        sort_order: index + 1
      }));

      const response = await fetch('/api/menus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuOrders })
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadMenus();
        showSuccessToast('메뉴 순서가 변경되었습니다.');
      } else {
        showErrorToast('순서 변경 실패: ' + result.error);
      }
    } catch (err) {
      showErrorToast('순서 변경 중 오류가 발생했습니다.');
      console.error('순서 변경 오류:', err);
    }
  }

  // 토스트 알림
  let toastMessage = '';
  let toastType = '';
  let toastVisible = false;

  function showSuccessToast(message) {
    toastMessage = message;
    toastType = 'success';
    toastVisible = true;
    setTimeout(() => { toastVisible = false; }, 2000);
  }

  function showErrorToast(message) {
    toastMessage = message;
    toastType = 'error';
    toastVisible = true;
    setTimeout(() => { toastVisible = false; }, 3000);
  }
</script>

<svelte:head>
  <title>메뉴 관리 - 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
</svelte:head>

<div class="mobile-menu-management">
  <!-- 세련된 헤더 -->
  <div class="modern-header">
    <h1>메뉴 관리</h1>
    <button class="add-button" on:click={showAddMenuForm}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>

  <!-- 스크롤 가능한 콘텐츠 영역 -->
  <div class="content-area">
    <!-- 에러 메시지 -->
    {#if error}
      <div class="error-alert">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        {error}
      </div>
    {/if}

    <!-- 로딩 -->
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>메뉴 정보를 불러오는 중...</p>
      </div>
    {:else}
      <!-- 안내 메시지 -->
      <div class="info-tip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9,12l2,2 4,-4"></path>
        </svg>
        최상위 메뉴를 길게 눌러서 순서를 변경할 수 있습니다
      </div>
      
      <!-- 계층 구조 메뉴 카드들 -->
      <div class="menu-cards">
        {#each menus as menu (menu.id)}
          <div 
            class="menu-card"
            class:submenu-card={menu.level > 0}
            class:dragging={isDragging && draggedItem?.id === menu.id}
            data-menu-id={menu.id}
            on:touchstart={(e) => handleTouchStart(e, menu)}
            on:touchmove={handleTouchMove}
            on:touchend={handleTouchEnd}
          >
            <!-- 하위 메뉴 연결선 -->
            {#if menu.level > 0}
              <div class="submenu-connector"></div>
            {/if}

            <!-- 카드 헤더 -->
            <div class="card-header">
              <div class="menu-basic-info">
                <span class="menu-icon">{menu.icon}</span>
                <div class="menu-details">
                  <h3 class="menu-title">
                    {#if menu.level > 0}
                      <span class="submenu-indicator">└</span>
                    {/if}
                    {menu.title}
                  </h3>
                  {#if menu.level > 0}
                    <span class="parent-menu">부모: {getParentMenuName(menu.parent_id)}</span>
                  {/if}
                </div>
              </div>
              
              <div class="card-meta">
                <span class="order-badge">#{menu.sort_order}</span>
                <div class="status-indicator" class:active={menu.is_active}></div>
                {#if menu.level > 0}
                  <span class="level-badge">하위</span>
                {/if}
              </div>
            </div>

            <!-- 카드 정보 -->
            {#if menu.href || (menu.allowed_roles && menu.allowed_roles.length > 0)}
              <div class="card-info">
                {#if menu.href}
                  <div class="info-item">
                    <span class="info-label">링크</span>
                    <code class="info-value">{menu.href}</code>
                  </div>
                {/if}
                
                {#if menu.allowed_roles && menu.allowed_roles.length > 0}
                  <div class="info-item">
                    <span class="info-label">권한</span>
                    <div class="role-chips">
                      {#each menu.allowed_roles as role}
                        <span class="role-chip {role}">{role}</span>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- 카드 액션 -->
            <div class="card-actions">
              <button class="action-button edit" on:click={() => editMenu(menu)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                수정
              </button>
              <button class="action-button delete" on:click={() => confirmDelete(menu)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                삭제
              </button>
            </div>

            <!-- 드래그 인디케이터 (최상위 메뉴만) -->
            {#if menu.level === 0}
              <div class="drag-indicator">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="12" r="1"></circle>
                  <circle cx="9" cy="5" r="1"></circle>
                  <circle cx="9" cy="19" r="1"></circle>
                  <circle cx="15" cy="12" r="1"></circle>
                  <circle cx="15" cy="5" r="1"></circle>
                  <circle cx="15" cy="19" r="1"></circle>
                </svg>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 기존 모달들 (폼, 삭제 확인, 토스트) - 동일 -->
  {#if showAddForm}
    <div class="fullscreen-modal">
      <div class="modal-header">
        <button class="back-button" on:click={resetForm}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>
        <h2>{editingMenu ? '메뉴 수정' : '새 메뉴 추가'}</h2>
        <button class="save-button" on:click={saveMenu}>저장</button>
      </div>

      <div class="modal-content">
        <div class="form-group">
          <label class="form-label">메뉴 제목 *</label>
          <input
            class="form-input"
            type="text"
            bind:value={formData.title}
            placeholder="메뉴 제목을 입력하세요"
            maxlength="50"
          />
        </div>

        <div class="form-group">
          <label class="form-label">아이콘</label>
          <div class="icon-selector">
            {#each availableIcons as icon}
              <button
                class="icon-button"
                class:selected={formData.icon === icon}
                on:click={() => formData.icon = icon}
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">링크 (href)</label>
          <input
            class="form-input"
            type="text"
            bind:value={formData.href}
            placeholder="/admin/example"
          />
        </div>

        <div class="form-group">
          <label class="form-label">상위 메뉴</label>
          <select class="form-select" bind:value={formData.parent_id}>
            <option value={null}>없음 (최상위 메뉴)</option>
            {#each flatMenus.filter(m => !m.parent_id && (!editingMenu || m.id !== editingMenu.id)) as menu}
              <option value={menu.id}>{menu.title}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">접근 권한</label>
          <div class="role-selector">
            {#each availableRoles as role}
              <button
                class="role-button"
                class:active={formData.roles.includes(role)}
                on:click={() => toggleRole(role)}
              >
                <div class="role-check">
                  {#if formData.roles.includes(role)}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  {/if}
                </div>
                {role}
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label class="toggle-switch">
            <input
              type="checkbox"
              bind:checked={formData.is_active}
              class="toggle-input"
            />
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
            <span class="toggle-label">메뉴 활성화</span>
          </label>
        </div>
      </div>
    </div>
  {/if}

  <!-- 삭제 확인 모달 -->
  {#if showDeleteConfirm}
    <div class="overlay">
      <div class="confirm-modal">
        <div class="confirm-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </div>
        <h3>메뉴 삭제</h3>
        <p>"{menuToDelete?.title}" 메뉴를<br>정말 삭제하시겠습니까?</p>
        <div class="confirm-actions">
          <button class="confirm-button cancel" on:click={() => showDeleteConfirm = false}>
            취소
          </button>
          <button class="confirm-button delete" on:click={deleteMenu}>
            삭제
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 토스트 -->
  {#if toastVisible}
    <div class="toast {toastType}">
      <div class="toast-icon">
        {#if toastType === 'success'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        {/if}
      </div>
      <span class="toast-message">{toastMessage}</span>
    </div>
  {/if}
</div>

<style>
  .mobile-menu-management {
    min-height: 100vh;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
  }

  /* ========== 기존 스타일 유지 ========== */
  .modern-header {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 10;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .modern-header h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: -0.025em;
  }

  .add-button {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #3b82f6;
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
  }

  .add-button:active {
    transform: scale(0.95);
    background: #2563eb;
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 1.25rem 2rem;
  }

  .error-alert {
    background: #fee2e2;
    color: #dc2626;
    padding: 0.875rem 1rem;
    border-radius: 12px;
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .info-tip {
    background: #eff6ff;
    color: #1d4ed8;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .loading-state {
    text-align: center;
    padding: 3rem 2rem;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* ========== 계층 구조 메뉴 카드 ========== */
  .menu-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .menu-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    transition: all 0.2s ease;
    touch-action: pan-y;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  /* ========== 하위 메뉴 스타일 ========== */
  .submenu-card {
    margin-left: 1.5rem;
    margin-top: 0.25rem;
    transform: scale(0.95);
    background: #f8fafc;
    border-color: #cbd5e1;
    border-left: 3px solid #3b82f6;
    position: relative;
  }

  .submenu-connector {
    position: absolute;
    left: -1.5rem;
    top: 50%;
    width: 1.5rem;
    height: 1px;
    background: #cbd5e1;
    z-index: 1;
  }

  .submenu-connector::before {
    content: '';
    position: absolute;
    left: -1px;
    top: -15px;
    width: 1px;
    height: 30px;
    background: #cbd5e1;
  }

  .submenu-indicator {
    color: #64748b;
    margin-right: 0.25rem;
    font-size: 0.9rem;
  }

  .level-badge {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.125rem 0.375rem;
    border-radius: 8px;
    font-size: 0.6875rem;
    font-weight: 600;
    margin-left: 0.25rem;
  }

  .menu-card:active {
    transform: scale(0.995);
  }

  .submenu-card:active {
    transform: scale(0.92);
  }

  .menu-card.dragging {
    opacity: 0.8;
    transform: scale(1.02);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 50;
    pointer-events: none;
  }

  .menu-card.drop-target {
    border-color: #3b82f6;
    background: #f0f9ff;
  }

  /* ========== 기존 카드 내부 스타일 유지 ========== */
  .card-header,
  .menu-basic-info,
  .menu-details,
  .menu-title,
  .parent-menu,
  .card-meta,
  .order-badge,
  .card-info,
  .info-item,
  .info-label,
  .info-value,
  .role-chips,
  .role-chip {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .card-header {
    padding: 1rem 1rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .menu-basic-info {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
  }

  .menu-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .submenu-card .menu-icon {
    font-size: 1.25rem;
  }

  .menu-details {
    flex: 1;
  }

  .menu-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
  }

  .submenu-card .menu-title {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .parent-menu {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
    display: block;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .order-badge {
    background: #f1f5f9;
    color: #475569;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
  }

  .status-indicator.active {
    background: #10b981;
  }

  .card-info {
    padding: 0 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-label {
    font-size: 0.75rem;
    color: #64748b;
    min-width: 32px;
    font-weight: 500;
  }

  .info-value {
    background: #f8fafc;
    color: #e11d48;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }

  .role-chips {
    display: flex;
    gap: 0.25rem;
  }

  .role-chip {
    padding: 0.125rem 0.375rem;
    border-radius: 8px;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .role-chip.admin {
    background: #fef3c7;
    color: #92400e;
  }

  .role-chip.user {
    background: #dbeafe;
    color: #1e40af;
  }

  .card-actions {
    padding: 0.75rem 1rem 1rem;
    display: flex;
    gap: 0.5rem;
    border-top: 1px solid #f1f5f9;
  }

  .action-button {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    transition: all 0.2s ease;
    min-height: 36px;
    touch-action: manipulation;
    pointer-events: auto;
  }

  .action-button.edit {
    color: #1e40af;
  }

  .action-button.edit:active {
    background: #eff6ff;
    border-color: #3b82f6;
    transform: scale(0.98);
  }

  .action-button.delete {
    color: #dc2626;
  }

  .action-button.delete:active {
    background: #fef2f2;
    border-color: #ef4444;
    transform: scale(0.98);
  }

  .drag-indicator {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #cbd5e1;
    pointer-events: none;
  }

  /* ========== 기존 모달 스타일들 유지 ========== */
  .fullscreen-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #ffffff;
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .back-button, .save-button {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .save-button {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .save-button:active {
    background: #2563eb;
    transform: scale(0.95);
  }

  .back-button:active {
    background: #f8fafc;
    transform: scale(0.95);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1.25rem 3rem;
    -webkit-overflow-scrolling: touch;
  }

  /* ========== 기존 폼 스타일들 계속 ========== */
  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #1e293b;
    font-size: 0.875rem;
  }

  .form-input, .form-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    background: #ffffff;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .form-input:focus, .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .icon-selector {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
  }

  .icon-button {
    aspect-ratio: 1;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .icon-button:active {
    transform: scale(0.95);
  }

  .icon-button.selected {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .role-selector {
    display: flex;
    gap: 0.75rem;
  }

  .role-button {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .role-button:active {
    transform: scale(0.98);
  }

  .role-button.active {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1e40af;
  }

  .role-check {
    width: 18px;
    height: 18px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
  }

  .role-button.active .role-check {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    position: relative;
  }

  .toggle-input {
    display: none;
  }

  .toggle-track {
    width: 44px;
    height: 24px;
    background: #d1d5db;
    border-radius: 12px;
    position: relative;
    transition: all 0.3s ease;
  }

  .toggle-thumb {
    position: absolute;
    width: 20px;
    height: 20px;
    background: #ffffff;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-input:checked + .toggle-track {
    background: #3b82f6;
  }

  .toggle-input:checked ~ .toggle-thumb {
    transform: translateX(20px);
  }

  .toggle-label {
    font-weight: 500;
    color: #1e293b;
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 2rem;
  }

  .confirm-modal {
    background: #ffffff;
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
    max-width: 320px;
    width: 100%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .confirm-icon {
    margin-bottom: 1rem;
  }

  .confirm-modal h3 {
    margin: 0 0 0.75rem;
    color: #1e293b;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .confirm-modal p {
    margin: 0 0 1.5rem;
    color: #64748b;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: 0.75rem;
  }

  .confirm-button {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .confirm-button.cancel {
    background: #f1f5f9;
    color: #475569;
  }

  .confirm-button.cancel:active {
    background: #e2e8f0;
    transform: scale(0.98);
  }

  .confirm-button.delete {
    background: #ef4444;
    color: white;
  }

  .confirm-button.delete:active {
    background: #dc2626;
    transform: scale(0.98);
  }

  .toast {
    position: fixed;
    bottom: 2rem;
    left: 1.25rem;
    right: 1.25rem;
    padding: 1rem;
    border-radius: 12px;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 3000;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: slideUp 0.3s ease;
    font-weight: 500;
  }

  .toast.success {
    background: #10b981;
  }

  .toast.error {
    background: #ef4444;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .toast-icon {
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
  }

  @supports (padding: max(0px)) {
    .modern-header {
      padding-top: max(1rem, env(safe-area-inset-top));
    }
    
    .content-area {
      padding-bottom: max(2rem, env(safe-area-inset-bottom) + 2rem);
    }
    
    .toast {
      bottom: max(2rem, env(safe-area-inset-bottom) + 1rem);
      left: max(1.25rem, env(safe-area-inset-left));
      right: max(1.25rem, env(safe-area-inset-right));
    }
  }
</style>
