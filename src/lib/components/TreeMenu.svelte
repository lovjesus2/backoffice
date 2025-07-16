<script>
  import { page } from '$app/stores';
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  const dispatch = createEventDispatcher();
  
  let menus = [];
  let expandedMenus = {};
  let loading = true;
  let error = '';

  onMount(async () => {
    await loadMenus();
  });

  async function loadMenus() {
    if (!browser) return;
    
    try {
      loading = true;
      const response = await fetch('/api/user-menus');
      const data = await response.json();
      
      if (data.success) {
        menus = buildMenuTree(data.data);
      } else {
        console.error('메뉴 로드 실패:', data.message);
        error = data.message;
      }
    } catch (err) {
      console.error('메뉴 로드 오류:', err);
      error = '메뉴를 불러오는데 실패했습니다.';
    } finally {
      loading = false;
    }
  }

  function autoExpandActiveParents() {
    const newExpanded = {};
    
    menus.forEach(menu => {
      if (hasActiveChild(menu)) {
        newExpanded[menu.title] = true;
      } else if (expandedMenus[menu.title]) {
        newExpanded[menu.title] = true;
      }
    });
    
    expandedMenus = newExpanded;
  }

  function buildMenuTree(flatMenus) {
    const menuMap = new Map();
    const rootMenus = [];

    flatMenus.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    flatMenus.forEach(menu => {
      const menuItem = menuMap.get(menu.id);
      if (menu.parent_id) {
        const parent = menuMap.get(menu.parent_id);
        if (parent) {
          parent.children.push(menuItem);
        } else {
          console.warn(`부모 메뉴를 찾을 수 없음: ${menu.parent_id} for ${menu.title}`);
          rootMenus.push(menuItem);
        }
      } else {
        rootMenus.push(menuItem);
      }
    });

    return rootMenus.sort((a, b) => a.sort_order - b.sort_order);
  }

  function isActive(href) {
    // $page를 명시적으로 사용해서 반응성 확보
    return $page.url.pathname === href;
  }

  // $page 변경 시 강제로 상태 업데이트
  $: currentPath = $page.url.pathname;

  function isParentActive(menu) {
    // 부모 메뉴는 자신이 active이거나 하위 메뉴 중 하나가 active일 때 active 표시
    if (menu.href && isActive(menu.href)) {
      return true;
    }
    return hasActiveChild(menu);
  }

  function hasActiveChild(menu) {
    // 하위 메뉴 중 활성화된 것이 있는지만 체크
    return menu.children && menu.children.some(child => isActive(child.href));
  }

  function toggleMenu(menuTitle) {
    expandedMenus[menuTitle] = !expandedMenus[menuTitle];
    expandedMenus = { ...expandedMenus };
  }
</script>

<nav class="tree-menu">
  {#if loading}
    <div class="loading">메뉴 로딩 중...</div>
  {:else if error}
    <div class="error">
      <span>⚠️ {error}</span>
      <button on:click={loadMenus}>다시 시도</button>
    </div>
  {:else if menus.length === 0}
    <div class="no-menus">사용 가능한 메뉴가 없습니다.</div>
  {:else}
    <ul class="menu-list">
      {#each menus as menu}
        <li class="menu-item">
          {#if menu.children && menu.children.length > 0}
            <!-- 하위 메뉴가 있는 부모 메뉴 -->
            <div class="parent-menu-container">
              <button 
                class="parent-menu-button"
                class:active={currentPath === menu.href}
                class:has-active-child={menu.children && menu.children.some(child => currentPath === child.href)}
                on:click={() => toggleMenu(menu.title)}
              >
                <div class="parent-menu-content">
                  <span class="menu-icon">{menu.icon}</span>
                  <span class="menu-title">{menu.title}</span>
                </div>
                <span class="expand-icon" class:expanded={expandedMenus[menu.title]}>
                  ▼
                </span>
              </button>
              
              {#if expandedMenus[menu.title]}
                <ul class="submenu-list">
                  {#each menu.children as child}
                    <li class="submenu-item">
                      <a 
                        href={child.href}
                        class="child-menu-link"
                        class:active={currentPath === child.href}
                        on:click={() => {
                          expandedMenus[menu.title] = true;
                          // 모바일에서만 햄버거 메뉴 닫기
                          if (window.innerWidth <= 768) {
                            dispatch('click');
                          }
                        }}
                      >
                        <span class="child-menu-title">{child.title}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {:else}
            <!-- 단독 메뉴 -->
            <a 
              href={menu.href}
              class="single-menu-link"
              class:active={currentPath === menu.href}
              on:click={() => {
                // 모바일에서만 햄버거 메뉴 닫기
                if (window.innerWidth <= 768) {
                  dispatch('click');
                }
              }}
            >
              <span class="menu-icon">{menu.icon}</span>
              <span class="menu-title">{menu.title}</span>
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</nav>

<style>
  .tree-menu {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
  }
  
  .menu-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  
  .menu-item {
    margin-bottom: 0.5rem;
  }

  /* 공통 스타일 */
  .menu-icon {
    margin-right: 0.5rem;
    font-size: 1.2rem;
  }

  .menu-title,
  .child-menu-title {
    font-weight: 500;
  }

  /* ========== 단독 메뉴 스타일 ========== */
  .single-menu-link {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    color: #333;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 1rem;
  }

  .single-menu-link:hover {
    background: #e3f2fd;
    color: #1976d2;
  }

  .single-menu-link.active {
    background: #1976d2;
    color: white;
    border-left: 4px solid #0d47a1;
    font-weight: 600;
  }

  /* ========== 부모 메뉴 스타일 ========== */
  .parent-menu-container {
    width: 100%;
  }

  .parent-menu-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    color: #333;
    background: none;
    border: none;
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 1rem;
    width: 100%;
    cursor: pointer;
    text-align: left;
  }

  .parent-menu-button:hover {
    background: #e3f2fd;
    color: #1976d2;
  }

  .parent-menu-button.active {
    background: #1976d2;
    color: white;
    border-left: 4px solid #0d47a1;
    font-weight: 600;
  }

  .parent-menu-button.has-active-child {
    background: #f0f9ff;
    color: #1976d2;
    border-left: 3px solid #93c5fd;
  }

  .parent-menu-content {
    display: flex;
    align-items: center;
  }

  .expand-icon {
    font-size: 0.8rem;
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  /* ========== 하위 메뉴 스타일 ========== */
  .submenu-list {
    list-style: none;
    margin: 0.5rem 0 0 0;
    padding: 0;
    padding-left: 1rem;
  }

  .submenu-item {
    margin-bottom: 0.25rem;
  }

  .child-menu-link {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    padding-left: 1.5rem;
    color: #555;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 1rem;
    font-weight: 400;
  }

  .child-menu-link:hover {
    background: #f3e5f5;
    color: #7b1fa2;
  }

  .child-menu-link.active {
    background: #f3e5f5;
    color: #7b1fa2;
    border-left: 3px solid #ba68c8;
    font-weight: 500;
  }

  /* ========== 상태 표시 ========== */
  .loading,
  .no-menus {
    padding: 1rem;
    text-align: center;
    color: #666;
    font-size: 0.9rem;
  }

  .error {
    padding: 1rem;
    text-align: center;
    color: #dc3545;
    font-size: 0.9rem;
  }

  .error button {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .error button:hover {
    background: #c82333;
  }
</style>