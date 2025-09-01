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

<nav class="bg-gray-50 rounded-lg p-4">
  {#if loading}
    <div class="p-4 text-center text-gray-600 text-sm">메뉴 로딩 중...</div>
  {:else if error}
    <div class="p-4 text-center text-red-600 text-sm">
      <div>{error}</div>
      <button 
        class="mt-2 px-2 py-1 bg-red-600 text-white border-0 rounded text-xs cursor-pointer hover:bg-red-700 transition-colors duration-200"
        on:click={loadMenus}
      >
        다시 시도
      </button>
    </div>
  {:else if menus.length === 0}
    <div class="p-4 text-center text-gray-600 text-sm">메뉴가 없습니다.</div>
  {:else}
    <ul class="list-none m-0 p-0">
      {#each menus as menu}
        <li class="mb-2">
          {#if menu.children && menu.children.length > 0}
            <!-- 부모 메뉴 -->
            <div class="w-full">
              <button
                class="flex items-center justify-between px-4 py-3 text-gray-700 bg-transparent border-0 rounded-md transition-all duration-200 text-xs w-full cursor-pointer text-left font-medium
                       hover:bg-blue-50 hover:text-blue-600
                       {menu.href && isActive(menu.href) ? 'bg-blue-600 text-white border-l-4 border-blue-800 font-semibold' : ''}
                       {hasActiveChild(menu) && !(menu.href && isActive(menu.href)) ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-300' : ''}"
                on:click={() => toggleMenu(menu.title)}
              >
                <div class="flex items-center">
                  <span class="mr-2 text-lg">{menu.icon}</span>
                  <span class="font-medium">{menu.title}</span>
                </div>
                <span class="text-xs transition-transform duration-200 flex-shrink-0 {expandedMenus[menu.title] ? 'rotate-180' : ''}">
                  ▼
                </span>
              </button>
              
              {#if expandedMenus[menu.title]}
                <ul class="list-none mt-2 mb-0 p-0 pl-4">
                  {#each menu.children as child}
                    <li class="mb-1">
                      <a 
                        href={child.href}
                        class="flex items-center px-4 py-2 pl-6 text-gray-600 no-underline rounded-md transition-all duration-200 text-xs font-normal
                               hover:bg-purple-50 hover:text-purple-700
                               {currentPath === child.href ? 'bg-purple-50 text-purple-700 border-l-[3px] border-purple-400 font-medium' : ''}"
                        on:click={() => {
                          // 모바일에서만 햄버거 메뉴 닫기
                          if (window.innerWidth <= 768) {
                            dispatch('click');
                          }
                        }}
                      >
                        <span class="mr-2 text-lg">{child.icon}</span>
                        <span class="font-medium">{child.title}</span>
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
              class="flex items-center px-4 py-3 text-gray-700 no-underline rounded-md transition-all duration-200 text-xs
                     hover:bg-blue-50 hover:text-blue-600
                     {currentPath === menu.href ? 'bg-blue-600 text-white border-l-4 border-blue-800 font-semibold' : ''}"
              on:click={() => {
                // 모바일에서만 햄버거 메뉴 닫기
                if (window.innerWidth <= 768) {
                  dispatch('click');
                }
              }}
            >
              <span class="mr-2 text-lg">{menu.icon}</span>
              <span class="font-medium">{menu.title}</span>
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</nav>