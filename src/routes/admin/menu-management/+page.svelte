<!-- src/routes/admin/menu-management/+page.svelte - Tailwind CSS 완전 변환 (중복 제거) -->
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
    icon: '',
    href: '',
    parent_id: null,
    roles: ['admin'],
    is_active: true
  };

  // 🔧 터치 및 마우스 이벤트 변수들
  let touchStartTime = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let isDragging = false;
  let draggedItem = null;
  let dragOverItem = null;
  let longPressTimeout = null;
  
  // 마우스 이벤트 변수들
  let mousePressed = false;
  let mouseStartX = 0;
  let mouseStartY = 0;

  const availableRoles = ['admin', 'user'];
  const availableIcons = ['🏠', '👥', '⚙️', '👤', '📊', '📋', '📁', '🔧', '💼', '🎯', '📈', '🛡️', '📱', '💻', '🌟', '🎨'];

  onMount(() => {
    loadMenus();
    
    // 전체 페이지 텍스트 선택 방지 (드래그 중일 때)
    document.addEventListener('selectstart', preventSelection);
    document.addEventListener('dragstart', preventSelection);
    
    // 전역 마우스 이벤트 (드래그 중 마우스가 카드 밖으로 나가도 동작)
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('selectstart', preventSelection);
      document.removeEventListener('dragstart', preventSelection);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  });

  function preventSelection(e) {
    if (isDragging) {
      e.preventDefault();
      return false;
    }
  }

  function handleGlobalMouseMove(event) {
    if (isDragging) {
      handleMouseMove(event);
    }
  }

  function handleGlobalMouseUp(event) {
    if (isDragging) {
      handleMouseEnd(event);
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

  function resetForm() {
    formData = {
      title: '',
      icon: '',
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
      icon: menu.icon || '',
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
      showToast("메뉴 제목을 입력해주세요.", "error");
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
        showToast(editingMenu ? "메뉴가 수정되었습니다." : "메뉴가 추가되었습니다.", "success");
      } else {
        showToast(result.error, "error");
      }
    } catch (err) {
      showToast("저장 중 오류가 발생했습니다.", "error");
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
        showToast('메뉴가 삭제되었습니다.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
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

  // 🔧 터치 이벤트 핸들러
  function handleTouchStart(event, menu) {
    console.log('👆 터치 시작:', menu.title);
    
    // 버튼 클릭은 무시
    if (event.target.closest('.action-button')) {
      console.log('🚫 버튼 클릭 - 드래그 취소');
      return;
    }
    
    touchStartTime = Date.now();
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
    isDragging = false;
    
    // Long press 타이머 설정
    longPressTimeout = setTimeout(() => {
      if (!isDragging) {
        console.log('⏰ Long press 감지 - 드래그 모드 시작');
        startDragMode(event, menu);
      }
    }, 600);
  }

  function handleTouchMove(event) {
    if (!isDragging && !longPressTimeout) return;
    
    const touch = event.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const deltaX = Math.abs(touch.clientX - touchStartX);
    
    // 세로 움직임이 크면 스크롤 허용 (드래그 중이 아닐 때만)
    if (deltaY > deltaX && deltaY > 15 && !isDragging) {
      console.log('📜 스크롤 감지 - 드래그 취소');
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
      return;
    }
    
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('🎯 드래그 중 - 위치:', touch.clientX, touch.clientY);
      
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const menuCard = elementBelow?.closest('.menu-card');
      
      // 드롭 타겟 초기화
      document.querySelectorAll('.menu-card').forEach(card => {
        card.classList.remove('drop-target');
      });
      
      if (menuCard && menuCard !== event.target.closest('.menu-card')) {
        const menuId = parseInt(menuCard.dataset.menuId);
        const targetMenu = flatMenus.find(m => m.id === menuId);
        
        console.log('🎯 드롭 타겟 후보:', targetMenu?.title);
        
        // 🔧 드래그 규칙 검증
        if (canDropOn(draggedItem, targetMenu)) {
          console.log('✅ 유효한 드롭 타겟');
          menuCard.classList.add('drop-target');
          dragOverItem = targetMenu;
        } else {
          console.log('❌ 무효한 드롭 타겟');
          dragOverItem = null;
        }
      } else {
        dragOverItem = null;
      }
    }
  }

  function handleTouchEnd(event) {
    console.log('🏁 터치 종료');
    
    // Long press 타이머 정리
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('🎯 드래그 종료 - dragOverItem:', dragOverItem?.title);
      
      const cardElement = event.target.closest('.menu-card');
      if (cardElement) {
        cardElement.style.opacity = '1';
        cardElement.classList.remove('dragging');
      }
      
      // 모든 드롭 타겟 스타일 제거
      document.querySelectorAll('.menu-card').forEach(card => {
        card.classList.remove('drop-target');
      });
      
      // 순서 변경 실행
      if (dragOverItem && draggedItem && draggedItem.id !== dragOverItem.id) {
        console.log('🔄 순서 변경 실행:', draggedItem.title, '->', dragOverItem.title);
        reorderMenus(draggedItem, dragOverItem);
      } else {
        console.log('❌ 순서 변경 조건 미충족');
        if (!dragOverItem) console.log('  - dragOverItem이 없음');
        if (!draggedItem) console.log('  - draggedItem이 없음');
        if (draggedItem?.id === dragOverItem?.id) console.log('  - 같은 메뉴');
      }
      
      // 상태 초기화
      isDragging = false;
      draggedItem = null;
      dragOverItem = null;
    }
  }

  // 🔧 마우스 이벤트 핸들러 (데스크톱 지원)
  function handleMouseStart(event, menu) {
    // 버튼 클릭은 무시
    if (event.target.closest('.action-button')) {
      return;
    }
    
    console.log('🖱️ 마우스 시작:', menu.title);
    
    mousePressed = true;
    mouseStartX = event.clientX;
    mouseStartY = event.clientY;
    
    // 즉시 드래그 모드 시작 (마우스는 long press 불필요)
    setTimeout(() => {
      if (mousePressed && !isDragging) {
        console.log('🖱️ 마우스 드래그 모드 시작');
        startDragMode(event, menu);
      }
    }, 100);
  }

  function handleMouseMove(event) {
    if (!mousePressed && !isDragging) return;
    
    const deltaX = Math.abs(event.clientX - mouseStartX);
    const deltaY = Math.abs(event.clientY - mouseStartY);
    
    // 마우스가 충분히 움직였고 드래그 중이면
    if (isDragging && (deltaX > 5 || deltaY > 5)) {
      event.preventDefault();
      
      const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
      const menuCard = elementBelow?.closest('.menu-card');
      
      // 드롭 타겟 초기화
      document.querySelectorAll('.menu-card').forEach(card => {
        card.classList.remove('drop-target');
      });
      
      if (menuCard && menuCard !== event.target.closest('.menu-card')) {
        const menuId = parseInt(menuCard.dataset.menuId);
        const targetMenu = flatMenus.find(m => m.id === menuId);
        
        if (canDropOn(draggedItem, targetMenu)) {
          menuCard.classList.add('drop-target');
          dragOverItem = targetMenu;
        } else {
          dragOverItem = null;
        }
      } else {
        dragOverItem = null;
      }
    }
  }

  function handleMouseEnd(event) {
    console.log('🖱️ 마우스 종료');
    
    mousePressed = false;
    
    if (isDragging) {
      event.preventDefault();
      
      const cardElement = event.target.closest('.menu-card');
      if (cardElement) {
        cardElement.style.opacity = '1';
        cardElement.classList.remove('dragging');
      }
      
      document.querySelectorAll('.menu-card').forEach(card => {
        card.classList.remove('drop-target');
      });
      
      if (dragOverItem && draggedItem && draggedItem.id !== dragOverItem.id) {
        console.log('🖱️ 마우스 순서 변경 실행');
        reorderMenus(draggedItem, dragOverItem);
      }
      
      isDragging = false;
      draggedItem = null;
      dragOverItem = null;
    }
  }

  // 🔧 드래그 모드 시작 (통합 함수)
  function startDragMode(event, menu) {
    console.log('🚀 드래그 모드 시작:', menu.title);
    
    isDragging = true;
    draggedItem = menu;
    
    const cardElement = event.target.closest('.menu-card');
    if (cardElement) {
      cardElement.style.opacity = '0.8';
      cardElement.classList.add('dragging');
    }
    
    // 햅틱 피드백
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    showToast(`드래그 모드: ${menu.title} 📱`, 'info');
  }

  // 🔧 개선된 드래그 규칙 검증 함수
  function canDropOn(draggedMenu, targetMenu) {
    if (!draggedMenu || !targetMenu) {
      console.log('❌ 드래그 규칙: 메뉴가 없음');
      return false;
    }
    
    // 자기 자신에게는 드롭 불가
    if (draggedMenu.id === targetMenu.id) {
      console.log('❌ 드래그 규칙: 자기 자신');
      return false;
    }
    
    // 최상위 메뉴끼리 또는 같은 레벨의 서브 메뉴끼리만 순서 변경 가능
    const draggedIsParent = !draggedMenu.parent_id;
    const targetIsParent = !targetMenu.parent_id;
    
    console.log('🔍 드래그 규칙 검사:');
    console.log('  - 드래그된 메뉴:', draggedMenu.title, '(parent_id:', draggedMenu.parent_id, ')');
    console.log('  - 타겟 메뉴:', targetMenu.title, '(parent_id:', targetMenu.parent_id, ')');
    
    // 둘 다 최상위 메뉴인 경우
    if (draggedIsParent && targetIsParent) {
      console.log('✅ 드래그 규칙: 최상위 메뉴끼리');
      return true;
    }
    
    // 둘 다 서브 메뉴이고 같은 부모를 가진 경우
    if (!draggedIsParent && !targetIsParent && draggedMenu.parent_id === targetMenu.parent_id) {
      console.log('✅ 드래그 규칙: 같은 부모의 서브 메뉴끼리');
      return true;
    }
    
    console.log('❌ 드래그 규칙: 다른 레벨 또는 다른 부모');
    return false;
  }

  // 🔧 개선된 메뉴 순서 변경 함수
  async function reorderMenus(draggedMenu, targetMenu) {
    try {
      console.log('🔄 순서 변경 시작:', draggedMenu.title, '->', targetMenu.title);
      console.log('🔍 드래그된 메뉴:', draggedMenu);
      console.log('🎯 타겟 메뉴:', targetMenu);
      
      // 같은 레벨의 메뉴들만 필터링
      let sameLevelMenus;
      if (draggedMenu.parent_id) {
        // 서브 메뉴의 경우: 같은 부모를 가진 메뉴들
        sameLevelMenus = flatMenus.filter(m => m.parent_id === draggedMenu.parent_id);
        console.log('📂 서브 메뉴 그룹 (parent_id=' + draggedMenu.parent_id + '):', sameLevelMenus);
      } else {
        // 최상위 메뉴의 경우: parent_id가 null인 메뉴들
        sameLevelMenus = flatMenus.filter(m => !m.parent_id);
        console.log('🏠 최상위 메뉴 그룹:', sameLevelMenus);
      }
      
      if (sameLevelMenus.length < 2) {
        showToast('순서를 변경할 메뉴가 충분하지 않습니다.', 'error');
        return;
      }
      
      // 현재 순서대로 정렬
      sameLevelMenus.sort((a, b) => a.sort_order - b.sort_order);
      
      const currentIndex = sameLevelMenus.findIndex(m => m.id === draggedMenu.id);
      const targetIndex = sameLevelMenus.findIndex(m => m.id === targetMenu.id);
      
      console.log('📍 현재 인덱스:', currentIndex, '타겟 인덱스:', targetIndex);
      
      if (currentIndex === -1 || targetIndex === -1) {
        showToast('메뉴를 찾을 수 없습니다.', 'error');
        return;
      }
      
      if (currentIndex === targetIndex) {
        showToast('같은 위치입니다.', 'info');
        return;
      }
      
      // 배열에서 순서 변경
      const newMenus = [...sameLevelMenus];
      const [movedMenu] = newMenus.splice(currentIndex, 1);
      newMenus.splice(targetIndex, 0, movedMenu);
      
      // 새로운 sort_order 할당
      const menuOrders = newMenus.map((menu, index) => ({
        id: menu.id,
        sort_order: index + 1
      }));

      console.log('📤 전송할 순서 데이터:', menuOrders);

      const response = await fetch('/api/menus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuOrders })
      });
      
      const result = await response.json();
      console.log('📡 서버 응답:', result);
      
      if (result.success) {
        await loadMenus();
        showToast('메뉴 순서가 변경되었습니다. ✅', 'success');
      } else {
        showToast('순서 변경 실패: ' + result.error, 'error');
      }
    } catch (err) {
      showToast('순서 변경 중 오류가 발생했습니다.', 'error');
      console.error('❌ 순서 변경 오류:', err);
    }
  }

  // 토스트 메시지 표시
  function showToast(message, type = 'info') {
    if (typeof window === 'undefined') return;
    
    const toast = document.createElement('div');
    toast.textContent = message;
    
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500'
    };
    
    toast.className = `fixed bottom-5 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white font-medium z-50 transition-opacity duration-300 ${colors[type]}`;
    
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
</script>

<svelte:head>
  <title>메뉴 관리 - 관리자</title>
</svelte:head>

<!-- 메인 컨테이너 - padding: 24px, max-width: 1200px -->
<div class="p-6 max-w-7xl mx-auto">
  
  <!-- 페이지 헤더 - margin-bottom: 32px, gap: 20px -->
  <div class="flex justify-between items-start mb-8 gap-5">
    <div>
      <!-- h1: font-size: 28px, font-weight: 700, color: #1a202c, margin: 0 0 8px 0 -->
      <h1 class="text-3xl font-bold text-gray-900 mb-2">⚙️ 메뉴 관리</h1>
      <!-- subtitle: color: #718096, font-size: 16px -->
      <p class="text-gray-500 text-base m-0">시스템 메뉴를 관리하고 순서를 변경할 수 있습니다</p>
    </div>
    
    <!-- 새 메뉴 추가 버튼 -->
    <button 
      class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
      on:click={showAddMenuForm}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2"/>
      </svg>
      새 메뉴
    </button>
  </div>

  {#if loading}
    <!-- 로딩 상태 -->
    <div class="flex flex-col items-center justify-center py-16">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-gray-500">메뉴 정보를 불러오는 중...</p>
    </div>
  {:else if error}
    <!-- 에러 상태 -->
    <div class="flex flex-col items-center justify-center py-16">
      <div class="text-red-500 text-5xl mb-4">❌</div>
      <p class="text-red-600 text-lg">{error}</p>
      <button 
        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        on:click={loadMenus}
      >
        다시 시도
      </button>
    </div>
  {:else}
    <!-- 안내 메시지 -->
    <div class="flex items-center gap-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9,12l2,2 4,-4"></path>
      </svg>
      <span class="text-sm font-medium">메뉴를 길게 눌러서 순서를 변경할 수 있습니다 (같은 레벨끼리만 가능)</span>
    </div>
    
    <!-- 계층 구조 메뉴 카드들 -->
    <div class="space-y-4">
      {#each menus as menu (menu.id)}
        <div 
          class="menu-card bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 select-none cursor-grab active:cursor-grabbing {menu.level > 0 ? 'ml-6 transform scale-95 bg-slate-50 border-slate-300 border-l-4 border-l-blue-500' : ''} {isDragging && draggedItem?.id === menu.id ? 'opacity-80 scale-105 shadow-lg z-50' : ''}"
          class:drop-target={dragOverItem?.id === menu.id}
          data-menu-id={menu.id}
          on:touchstart={(e) => handleTouchStart(e, menu)}
          on:touchmove={handleTouchMove}
          on:touchend={handleTouchEnd}
          on:mousedown={(e) => handleMouseStart(e, menu)}
          on:mousemove={handleMouseMove}
          on:mouseup={handleMouseEnd}
          on:mouseleave={handleMouseEnd}
        >
          <!-- 하위 메뉴 연결선 -->
          {#if menu.level > 0}
            <div class="absolute left-0 top-1/2 w-6 h-px bg-slate-300 -translate-x-6"></div>
            <div class="absolute left-0 top-1/2 w-px h-8 bg-slate-300 -translate-x-6 -translate-y-4"></div>
          {/if}

          <!-- 카드 헤더 - padding: 16px 16px 12px -->
          <div class="flex justify-between items-start p-4 pb-3">
            <div class="flex items-start gap-3 flex-1">
              <!-- 메뉴 아이콘 - font-size: 24px -->
              {#if menu.icon}
                <span class="text-2xl {menu.level > 0 ? 'text-xl' : ''}">{menu.icon}</span>
              {:else}
                <div class="w-6 h-6 {menu.level > 0 ? 'w-5 h-5' : ''}"></div>
              {/if}
              
              <div class="flex-1">
                <!-- 메뉴 제목 -->
                <h3 class="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  {#if menu.level > 0}
                    <span class="text-slate-500 text-sm">└</span>
                  {/if}
                  {menu.title}
                  {#if menu.level > 0}
                    <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">SUB</span>
                  {/if}
                </h3>
                
                {#if menu.level > 0}
                  <!-- 부모 메뉴 표시 -->
                  <p class="text-sm text-slate-500">부모: {getParentMenuName(menu.parent_id)}</p>
                {/if}
              </div>
            </div>
            
            <!-- 카드 메타 정보 -->
            <div class="flex items-center gap-3">
              <!-- 순서 배지 -->
              <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                #{menu.sort_order}
              </span>
              
              <!-- 액션 버튼들 -->
              <div class="flex gap-2">
                <button 
                  class="action-button w-8 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all duration-200 flex items-center justify-center"
                  on:click={() => editMenu(menu)}
                  title="메뉴 편집"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
                
                <button 
                  class="action-button w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all duration-200 flex items-center justify-center"
                  on:click={() => confirmDelete(menu)}
                  title="메뉴 삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="m3 6 18 0M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 카드 정보 섹션 - padding: 0 16px 16px -->
          <div class="px-4 pb-4 grid grid-cols-2 gap-4 text-sm">
            <!-- URL 정보 -->
            <div>
              <div class="text-slate-500 font-medium mb-1">URL</div>
              <div class="text-gray-700 font-mono text-xs bg-gray-50 px-2 py-1 rounded">
                {menu.href || '미설정'}
              </div>
            </div>
            
            <!-- 상태 정보 -->
            <div>
              <div class="text-slate-500 font-medium mb-1">상태</div>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold {menu.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                {menu.is_active ? '활성' : '비활성'}
              </span>
            </div>
            
            <!-- 권한 정보 -->
            <div class="col-span-2">
              <div class="text-slate-500 font-medium mb-2">접근 권한</div>
              <div class="flex flex-wrap gap-2">
                {#each (menu.allowed_roles || ['admin']) as role}
                  <span class="px-2 py-1 {role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} text-xs font-semibold rounded-full">
                    {role}
                  </span>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- 메뉴 추가/편집 모달 -->
{#if showAddForm}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    role="button"
    tabindex="0"
    on:click={resetForm}
    on:keydown={(e) => e.key === 'Escape' && resetForm()}
  >
    <div 
      class="bg-white rounded-2xl max-w-lg w-full max-h-screen overflow-y-auto"
      on:click|stopPropagation
      role="dialog" 
      tabindex="-1"
    >
      <!-- 모달 헤더 -->
      <div class="flex justify-between items-center px-6 pt-6 pb-0">
        <h2 class="text-xl font-bold text-gray-900">
          {editingMenu ? '✏️ 메뉴 편집' : '🆕 새 메뉴 추가'}
        </h2>
        <button 
          class="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 transition-all duration-200 flex items-center justify-center"
          on:click={resetForm}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="m18 6-12 12M6 6l12 12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
      
      <!-- 모달 폼 -->
      <form on:submit|preventDefault={saveMenu} class="p-6">
        <!-- 메뉴 제목 -->
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">메뉴 제목 *</label>
          <input 
            type="text" 
            bind:value={formData.title}
            required 
            placeholder="메뉴 이름을 입력하세요"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>
        
        <!-- 아이콘 선택 -->
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">아이콘</label>
          <div class="flex flex-col gap-3">
            <!-- 없음 옵션 -->
            <button
              type="button"
              class="w-full px-4 py-3 text-left border-2 rounded-lg transition-all duration-200 {formData.icon === '' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}"
              on:click={() => formData.icon = ''}
            >
              <span class="text-gray-500 font-medium">없음</span>
            </button>
            
            <!-- 아이콘 그리드 -->
            <div class="grid grid-cols-8 gap-2">
              {#each availableIcons as icon}
                <button
                  type="button"
                  class="w-10 h-10 text-xl border-2 rounded-lg transition-all duration-200 {formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}"
                  on:click={() => formData.icon = icon}
                >
                  {icon}
                </button>
              {/each}
            </div>
          </div>
        </div>
        
        <!-- URL -->
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">URL</label>
          <input 
            type="text" 
            bind:value={formData.href}
            placeholder="/admin/example"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-mono text-sm"
          />
        </div>
        
        <!-- 부모 메뉴 -->
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">부모 메뉴</label>
          <select 
            bind:value={formData.parent_id}
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
          >
            <option value={null}>최상위 메뉴</option>
            {#each flatMenus.filter(m => !m.parent_id) as parentMenu}
              <option value={parentMenu.id}>{parentMenu.title}</option>
            {/each}
          </select>
        </div>
        
        <!-- 권한 설정 -->
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">접근 권한</label>
          <div class="flex gap-3">
            {#each availableRoles as role}
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={formData.roles.includes(role)}
                  on:change={() => toggleRole(role)}
                />
                <span class="text-sm font-medium text-gray-700 capitalize">{role}</span>
              </label>
            {/each}
          </div>
        </div>
        
        <!-- 활성 상태 -->
        <div class="mb-8">
          <label class="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              bind:checked={formData.is_active}
            />
            <span class="text-sm font-semibold text-gray-700">메뉴 활성화</span>
          </label>
        </div>
        
        <!-- 액션 버튼 -->
        <div class="flex gap-3 justify-end">
          <button 
            type="button" 
            class="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
            on:click={resetForm}
          >
            취소
          </button>
          <button 
            type="submit" 
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 font-medium"
          >
            {editingMenu ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 삭제 확인 모달 -->
{#if showDeleteConfirm}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    role="button"
    tabindex="0"
    on:click={() => showDeleteConfirm = false}
    on:keydown={(e) => e.key === 'Escape' && (showDeleteConfirm = false)}
  >
    <div 
      class="bg-white rounded-2xl max-w-md w-full"
      on:click|stopPropagation
      role="dialog"
      tabindex="-1"
    >
      <div class="p-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-red-600">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">메뉴 삭제</h3>
            <p class="text-gray-600">정말로 삭제하시겠습니까?</p>
          </div>
        </div>
        
        {#if menuToDelete}
          <div class="bg-gray-50 rounded-lg p-3 mb-6">
            <div class="flex items-center gap-2">
              {#if menuToDelete.icon}
                <span class="text-xl">{menuToDelete.icon}</span>
              {:else}
                <div class="w-5 h-5 bg-gray-300 rounded"></div>
              {/if}
              <span class="font-medium text-gray-800">{menuToDelete.title}</span>
            </div>
          </div>
        {/if}
        
        <div class="flex gap-3 justify-end">
          <button 
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
            on:click={() => showDeleteConfirm = false}
          >
            취소
          </button>
          <button 
            class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200"
            on:click={deleteMenu}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* 드롭 타겟 스타일 */
  .drop-target {
    @apply border-blue-500 bg-blue-50;
  }
  
  /* 드래그 중 스타일 */
  .menu-card.dragging {
    @apply opacity-80 scale-105 shadow-lg z-50;
  }
  
  /* 텍스트 선택 방지 */
  .select-none {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
</style>