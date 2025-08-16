<!-- src/routes/admin/product-management/product-registration/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  
  export let data;
  
  // 상태 관리
  let majrList = [];
  let selectedMajr = null;
  let leftPanelVisible = true;
  let loading = false;
  let error = '';
  let success = '';
  
  // 검색
  let majrSearchTerm = '';
  
  // 대분류 편집 폼 (신규 입력 모드로 시작)
  let majrEditForm = {
    MAJR_CODE: '',
    MAJR_NAME: '',
    MAJR_BIGO: '',
    MAJR_BIG2: '',
    isNew: true
  };
  
  // 소분류 목록 (편집 가능한 배열)
  let minrList = [];
  let originalMinrList = []; // 원본 데이터 보관
  
  // 모바일에서 백오피스 메뉴 상태 감지
  let backofficeMenuOpen = false;
  
  // 페이지 로드 시 대분류 목록 조회
  onMount(() => {
    // 모바일에서는 초기에 대분류 패널 숨김, PC에서는 표시
    leftPanelVisible = window.innerWidth > 768;
    loadMajrList();
    
    // 백오피스 메뉴 상태 감지
    const detectBackofficeMenu = () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        backofficeMenuOpen = sidebar.classList.contains('open');
        // 모바일에서 백오피스 메뉴가 열리면 대분류 패널 숨기기
        if (window.innerWidth <= 768 && backofficeMenuOpen) {
          leftPanelVisible = false;
        }
      }
    };
    
    // MutationObserver로 백오피스 메뉴 상태 변화 감지
    const observer = new MutationObserver(detectBackofficeMenu);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
    
    return () => {
      observer.disconnect();
      // 컴포넌트 언마운트 시 body 스크롤 복원
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  });

  // 모바일에서 패널 열림/닫힘 상태에 따른 body 스크롤 제어
  $: if (typeof window !== 'undefined') {
    if (window.innerWidth <= 1024 && leftPanelVisible) {
      // 모바일에서 패널이 열렸을 때 body 스크롤 방지
      document.body.style.overflow = 'hidden';
    } else {
      // 패널이 닫혔을 때 body 스크롤 복원
      document.body.style.overflow = '';
    }
  }

  // ESC 키로 패널 닫기
  function handleKeydown(event) {
    if (event.key === 'Escape' && leftPanelVisible && typeof window !== 'undefined' && window.innerWidth <= 1024) {
      leftPanelVisible = false;
    }
  }
  
  // 대분류 목록 조회
  async function loadMajrList() {
    try {
      loading = true;
      const params = new URLSearchParams();
      if (majrSearchTerm) params.append('search', majrSearchTerm);
      
      // 임시 데이터 (제품 카테고리)
      majrList = [
        { MAJR_CODE: 'ELEC', MAJR_NAME: '전자제품', MAJR_BIGO: '전자제품 카테고리', MAJR_BIG2: '' },
        { MAJR_CODE: 'FURN', MAJR_NAME: '가구', MAJR_BIGO: '가구 카테고리', MAJR_BIG2: '' },
        { MAJR_CODE: 'CLTH', MAJR_NAME: '의류', MAJR_BIGO: '의류 카테고리', MAJR_BIG2: '' },
        { MAJR_CODE: 'BOOK', MAJR_NAME: '도서', MAJR_BIGO: '도서 카테고리', MAJR_BIG2: '' }
      ];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 소분류 목록 조회
  async function loadMinrList(majrCode) {
    try {
      loading = true;
      const params = new URLSearchParams({ majr_code: majrCode });
      
      // 임시 데이터 (제품 목록)
      minrList = [
        { MINR_MJCD: majrCode, MINR_CODE: 'P001', MINR_NAME: '스마트폰', MINR_BIGO: '최신 스마트폰', MINR_BIG2: '', isNew: false, isDeleted: false },
        { MINR_MJCD: majrCode, MINR_CODE: 'P002', MINR_NAME: '노트북', MINR_BIGO: '고성능 노트북', MINR_BIG2: '', isNew: false, isDeleted: false },
        { MINR_MJCD: majrCode, MINR_CODE: 'P003', MINR_NAME: '태블릿', MINR_BIGO: '휴대용 태블릿', MINR_BIG2: '', isNew: false, isDeleted: false }
      ];
      originalMinrList = JSON.parse(JSON.stringify(minrList));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 대분류 선택
  function selectMajr(majr) {
    selectedMajr = majr;
    majrEditForm = {
      MAJR_CODE: majr.MAJR_CODE,
      MAJR_NAME: majr.MAJR_NAME,
      MAJR_BIGO: majr.MAJR_BIGO || '',
      MAJR_BIG2: majr.MAJR_BIG2 || '',
      isNew: false
    };
    loadMinrList(majr.MAJR_CODE);
    
    // 모바일에서만 왼쪽 패널 숨기기 (데스크탑에서는 숨기지 않음)
    if (window.innerWidth < 768) {
      leftPanelVisible = false;
    }
  }
  
  // 신규 대분류 모드
  function newMajrMode() {
    selectedMajr = null;
    majrEditForm = {
      MAJR_CODE: '',
      MAJR_NAME: '',
      MAJR_BIGO: '',
      MAJR_BIG2: '',
      isNew: true
    };
    minrList = [];
  }
  
  // 행 추가
  function addNewRow() {
    if (!selectedMajr && majrEditForm.isNew && !majrEditForm.MAJR_CODE) {
      error = '먼저 대분류 정보를 입력해주세요.';
      return;
    }
    
    const majrCode = selectedMajr ? selectedMajr.MAJR_CODE : majrEditForm.MAJR_CODE;
    
    const newRow = {
      MINR_MJCD: majrCode,
      MINR_CODE: '',
      MINR_NAME: '',
      MINR_BIGO: '',
      MINR_BIG2: '',
      isNew: true,
      isDeleted: false
    };
    
    minrList = [...minrList, newRow];
  }
  
  // 행 삭제 (화면에서만)
  function deleteRow(index) {
    const item = minrList[index];
    if (item.isNew) {
      // 신규 행이면 배열에서 완전 제거
      minrList = minrList.filter((_, i) => i !== index);
    } else {
      // 기존 행이면 삭제 표시만
      minrList[index].isDeleted = true;
    }
    minrList = [...minrList]; // 반응성 트리거
  }
  
  // 전체 저장 (대분류 + 소분류)
  async function saveAll() {
    try {
      if (!majrEditForm.MAJR_CODE || !majrEditForm.MAJR_NAME) {
        error = '대분류 코드와 명칭을 입력해주세요.';
        return;
      }
      
      loading = true;
      error = '';
      
      // 임시 저장 로직
      success = '저장이 완료되었습니다.';
      
      // 목록 새로고침 시뮬레이션
      await loadMajrList();
      if (selectedMajr) {
        await loadMinrList(selectedMajr.MAJR_CODE);
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
      // 3초 후 성공 메시지 제거
      if (success) {
        setTimeout(() => {
          success = '';
        }, 3000);
      }
    }
  }
  
  // 오버레이 클릭 핸들러
  function handleOverlayClick() {
    leftPanelVisible = false;
  }
  
  // 스크롤 방지
  let scrolling = false;
  function preventScrolling(event) {
    if (leftPanelVisible && typeof window !== 'undefined' && window.innerWidth <= 1024) {
      event.preventDefault();
    }
    scrolling = false;
  }
</script>

<svelte:head>
  <title>제품등록</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="min-h-screen relative" style="background-color: #f5f5f5;">
  <!-- 메인 컨텐츠 -->
  <div class="flex flex-col" style="padding: 0; min-height: calc(100vh - 70px);">
    <!-- 헤더 -->
    <div class="bg-white border-b sticky top-0 mb-2.5" style="border-color: #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">
      <div style="padding: 15px 8px;">
        <div class="flex items-center gap-4">
          <button 
            class="bg-transparent border border-gray-300 rounded p-2 cursor-pointer transition-all duration-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center"
            style="padding: 8px;"
            on:click|stopPropagation={() => leftPanelVisible = !leftPanelVisible}
          >
            <div class="flex flex-col gap-1">
              <span class="block bg-gray-600 rounded transition-all" style="width: 18px; height: 2px;"></span>
              <span class="block bg-gray-600 rounded transition-all" style="width: 18px; height: 2px;"></span>
              <span class="block bg-gray-600 rounded transition-all" style="width: 18px; height: 2px;"></span>
            </div>
          </button>
          <h1 class="text-gray-800 font-semibold m-0" style="font-size: 1.375rem;">제품등록</h1>
        </div>
      </div>
    </div>

    <!-- 알림 메시지 -->
    {#if success}
      <div class="mx-2 my-2.5 px-4 py-2.5 rounded" style="background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; font-size: 0.9rem;">
        {success}
      </div>
    {/if}
    
    {#if error}
      <div class="mx-2 my-2.5 px-4 py-2.5 rounded" style="background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; font-size: 0.9rem;">
        {error}
      </div>
    {/if}

    <div class="flex w-full relative flex-1">
      <!-- 모바일 오버레이 배경 - 전체 화면을 덮되 패널 영역만 제외 -->
      {#if typeof window !== 'undefined' && window.innerWidth <= 1024 && leftPanelVisible}
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 z-20"
          style="top: 70px;"
          on:click={handleOverlayClick}
          on:touchstart={handleOverlayClick}
          on:touchmove|preventDefault
        ></div>
      {/if}

      <!-- 왼쪽 패널: 대분류 목록 -->
      <div class="transition-all duration-300 {leftPanelVisible ? 'opacity-100' : 'opacity-0'} lg:relative lg:ml-2.5 {leftPanelVisible ? '' : 'hidden'}" 
           style="flex: 0 0 {leftPanelVisible ? '350px' : '0px'}; background: transparent; z-index: 25;"
           class:fixed={typeof window !== 'undefined' && window.innerWidth <= 1024}
           class:left-0={typeof window !== 'undefined' && window.innerWidth <= 1024}
           class:bg-white={typeof window !== 'undefined' && window.innerWidth <= 1024}
           style:top={typeof window !== 'undefined' && window.innerWidth <= 1024 ? '70px' : 'auto'}
           style:height={typeof window !== 'undefined' && window.innerWidth <= 1024 ? 'calc(100vh - 70px)' : 'auto'}
           style:width={typeof window !== 'undefined' && window.innerWidth <= 1024 ? '85%' : leftPanelVisible ? '350px' : '0px'}
           style:max-width={typeof window !== 'undefined' && window.innerWidth <= 1024 ? '350px' : 'none'}>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col" style="height: calc(100vh - 110px);">
          <!-- 대분류 목록 헤더 -->
          <div style="padding: 15px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div class="flex items-center justify-between">
              <h2 class="text-white font-medium m-0" style="font-size: 1rem;">카테고리 목록</h2>
              <button 
                class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded p-1.5 transition-all duration-200"
                on:click={newMajrMode}
                title="신규 카테고리"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 검색창 -->
          <div style="padding: 10px 15px; border-bottom: 1px solid #e5e7eb;">
            <input 
              type="text" 
              bind:value={majrSearchTerm}
              placeholder="카테고리 검색..."
              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              style="padding: 8px 12px; font-size: 0.9rem;"
              on:input={loadMajrList}
            />
          </div>

          <!-- 대분류 목록 -->
          <div class="flex-1 overflow-y-auto" style="padding: 0;">
            {#if loading}
              <div class="flex items-center justify-center h-full">
                <div class="text-gray-500">로딩 중...</div>
              </div>
            {:else}
              {#each majrList as majr}
                <button
                  class="w-full text-left border-b border-gray-100 hover:bg-gray-50 transition-all duration-200 cursor-pointer"
                  style="padding: 12px 15px; border: none; background: none;"
                  class:bg-blue-50={selectedMajr?.MAJR_CODE === majr.MAJR_CODE}
                  class:border-l-4={selectedMajr?.MAJR_CODE === majr.MAJR_CODE}
                  class:border-l-blue-500={selectedMajr?.MAJR_CODE === majr.MAJR_CODE}
                  on:click={() => selectMajr(majr)}
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-medium text-gray-800" style="font-size: 0.9rem;">{majr.MAJR_NAME}</div>
                      <div class="text-gray-500 mt-1" style="font-size: 0.75rem;">{majr.MAJR_CODE}</div>
                    </div>
                    {#if majr.MAJR_BIGO}
                      <div class="text-xs text-gray-400">{majr.MAJR_BIGO}</div>
                    {/if}
                  </div>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- 오른쪽 패널: 대분류 편집 + 소분류 관리 -->
      <div class="flex-1 lg:ml-2.5 lg:mr-2.5" style="margin-left: {leftPanelVisible ? '10px' : '10px'};">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col" style="height: calc(100vh - 110px);">
          
          <!-- 대분류 편집 섹션 -->
          <div style="border-bottom: 1px solid #e5e7eb;">
            <div style="padding: 15px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <h3 class="text-white font-medium m-0 mb-3" style="font-size: 1rem;">
                {majrEditForm.isNew ? '신규등록' : '수정'}
              </h3>
            </div>
            
            <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.9rem;">카테고리 코드</label>
                <input 
                  type="text" 
                  bind:value={majrEditForm.MAJR_CODE}
                  maxlength="10"
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 8px 12px; font-size: 0.9rem;"
                  placeholder="카테고리 코드 입력"
                  on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                  on:blur={(e) => e.target.style.boxShadow = 'none'}
                />
              </div>
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.9rem;">카테고리 명칭</label>
                <input 
                  type="text" 
                  bind:value={majrEditForm.MAJR_NAME}
                  maxlength="200"
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 8px 12px; font-size: 0.9rem;"
                  placeholder="카테고리 명칭 입력"
                  on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                  on:blur={(e) => e.target.style.boxShadow = 'none'}
                />
              </div>
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.9rem;">비고1</label>
                <input 
                  type="text" 
                  bind:value={majrEditForm.MAJR_BIGO}
                  maxlength="200"
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 8px 12px; font-size: 0.9rem;"
                  placeholder="비고1 입력"
                  on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                  on:blur={(e) => e.target.style.boxShadow = 'none'}
                />
              </div>
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.9rem;">비고2</label>
                <input 
                  type="text" 
                  bind:value={majrEditForm.MAJR_BIG2}
                  maxlength="200"
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 8px 12px; font-size: 0.9rem;"
                  placeholder="비고2 입력"
                  on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                  on:blur={(e) => e.target.style.boxShadow = 'none'}
                />
              </div>
            </div>
          </div>

          <!-- 소분류 관리 섹션 헤더 -->
          <div style="padding: 15px; border-bottom: 1px solid #e5e7eb; background: #f8fafc;">
            <div class="flex items-center justify-between">
              <h3 class="text-gray-700 font-medium m-0" style="font-size: 1rem;">제품 목록</h3>
              <div class="flex gap-2">
                <button 
                  class="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded transition-all duration-200"
                  style="padding: 8px 12px; font-size: 0.9rem;"
                  on:click={addNewRow}
                >
                  + 행추가
                </button>
                <button 
                  class="bg-green-500 hover:bg-green-600 text-white font-medium rounded transition-all duration-200"
                  style="padding: 8px 16px; font-size: 0.9rem;"
                  on:click={saveAll}
                >
                  💾 저장
                </button>
              </div>
            </div>
          </div>

          <!-- 소분류 테이블 -->
          <div class="flex-1 overflow-auto" style="padding: 0;">
            {#if minrList.length === 0}
              <div class="flex items-center justify-center h-full text-gray-500">
                <div class="text-center">
                  <div style="font-size: 3rem; margin-bottom: 10px;">📦</div>
                  <p>등록된 제품이 없습니다</p>
                  <p style="font-size: 0.9rem;">카테고리를 선택하고 제품을 추가해보세요</p>
                </div>
              </div>
            {:else}
              <div class="overflow-x-auto">
                <table class="w-full" style="border-collapse: collapse;">
                  <thead style="background: #f1f5f9; border-bottom: 2px solid #e5e7eb;">
                    <tr>
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 0.9rem; min-width: 120px;">제품코드</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 0.9rem; min-width: 150px;">제품명</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 0.9rem; min-width: 200px;">비고1</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 0.9rem; min-width: 200px;">비고2</th>
                      <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; font-size: 0.9rem; width: 80px;">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each minrList as item, index}
                      {#if !item.isDeleted}
                        <tr class="border-b border-gray-100 hover:bg-gray-50" class:bg-yellow-50={item.isNew}>
                          <td style="padding: 10px 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_CODE}
                              maxlength="20"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 6px 8px; font-size: 0.85rem;"
                              placeholder="제품코드"
                            />
                          </td>
                          <td style="padding: 10px 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_NAME}
                              maxlength="200"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 6px 8px; font-size: 0.85rem;"
                              placeholder="제품명"
                            />
                          </td>
                          <td style="padding: 10px 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_BIGO}
                              maxlength="200"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 6px 8px; font-size: 0.85rem;"
                              placeholder="비고1"
                            />
                          </td>
                          <td style="padding: 10px 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_BIG2}
                              maxlength="200"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 6px 8px; font-size: 0.85rem;"
                              placeholder="비고2"
                            />
                          </td>
                          <td style="padding: 10px 8px; text-align: center;">
                            <button 
                              class="bg-red-500 hover:bg-red-600 text-white rounded transition-all duration-200"
                              style="padding: 4px 8px; font-size: 0.8rem;"
                              on:click={() => deleteRow(index)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      {/if}
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* 모바일 터치 최적화 */
  button, input {
    touch-action: manipulation;
  }
  
  /* 스크롤바 스타일링 */
  .overflow-y-auto::-webkit-scrollbar,
  .overflow-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track,
  .overflow-auto::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb,
  .overflow-auto::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover,
  .overflow-auto::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  /* 테이블 반응형 */
  @media (max-width: 768px) {
    table {
      font-size: 0.8rem;
    }
    
    th, td {
      padding: 8px 4px !important;
      min-width: 80px !important;
    }
    
    input[type="text"] {
      font-size: 0.8rem !important;
      padding: 4px 6px !important;
    }
  }
</style>