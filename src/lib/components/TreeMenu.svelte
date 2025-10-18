<!-- src/lib/components/TreeMenu.svelte -->
<script>
  import { page } from '$app/stores';
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { openPages, currentPage, openPage, closePage } from '$lib/stores/openPagesStore.js';
  
  const dispatch = createEventDispatcher();
  
  let menus = [];
  let expandedMenus = {};
  let loading = true;
  let error = '';

  onMount(async () => {
    await loadMenus();
    // 초기 페이지 상태 설정
    if (browser && $page.url.pathname) {
      openPage($page.url.pathname);
    }
  });

  async function loadMenus() {
    if (!browser) return;
    
    try {
      loading = true;
      const response = await fetch('/api/user-menus');
      const data = await response.json();
      
      if (data.success) {
        menus = buildMenuTree(data.data);
        autoExpandActiveParents();
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
      if (hasActiveChild(menu) || hasOpenChild(menu)) {
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

  // 메뉴 클릭 핸들러 (멀티탭 기능)
  function handleMenuClick(event, menu) {
    event.preventDefault();
    openPage(menu.href);
    
    // 모바일에서 메뉴 닫기
    if (window.innerWidth <= 768) {
      dispatch('navigate');
    }
  }

  // 페이지 닫기 핸들러
  function handleClosePage(event, href) {
    event.preventDefault();
    event.stopPropagation();
    closePage(href);
  }

  // 상태 체크 함수들
  $: isPageOpen = (href) => $openPages.has(href);
  $: isCurrentPage = (href) => $currentPage === href;

  function isActive(href) {
    return isCurrentPage(href);
  }

  function isParentActive(menu) {
    if (menu.href && isActive(menu.href)) {
      return true;
    }
    return hasActiveChild(menu);
  }

  function hasActiveChild(menu) {
    return menu.children && menu.children.some(child => isActive(child.href));
  }

  function hasOpenChild(menu) {
    return menu.children && menu.children.some(child => isPageOpen(child.href));
  }

  function toggleMenu(menuTitle) {
    expandedMenus[menuTitle] = !expandedMenus[menuTitle];
    expandedMenus = { ...expandedMenus };
  }

  // 페이지 변경 시 부모 메뉴 자동 확장
  $: if ($currentPage) {
    autoExpandActiveParents();
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
                       {menu.href && isCurrentPage(menu.href) ? 'bg-green-50 border-l-4 border-green-500 text-green-700 font-semibold' : ''}
                       {hasActiveChild(menu) && !(menu.href && isCurrentPage(menu.href)) ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-300' : ''}
                       {isPageOpen(menu.href) && !isCurrentPage(menu.href) ? 'bg-green-25' : ''}"
                on:click={(e) => menu.href ? handleMenuClick(e, menu) : toggleMenu(menu.title)}
              >
                <div class="flex items-center gap-2">
                  <span class="text-lg">{menu.icon}</span>
                  <span class="font-medium">{menu.title}</span>
                  
                  <!-- 열린 페이지 표시 (부모 메뉴) -->
                  {#if menu.href && isPageOpen(menu.href)}
                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                  {/if}
                </div>
                
                <div class="flex items-center gap-2">
                  <!-- 닫기 버튼 (부모 메뉴, 대시보드 제외) -->
                  {#if menu.href && isPageOpen(menu.href) && menu.href !== '/admin'}
                    <button
                      class="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors duration-200 flex items-center justify-center text-lg leading-none"
                      on:click={(e) => handleClosePage(e, menu.href)}
                      title="페이지 닫기"
                    >
                      ×
                    </button>
                  {/if}
                  
                  <!-- 확장/축소 아이콘 -->
                  <span class="text-xs transition-transform duration-200 flex-shrink-0 {expandedMenus[menu.title] ? 'rotate-180' : ''}">
                    ▼
                  </span>
                </div>
              </button>
              
              {#if expandedMenus[menu.title]}
                <ul class="list-none mt-2 mb-0 p-0 pl-4">
                  {#each menu.children as child}
                    <li class="mb-1">
                      <a 
                        href={child.href}
                        class="group flex items-center justify-between px-4 py-2 pl-6 text-gray-600 no-underline rounded-md transition-all duration-200 text-xs font-normal
                               hover:bg-purple-50 hover:text-purple-700
                               {isCurrentPage(child.href) ? 'bg-green-50 text-green-700 border-l-[3px] border-green-500 font-medium' : ''}
                               {isPageOpen(child.href) && !isCurrentPage(child.href) ? 'bg-green-25' : ''}"
                        on:click={(e) => handleMenuClick(e, child)}
                      >
                        <div class="flex items-center gap-2">
                          <span class="text-lg">{child.icon}</span>
                          <span class="font-medium">{child.title}</span>
                          
                          <!-- 열린 페이지 표시 (자식 메뉴) -->
                          {#if isPageOpen(child.href)}
                            <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                          {/if}
                        </div>
                        
                        <!-- 닫기 버튼 (자식 메뉴, 대시보드 제외) -->
                        {#if isPageOpen(child.href) && child.href !== '/admin'}
                          <button
                            class="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors duration-200 flex items-center justify-center text-lg leading-none"
                            on:click={(e) => handleClosePage(e, child.href)}
                            title="페이지 닫기"
                          >
                            ×
                          </button>
                        {/if}
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
              class="group flex items-center justify-between px-4 py-3 text-gray-700 no-underline rounded-md transition-all duration-200 text-xs
                     hover:bg-blue-50 hover:text-blue-600
                     {isCurrentPage(menu.href) ? 'bg-green-50 text-green-700 border-l-4 border-green-500 font-semibold' : ''}
                     {isPageOpen(menu.href) && !isCurrentPage(menu.href) ? 'bg-green-25' : ''}"
              on:click={(e) => handleMenuClick(e, menu)}
            >
              <div class="flex items-center gap-2">
                <span class="text-lg">{menu.icon}</span>
                <span class="font-medium">{menu.title}</span>
                
                <!-- 열린 페이지 표시 -->
                {#if isPageOpen(menu.href)}
                  <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                {/if}
              </div>
              
              <!-- 닫기 버튼 (대시보드 제외) -->
              {#if isPageOpen(menu.href) && menu.href !== '/admin'}
                <button
                  class="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors duration-200 flex items-center justify-center text-lg leading-none"
                  on:click={(e) => handleClosePage(e, menu.href)}
                  title="페이지 닫기"
                >
                  ×
                </button>
              {/if}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</nav>

<style>
  /* bg-green-25 커스텀 클래스 */
  :global(.bg-green-25) {
    background-color: #f7fef7;
  }
</style>