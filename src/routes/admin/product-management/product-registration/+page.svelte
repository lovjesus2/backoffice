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
  
  // 검색 필터 상태
  let companyList = []; // 회사구분 목록
  let registrationList = []; // 등록구분 목록  
  let productTypeList = []; // 제품구분 목록 (상세구분에서 변경)
  
  let selectedCompany = ''; // 선택된 회사구분
  let selectedRegistration = ''; // 선택된 등록구분
  let selectedProductType = ''; // 선택된 제품구분 (상세구분에서 변경)
  let searchKeyword = ''; // 검색어
  
  // 제품구분 표시 여부 (등록구분이 "제품정보"일 때만)
  $: showProductType = registrationList.find(item => item.MINR_CODE === selectedRegistration)?.MINR_NAME === '제품정보';
  
  // 카테고리 편집 폼 (신규 입력 모드로 시작)
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
  
  // 페이지 로드 시 초기화
  onMount(async () => {
    // 모바일에서는 초기에 대분류 패널 숨김, PC에서는 표시
    leftPanelVisible = window.innerWidth > 768;
    
    // 회사구분 목록과 카테고리 목록 동시 로드
    await Promise.all([
      loadCompanyList(),
      loadMajrList()
    ]);
    
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

  // 회사구분 목록 조회 (MINR_MJCD = 'A0001')
  async function loadCompanyList() {
    try {
      const response = await fetch('/api/common-codes/minr?majr_code=A0001');
      const result = await response.json();
      
      if (result.success) {
        companyList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        // 첫 번째 항목 자동 선택
        if (companyList.length > 0) {
          selectedCompany = companyList[0].MINR_CODE;
          await handleCompanyChange();
        }
      } else {
        console.error('회사구분 조회 실패:', result.message);
      }
    } catch (err) {
      console.error('회사구분 조회 오류:', err);
    }
  }

  // 등록구분 목록 조회 (선택된 회사구분의 MINR_BIGO 값으로 조회)
  async function loadRegistrationList(companyBigo) {
    try {
      if (!companyBigo) {
        registrationList = [];
        return;
      }
      
      const response = await fetch(`/api/common-codes/minr?majr_code=${companyBigo}`);
      const result = await response.json();
      
      if (result.success) {
        registrationList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        
        // 첫 번째 항목 자동 선택
        if (registrationList.length > 0) {
          selectedRegistration = registrationList[0].MINR_CODE;
          
          // 선택된 항목이 제품정보인 경우 제품구분 로드
          if (registrationList[0].MINR_NAME === '제품정보') {
            await loadProductTypeList();
          } else {
            productTypeList = [];
            selectedProductType = '';
          }
        }
      } else {
        console.error('등록구분 조회 실패:', result.message);
        registrationList = [];
      }
      
    } catch (err) {
      console.error('등록구분 조회 오류:', err);
      registrationList = [];
    }
  }

  // 제품구분 목록 조회 (CD001 고정)
  async function loadProductTypeList() {
    try {
      const response = await fetch('/api/common-codes/minr?majr_code=CD001');
      const result = await response.json();
      
      if (result.success) {
        const sortedData = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        // "전체" 옵션을 맨 앞에 추가
        productTypeList = [
          { MINR_CODE: 'ALL', MINR_NAME: '전체', MINR_SORT: -1 },
          ...sortedData
        ];
        // "전체" 자동 선택
        selectedProductType = 'ALL';
      } else {
        console.error('제품구분 조회 실패:', result.message);
        productTypeList = [];
      }
      
    } catch (err) {
      console.error('제품구분 조회 오류:', err);
      productTypeList = [];
    }
  }

  // 회사구분 선택 시 처리
  async function handleCompanyChange() {
    const selectedCompanyItem = companyList.find(item => item.MINR_CODE === selectedCompany);
    if (selectedCompanyItem && selectedCompanyItem.MINR_BIGO) {
      await loadRegistrationList(selectedCompanyItem.MINR_BIGO);
    } else {
      registrationList = [];
      selectedRegistration = '';
      selectedProductType = '';
      productTypeList = [];
    }
  }

  // 등록구분 선택 시 처리
  async function handleRegistrationChange() {
    const selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
    
    // 제품정보가 선택된 경우에만 제품구분 로드
    if (selectedRegistrationItem && selectedRegistrationItem.MINR_NAME === '제품정보') {
      await loadProductTypeList();
    } else {
      productTypeList = [];
      selectedProductType = '';
    }
  }

  // 검색 실행
  function handleSearch() {
    console.log('검색 조건:', {
      company: selectedCompany,
      registration: selectedRegistration,
      productType: selectedProductType,
      keyword: searchKeyword
    });
    // 여기에 실제 검색 로직 구현
  }
  
  // 카테고리 목록 조회 (임시 데이터)
  async function loadMajrList() {
    try {
      loading = true;
      
      // 임시 카테고리 데이터
      const tempData = [
        { MAJR_CODE: 'ELEC', MAJR_NAME: '전자제품', MAJR_BIGO: '전자기기', MAJR_BIG2: '' },
        { MAJR_CODE: 'FURN', MAJR_NAME: '가구', MAJR_BIGO: '가정용 가구', MAJR_BIG2: '' },
        { MAJR_CODE: 'CLTH', MAJR_NAME: '의류', MAJR_BIGO: '패션 의류', MAJR_BIG2: '' },
        { MAJR_CODE: 'BOOK', MAJR_NAME: '도서', MAJR_BIGO: '서적 및 잡지', MAJR_BIG2: '' },
        { MAJR_CODE: 'SPRT', MAJR_NAME: '스포츠용품', MAJR_BIGO: '운동용품', MAJR_BIG2: '' }
      ];
      
      majrList = tempData;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 제품 목록 조회 (임시 데이터)
  async function loadMinrList(majrCode) {
    try {
      loading = true;
      
      // 임시 제품 데이터
      const tempProducts = {
        'ELEC': [
          { MINR_MJCD: 'ELEC', MINR_CODE: 'P001', MINR_NAME: '스마트폰', MINR_BIGO: '최신 스마트폰', MINR_BIG2: '', isNew: false, isDeleted: false },
          { MINR_MJCD: 'ELEC', MINR_CODE: 'P002', MINR_NAME: '노트북', MINR_BIGO: '고성능 노트북', MINR_BIG2: '', isNew: false, isDeleted: false }
        ],
        'FURN': [
          { MINR_MJCD: 'FURN', MINR_CODE: 'F001', MINR_NAME: '소파', MINR_BIGO: '3인용 소파', MINR_BIG2: '', isNew: false, isDeleted: false }
        ],
        'CLTH': [
          { MINR_MJCD: 'CLTH', MINR_CODE: 'C001', MINR_NAME: 'T셔츠', MINR_BIGO: '면 100%', MINR_BIG2: '', isNew: false, isDeleted: false }
        ]
      };
      
      minrList = (tempProducts[majrCode] || []).map(item => ({
        ...item,
        isNew: false,
        isDeleted: false
      }));
      originalMinrList = JSON.parse(JSON.stringify(minrList));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 카테고리 선택
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
  
  // 행 추가
  function addNewRow() {
    if (!selectedMajr && majrEditForm.isNew && !majrEditForm.MAJR_CODE) {
      error = '먼저 카테고리 정보를 입력해주세요.';
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
  
  // 전체 저장 (카테고리 + 제품)
  async function saveAll() {
    try {
      if (!majrEditForm.MAJR_CODE || !majrEditForm.MAJR_NAME) {
        error = '카테고리 코드와 명칭을 입력해주세요.';
        return;
      }
      
      loading = true;
      error = '';
      
      // 임시 저장 로직 (실제로는 API 호출)
      success = '저장이 완료되었습니다.';
      
      // 목록 새로고침
      await loadMajrList();
      
      // 신규 등록이었다면 해당 카테고리 선택
      if (majrEditForm.isNew) {
        const savedMajr = majrList.find(m => m.MAJR_CODE === majrEditForm.MAJR_CODE);
        if (savedMajr) {
          selectMajr(savedMajr);
        }
      } else if (selectedMajr) {
        const updatedMajr = majrList.find(m => m.MAJR_CODE === selectedMajr.MAJR_CODE);
        if (updatedMajr) {
          selectMajr(updatedMajr);
        }
      }
      
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 검색 처리 (handleMajrSearch 제거)
  
  // 메시지 자동 숨김
  $: if (success) {
    setTimeout(() => success = '', 3000);
  }
  
  $: if (error) {
    setTimeout(() => error = '', 5000);
  }
  
  // 표시할 제품 목록 (삭제되지 않은 것들만)
  $: visibleMinrList = minrList.filter(item => !item.isDeleted);
  
  // 현재 편집 중인 카테고리 코드
  $: currentMajrCode = selectedMajr ? selectedMajr.MAJR_CODE : majrEditForm.MAJR_CODE;

  // 오버레이 클릭 처리 - 패널 닫기만 수행
  function handleOverlayClick(event) {
    event.preventDefault();
    event.stopPropagation();
    leftPanelVisible = false;
  }

  // 패널 내부 클릭 시 이벤트 전파 중지 (터치는 제외)
  function handlePanelClick(event) {
    event.stopPropagation();
  }

  // 카테고리 선택 시 터치와 클릭 구분
  let touchStartTime = 0;
  let touchStartY = 0;
  let isTouchScrolling = false;

  function handleMajrTouchStart(event, majr) {
    touchStartTime = Date.now();
    touchStartY = event.touches[0].clientY;
    isTouchScrolling = false;
  }

  function handleMajrTouchMove(event) {
    if (!touchStartTime) return;
    
    const currentY = event.touches[0].clientY;
    const deltaY = Math.abs(currentY - touchStartY);
    
    // 5px 이상 움직이면 스크롤로 간주
    if (deltaY > 5) {
      isTouchScrolling = true;
    }
  }

  function handleMajrTouchEnd(event, majr) {
    event.stopPropagation();
    
    const touchDuration = Date.now() - touchStartTime;
    
    // 스크롤 중이거나 너무 오래 눌렀으면 선택 안함
    if (!isTouchScrolling && touchDuration < 500) {
      selectMajr(majr);
    }
    
    // 초기화
    touchStartTime = 0;
    touchStartY = 0;
    isTouchScrolling = false;
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
          style="top: calc(env(safe-area-inset-top, 0px) + 70px);"
          on:click={handleOverlayClick}
          on:touchstart={handleOverlayClick}
          on:touchmove|preventDefault
        ></div>
      {/if}

      <!-- 왼쪽 패널: 검색 및 카테고리 목록 -->
      <div class="transition-all duration-300 {leftPanelVisible ? 'opacity-100' : 'opacity-0'} lg:relative lg:ml-2.5 {leftPanelVisible ? '' : 'hidden'}" 
           style="flex: 0 0 {leftPanelVisible ? '350px' : '0px'}; background: transparent; z-index: 25;"
           class:fixed={typeof window !== 'undefined' && window.innerWidth <= 1024}
           class:left-0={typeof window !== 'undefined' && window.innerWidth <= 1024}
           class:bg-white={typeof window !== 'undefined' && window.innerWidth <= 1024}
           style:top={typeof window !== 'undefined' && window.innerWidth <= 1024 ? 'calc(env(safe-area-inset-top, 0px) + 70px)' : 'auto'}
           style:height={typeof window !== 'undefined' && window.innerWidth <= 1024 ? 'calc(100vh - env(safe-area-inset-top, 0px) - 70px)' : 'auto'}
           style:box-shadow={typeof window !== 'undefined' && window.innerWidth <= 1024 ? '2px 0 8px rgba(0,0,0,0.1)' : 'none'}
           style:transform={typeof window !== 'undefined' && window.innerWidth <= 1024 && !leftPanelVisible ? 'translateX(-100%)' : 'translateX(0)'}
           on:click={handlePanelClick}>
        
        <div class="bg-white rounded-lg m-2 overflow-hidden mb-5" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
             on:click={handlePanelClick}>
          
          <!-- 패널 헤더 -->
          <div class="py-4 px-5 border-b border-gray-200 flex flex-col items-stretch gap-4 relative" style="gap: 15px;">
            {#if typeof window !== 'undefined' && window.innerWidth <= 1024}
              <button 
                class="absolute bg-red-600 text-white border-none rounded-full cursor-pointer flex items-center justify-center hover:bg-red-700 hover:scale-110 transition-all text-lg z-10"
                style="top: 15px; right: 15px; width: 24px; height: 24px; font-size: 1.2rem;"
                on:click|stopPropagation={() => leftPanelVisible = false}
              >
                ✕
              </button>
            {/if}
            
            <div class="flex items-center gap-2.5">
              <h2 class="text-gray-800 m-0" style="font-size: 1.1rem;">검색 및 선택</h2>
            </div>
            
            <!-- 검색 필터 -->
            <div class="space-y-3">
              <!-- 회사구분 -->
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.85rem;">회사구분</label>
                <select 
                  bind:value={selectedCompany}
                  on:change={handleCompanyChange}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 6px 10px; font-size: 0.85rem;"
                >
                  {#each companyList as company}
                    <option value={company.MINR_CODE}>{company.MINR_NAME}</option>
                  {/each}
                </select>
              </div>

              <!-- 등록구분 -->
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.85rem;">등록구분</label>
                <select 
                  bind:value={selectedRegistration}
                  on:change={handleRegistrationChange}
                  disabled={registrationList.length === 0}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                  style="padding: 6px 10px; font-size: 0.85rem;"
                >
                  {#each registrationList as registration}
                    <option value={registration.MINR_CODE}>{registration.MINR_NAME}</option>
                  {/each}
                </select>
              </div>

              <!-- 제품구분 (등록구분이 "제품정보"일 때만 표시) -->
              {#if showProductType}
                <div class="flex flex-col">
                  <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.85rem;">제품구분</label>
                  <select 
                    bind:value={selectedProductType}
                    class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    style="padding: 6px 10px; font-size: 0.85rem;"
                  >
                    {#each productTypeList as productType}
                      <option value={productType.MINR_CODE}>{productType.MINR_NAME}</option>
                    {/each}
                  </select>
                </div>
              {/if}

              <!-- 검색어 -->
              <div class="flex flex-col">
                <label class="mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.85rem;">검색어</label>
                <div class="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="검색어 입력..."
                    bind:value={searchKeyword}
                    class="flex-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    style="padding: 6px 10px; font-size: 0.85rem;"
                    on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                    on:blur={(e) => e.target.style.boxShadow = 'none'}
                    on:click|stopPropagation
                  />
                  <button 
                    class="text-white border-none rounded cursor-pointer transition-colors text-sm hover:bg-blue-600"
                    style="padding: 6px 12px; background-color: #007bff; font-size: 0.85rem;"
                    on:click|stopPropagation={handleSearch}
                  >
                    조회
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 목록 - 화면 맨 아래까지 -->
          <div class="overflow-y-auto" style="max-height: {typeof window !== 'undefined' && window.innerWidth <= 1024 ? 'calc(100vh - env(safe-area-inset-top, 0px) - 380px)' : 'calc(100vh - 310px)'};">
            {#if loading}
              <div class="text-center text-gray-600" style="padding: 30px 15px;">
                <div class="mx-auto mb-2.5 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" style="width: 25px; height: 25px;"></div>
                로딩 중...
              </div>
            {:else if majrList.length === 0}
              <div class="text-center text-gray-600" style="padding: 30px 15px; font-size: 0.9rem;">
                등록된 카테고리가 없습니다.
              </div>
            {:else}
              {#each majrList as majr}
                <div 
                  class="border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50 {selectedMajr && selectedMajr.MAJR_CODE === majr.MAJR_CODE ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
                  style="padding: 10px 15px;"
                  on:click|stopPropagation={() => selectMajr(majr)}
                  on:touchstart={(e) => handleMajrTouchStart(e, majr)}
                  on:touchmove={handleMajrTouchMove}
                  on:touchend={(e) => handleMajrTouchEnd(e, majr)}
                >
                  <div class="font-semibold text-gray-900" style="font-size: 0.9rem;">{majr.MAJR_CODE}</div>
                  <div class="text-gray-600 mt-0.5" style="font-size: 0.8rem;">{majr.MAJR_NAME}</div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- 오른쪽 패널: 컨텐츠 -->
      <div class="flex-1 min-w-0 px-2">
        <!-- 카테고리 편집 폼 -->
        <div class="bg-white rounded-lg overflow-hidden mb-5" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div class="border-b border-gray-200 flex justify-between items-center flex-wrap" style="padding: 15px 20px; gap: 15px;">
            <div class="flex items-center gap-2.5">
              <h3 class="text-gray-800 m-0" style="font-size: 1.1rem;">카테고리 {majrEditForm.isNew ? '신규등록' : '수정'}</h3>
            </div>
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

        <!-- 제품 관리 -->
        <div class="bg-white rounded-lg overflow-hidden" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div class="border-b border-gray-200 flex justify-between items-center flex-wrap relative" style="padding: 15px 20px; gap: 15px;">
            <div class="flex items-center gap-2.5">
              <h3 class="text-gray-800 m-0" style="font-size: 1.1rem;">제품 관리 {currentMajrCode ? `(${currentMajrCode})` : ''}</h3>
            </div>
            <div class="flex gap-2">
              <button 
                class="text-white border-none rounded cursor-pointer transition-colors hover:bg-gray-700"
                style="padding: 6px 12px; background-color: #6c757d; font-size: 0.9rem;"
                on:click={addNewRow}
              >
                행추가
              </button>
              <button 
                class="text-white border-none rounded cursor-pointer transition-colors hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                style="padding: 6px 12px; background-color: #007bff; font-size: 0.9rem;"
                on:click={saveAll}
                disabled={loading}
              >
                {#if loading}
                  <span class="inline-block border-2 border-white border-t-transparent rounded-full animate-spin mr-2" style="width: 12px; height: 12px;"></span>
                {/if}
                저장
              </button>
            </div>
          </div>
          
          <div class="p-5">
            {#if loading}
              <div class="text-center text-gray-600" style="padding: 30px 15px;">
                <div class="mx-auto mb-2.5 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" style="width: 25px; height: 25px;"></div>
                불러오는 중...
              </div>
            {:else if currentMajrCode}
              {#if visibleMinrList.length === 0}
                <div class="text-center text-gray-500" style="padding: 30px 15px; font-size: 0.9rem;">
                  등록된 제품이 없습니다.<br>
                  "행추가" 버튼을 눌러 추가해보세요.
                </div>
              {:else}
                <!-- 제품 테이블 -->
                <div class="overflow-x-auto">
                  <table class="w-full border-collapse" style="font-size: 0.9rem;">
                    <thead>
                      <tr class="bg-gray-50">
                        <th class="border border-gray-300 text-left text-gray-800 font-semibold" style="padding: 8px; color: #333;">제품코드</th>
                        <th class="border border-gray-300 text-left text-gray-800 font-semibold" style="padding: 8px; color: #333;">제품명</th>
                        <th class="border border-gray-300 text-left text-gray-800 font-semibold" style="padding: 8px; color: #333;">비고1</th>
                        <th class="border border-gray-300 text-left text-gray-800 font-semibold" style="padding: 8px; color: #333;">비고2</th>
                        <th class="border border-gray-300 text-center text-gray-800 font-semibold" style="padding: 8px; color: #333;">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each visibleMinrList as item, index}
                        <tr class="hover:bg-gray-50 {item.isNew ? 'bg-yellow-50' : 'bg-white'}">
                          <td class="border border-gray-300" style="padding: 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_CODE}
                              maxlength="10"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 4px 6px; font-size: 0.85rem;"
                            />
                          </td>
                          <td class="border border-gray-300" style="padding: 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_NAME}
                              maxlength="200"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 4px 6px; font-size: 0.85rem;"
                            />
                          </td>
                          <td class="border border-gray-300" style="padding: 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_BIGO}
                              maxlength="200"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 4px 6px; font-size: 0.85rem;"
                            />
                          </td>
                          <td class="border border-gray-300" style="padding: 8px;">
                            <input 
                              type="text" 
                              bind:value={item.MINR_BIG2}
                              maxlength="200"
                              class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              style="padding: 4px 6px; font-size: 0.85rem;"
                            />
                          </td>
                          <td class="border border-gray-300 text-center" style="padding: 8px;">
                            <button 
                              class="bg-transparent border border-gray-300 rounded cursor-pointer text-red-600 hover:bg-red-100 transition-all"
                              style="padding: 4px 8px; font-size: 0.8rem; color: #dc3545;"
                              on:click={() => deleteRow(index)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            {:else}
              <div class="text-center text-gray-500" style="padding: 30px 15px; font-size: 0.9rem;">
                카테고리를 선택하거나 신규 등록해주세요.
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>