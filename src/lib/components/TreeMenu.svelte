<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
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
        // 계층 구조로 변환
        menus = buildMenuTree(data.data);
        console.log('메뉴 트리 구조:', menus);
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

  // 평면 메뉴 배열을 계층 구조로 변환
  function buildMenuTree(flatMenus) {
    const menuMap = new Map();
    const rootMenus = [];

    // 먼저 모든 메뉴를 맵에 저장
    flatMenus.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // 부모-자식 관계 설정
    flatMenus.forEach(menu => {
      const menuItem = menuMap.get(menu.id);
      if (menu.parent_id) {
        const parent = menuMap.get(menu.parent_id);
        if (parent) {
          parent.children.push(menuItem);
        } else {
          console.warn(`부모 메뉴를 찾을 수 없음: ${menu.parent_id} for ${menu.title}`);
          rootMenus.push(menuItem); // 부모를 찾을 수 없으면 루트로
        }
      } else {
        rootMenus.push(menuItem);
      }
    });

    return rootMenus.sort((a, b) => a.sort_order - b.sort_order);
  }

  function isActive(href) {
    return $page.url.pathname === href;
  }

  function isParentActive(menu) {
    if (menu.children && menu.children.length > 0) {
      return menu.children.some(child => isActive(child.href)) || (menu.href && isActive(menu.href));
    }
    return menu.href && isActive(menu.href);
  }

  function toggleMenu(menuTitle) {
    expandedMenus[menuTitle] = !expandedMenus[menuTitle];
    expandedMenus = { ...expandedMenus };
  }

  // 현재 활성 메뉴의 부모를 자동으로 펼치기
  $: {
    if (menus.length > 0) {
      menus.forEach(menu => {
        if (menu.children && menu.children.length > 0 && isParentActive(menu)) {
          expandedMenus[menu.title] = true;
        }
      });
    }
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
            <!-- 하위 메뉴가 있는 경우 -->
            <div class="menu-parent">
              <button 
                class="menu-link parent-link"
                class:active={isParentActive(menu)}
                on:click={() => toggleMenu(menu.title)}
              >
                <div class="parent-content">
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
                        class="menu-link submenu-link"
                        class:active={isActive(child.href)}
                      >
                        <!-- 하위 메뉴는 아이콘 없이 텍스트만 -->
                        <span class="menu-title">{child.title}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {:else}
            <!-- 단일 메뉴인 경우 -->
            <a 
              href={menu.href}
              class="menu-link"
              class:active={isActive(menu.href)}
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
  
  .menu-parent {
    width: 100%;
  }
  
  .menu-link {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    color: #333;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s;
    font-weight: 500;
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-size: 1rem;
  }
  
  /* 호버 효과만 */
  .menu-link:hover {
    background: #e3f2fd;
    color: #1976d2;
  }
  
  /* 활성 상태 - 더 부드러운 스타일 */
  .menu-link.active {
    background: #1976d2;
    color: white;
    border-left: 4px solid #0d47a1;
    font-weight: 600;
  }
  
  .parent-link {
    justify-content: space-between;
  }
  
  .parent-content {
    display: flex;
    align-items: center;
  }
  
  .menu-icon {
    margin-right: 0.5rem;
    font-size: 1.2rem;
  }
  
  .expand-icon {
    font-size: 0.8rem;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  
  .expand-icon.expanded {
    transform: rotate(180deg);
  }
  
  .submenu-list {
    list-style: none;
    margin: 0.5rem 0 0 0;
    padding: 0;
    padding-left: 1rem;
  }
  
  .submenu-item {
    margin-bottom: 0.25rem;
  }
  
  .submenu-link {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    font-weight: 400;
    padding-left: 1.5rem;
  }
  
  /* 하위 메뉴 호버 */
  .submenu-link:hover {
    background: #f3e5f5;
    color: #7b1fa2;
  }
  
  /* 하위 메뉴 활성화 */
  .submenu-link.active {
    background: #7b1fa2;
    color: white;
    border-left: 4px solid #4a148c;
    font-weight: 500;
  }

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
