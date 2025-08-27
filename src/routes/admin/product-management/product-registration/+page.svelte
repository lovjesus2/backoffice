<!-- src/routes/admin/product-management/product-registration/+page.svelte -->
<script>
  import { onMount, tick } from 'svelte';  // tick 추가
  import { page } from '$app/stores';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  import { openImageModal, getProxyImageUrl } from '$lib/utils/imageModalUtils';
  import ImageModalStock from '$lib/components/ImageModalStock.svelte';
  import ImageUploader from '$lib/components/ImageUploader.svelte';
  

  export let data;
  
  // ImageUploader 컴포넌트 참조 변수 선언
  let imageUploader;

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
  
  let selectedCompany = ''; // 선택된 회사구분 (MINR_CODE)
  let selectedRegistration = ''; // 선택된 등록구분 (MINR_CODE)
  let selectedProductType = ''; // 선택된 제품구분 (MINR_CODE)
  let searchKeyword = ''; // 검색어
  let searchType = 'name'; // 검색 타입 (name: 제품명, code: 코드)
  
  // 조회된 제품 목록
  let products = [];
  let selectedProduct = null;
  let searchLoading = false;
  let searchError = '';

  // 단가정보
  let priceInfo = {};
  let priceHistory = [];
  let activePriceTab = 'current'; // 'current' 또는 'history'

  // 수량할인정보
  let discountInfo = [];

  // 상세정보
  let productDetailInfo = {};
  let productDetailItems = [];
  let loadingDetailInfo = false;

  // 상세정보 히스토리
  let detailHistory = [];
  let activeDetailTab = 'info'; // 'info' 또는 'history'
    
  
  // ✅ 수정: MINR_CODE를 그대로 사용
  $: currentCompanyCode = selectedCompany;        // MINR_CODE 그대로
  $: currentRegistrationCode = selectedRegistration; // MINR_CODE 그대로
  $: currentRegistrationName = registrationList.find(r => r.MINR_CODE === selectedRegistration)?.MINR_NAME || '';
  $: isProductInfo = currentRegistrationName === '제품정보';
  
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
  
  // 이미지 캐싱
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  // 이미지 클릭 핸들러
  function handleImageClick(productCode, productName) {
    const imageSrc = getProxyImageUrl(productCode);
    if (imageSrc) {
      openImageModal(imageSrc, productName, productCode);
    }
  }

  // 재고 업데이트 이벤트 처리
  function handleStockUpdated(event) {
    const { productCode, newStock } = event.detail;
    products = products.map(p => 
      p.code === productCode 
        ? { ...p, stock: newStock }
        : p
    );
  }

  function handleDiscontinuedUpdated(event) {
    console.log('단종 상태 업데이트:', event.detail);
  }
  
  // 엔터키 검색 핸들러
  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }
  
  // 페이지 로드 시 초기화
  onMount(async () => {
    // 모바일에서는 초기에 대분류 패널 숨김, PC에서는 표시
    leftPanelVisible = window.innerWidth > 768;
    
    // 회사구분 목록 로드
    await loadCompanyList();
    
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
          selectedCompany = companyList[0].MINR_CODE; // ✅ MINR_CODE 선택
          await handleCompanyChange();
        }
      } else {
        console.error('회사구분 조회 실패:', result.message);
      }
    } catch (err) {
      console.error('회사구분 조회 오류:', err);
    }
  }

  // ✅ 수정: 등록구분 목록 조회 (선택된 회사구분의 MINR_BIGO 값으로 조회)
  async function loadRegistrationList(companyBigo) {
    try {
      if (!companyBigo) {
        registrationList = [];
        return;
      }
      
      // MINR_BIGO를 참조 코드로 사용해서 해당 카테고리의 하위 항목들 조회
      const response = await fetch(`/api/common-codes/minr?majr_code=${companyBigo}`);
      const result = await response.json();
      
      if (result.success) {
        registrationList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        
        // 첫 번째 항목의 MINR_CODE를 선택 (MINR_BIGO 아님!)
        if (registrationList.length > 0) {
          selectedRegistration = registrationList[0].MINR_CODE;
          
          // 제품정보인지 확인할 때는 MINR_NAME 사용
          if (registrationList[0].MINR_NAME === '제품정보') {
            await loadProductTypeList();
          } else {
            productTypeList = [];
            selectedProductType = '';
          }
          
          // Svelte reactive 업데이트를 기다린 후 상세내역 구조 조회
          await tick(); // Svelte의 tick() 함수로 DOM 업데이트 대기
          await loadDetailStructure();
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

  // ✅ 수정: 회사구분 선택 시 처리
  async function handleCompanyChange() {
    const selectedCompanyItem = companyList.find(item => item.MINR_CODE === selectedCompany);
    if (selectedCompanyItem && selectedCompanyItem.MINR_BIGO) {
      // MINR_BIGO를 참조 코드로 사용해서 등록구분 목록 로드
      await loadRegistrationList(selectedCompanyItem.MINR_BIGO);
    } else {
      registrationList = [];
      selectedRegistration = '';
      selectedProductType = '';
      productTypeList = [];
    }
    
    // 검색 결과 초기화
    products = [];
    selectedProduct = null;
    searchError = '';
  }

  // 등록구분 선택 시 처리
  async function handleRegistrationChange() {
    console.log('🔍 handleRegistrationChange 호출됨');
    
    const selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
    console.log('🔍 선택된 등록구분:', selectedRegistrationItem);
    
    // 제품정보가 선택된 경우에만 제품구분 로드
    if (selectedRegistrationItem && selectedRegistrationItem.MINR_NAME === '제품정보') {
      await loadProductTypeList();
    } else {
      productTypeList = [];
      selectedProductType = '';
    }
    
    // 상세내역 구조 조회 추가
    console.log('🔍 상세내역 구조 조회 시작');
    await loadDetailStructure();
    
    // 검색 결과 초기화
    products = [];
    selectedProduct = null;
    searchError = '';
  }

  // 상세내역 구조 조회 (제품 선택과 무관하게 등록구분별 구조 조회)
  async function loadDetailStructure() {
    console.log('🔍 loadDetailStructure 호출됨');
    console.log('🔍 조건 확인:', { 
      currentCompanyCode, 
      currentRegistrationCode,
      selectedRegistration,
      registrationListLength: registrationList.length
    });

    if (!currentCompanyCode || !currentRegistrationCode) {
      console.log('❌ 상세내역 구조 조회 조건 부족');
      productDetailItems = [];
      return;
    }

    try {
      loadingDetailInfo = true;
      
      // 선택된 등록구분의 MINR_BIGO 찾기
      const selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
      console.log('🔍 선택된 등록구분 아이템:', selectedRegistrationItem);
      
      const categoryCode = selectedRegistrationItem?.MINR_BIGO || '';
      console.log('🔍 categoryCode:', categoryCode);
      
      if (!categoryCode) {
        console.log('❌ 등록구분의 MINR_BIGO가 없음');
        productDetailItems = [];
        loadingDetailInfo = false;
        return;
      }

      console.log('🔍 API 호출 준비:', {
        companyCode: currentCompanyCode,
        registrationCode: currentRegistrationCode,
        categoryCode: categoryCode
      });

      const params = new URLSearchParams({
        company_code: currentCompanyCode,
        registration_code: currentRegistrationCode,
        product_code: '', // 빈 값으로 구조만 조회
        category_code: categoryCode
      });
      
      console.log('🔍 API URL:', `/api/product-management/product-registration/detail?${params}`);
      
      const response = await fetch(`/api/product-management/product-registration/detail?${params}`);
      const result = await response.json();
      
      console.log('🔍 API 응답:', result);
      
      if (result.success) {
        productDetailItems = result.detailItems || [];
        console.log('✅ 상세내역 구조 조회 완료:', productDetailItems.length + '개');
      } else {
        console.error('❌ 상세내역 구조 조회 실패:', result.message);
        productDetailItems = [];
      }
    } catch (err) {
      console.error('❌ 상세내역 구조 조회 오류:', err);
      productDetailItems = [];
    } finally {
      loadingDetailInfo = false;
    }
  }

  // ✅ 수정: 검색 실행 (검색어 없어도 가능)
  async function handleSearch() {
    console.log('=== 제품 검색 시작 ===');
    console.log('검색 조건:', {
      searchKeyword: searchKeyword.trim(),
      currentCompanyCode,      // 이제 MINR_CODE
      currentRegistrationCode, // 이제 MINR_CODE
      currentRegistrationName,
      isProductInfo,
      selectedProductType
    });

    if (!currentCompanyCode || !currentRegistrationCode) {
      searchError = '회사구분과 등록구분을 선택해주세요.';
      return;
    }

    searchLoading = true;
    searchError = '';
    products = [];

    try {
      const params = new URLSearchParams({
        search_term: searchKeyword.trim() || '', // 빈 문자열도 허용
        search_type: searchType, // 검색 타입 추가
        discontinued_filter: 'all',
        company_code: currentCompanyCode,        // MINR_CODE 전송
        registration_code: currentRegistrationCode, // MINR_CODE 전송
        registration_name: currentRegistrationName
      });

      // 제품구분이 선택된 경우 추가
      if (isProductInfo && selectedProductType && selectedProductType !== 'ALL') {
        params.append('product_type', selectedProductType);
      }

      const apiUrl = `/api/product-management/product-registration/search?${params}`;
      console.log('API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('API 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('API 응답 데이터:', result);

      if (result.success) {
        products = result.data;
        console.log('조회된 제품 수:', products.length);
        
        if (products.length === 0) {
          searchError = '검색 결과가 없습니다.';
        }
      } else {
        console.error('API 에러:', result.message);
        searchError = result.message || '검색 실패';
        products = [];
      }
    } catch (err) {
      console.error('네트워크 에러:', err);
      searchError = `검색 중 오류가 발생했습니다: ${err.message}`;
      products = [];
    } finally {
      searchLoading = false;
      console.log('=== 제품 검색 완료 ===');
    }
  }
  

  // 제품 선택
  async function selectProduct(product) {
    selectedProduct = product;
    console.log('선택된 제품:', product);
    
    // 제품 선택 시 이미지 업로더에 기존 이미지 로드
    if (imageUploader) {
      imageUploader.forceReload();
    }

    // 제품 상세 정보 조회 추가
    await loadProductDetailInfo(product.code);
  }
  
  // 단종 처리 (제품정보일 때만)
  async function toggleDiscontinued(productCode) {
    if (!isProductInfo) return;

    try {
      const response = await fetch('/api/product-management/product-registration/discontinued', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode,
          company_code: currentCompanyCode,
          registration_code: currentRegistrationCode,
          registration_name: currentRegistrationName
        })
      });

      const result = await response.json();

      if (result.success) {
        products = products.map(p => 
          p.code === productCode 
            ? { ...p, discontinued: result.action === 'discontinued' }
            : p
        );
        
        if (selectedProduct && selectedProduct.code === productCode) {
          selectedProduct = { ...selectedProduct, discontinued: result.action === 'discontinued' };
        }
        
        alert(result.message);
      } else {
        alert(result.message || '처리 실패');
      }
    } catch (err) {
      console.error('단종 처리 오류:', err);
      alert('단종 처리 중 오류가 발생했습니다.');
    }
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
        { MAJR_CODE: 'BOOK', MAJR_NAME: '도서', MAJR_BIGO: '서점 및 잡지', MAJR_BIG2: '' },
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
    
    // 스크롤 중이거나 너무 오래 눌렸으면 선택 안함
    if (!isTouchScrolling && touchDuration < 500) {
      selectMajr(majr);
    }
    
    // 초기화
    touchStartTime = 0;
    touchStartY = 0;
    isTouchScrolling = false;
  }

  // 제품 상세 정보 조회
  async function loadProductDetailInfo(productCode) {
    if (!currentCompanyCode || !currentRegistrationCode) {
      console.log('상세 정보 조회 조건 부족:', { currentCompanyCode, currentRegistrationCode });
      return;
    }

    try {
      loadingDetailInfo = true;
      productDetailInfo = {};
      productDetailItems = [];
      
      // 선택된 등록구분의 MINR_BIGO 찾기
      const selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
      const categoryCode = selectedRegistrationItem?.MINR_BIGO || '';

      const params = new URLSearchParams({
        company_code: currentCompanyCode,
        registration_code: currentRegistrationCode,
        product_code: productCode || '',
        category_code: categoryCode  // 등록구분의 MINR_BIGO 값
      });
      
      const response = await fetch(`/api/product-management/product-registration/detail?${params}`);
      const result = await response.json();
      
      if (result.success) {
        productDetailInfo = result.productInfo || {};
        productDetailItems = result.detailItems || [];
        detailHistory = result.detailHistory || [];
        priceInfo = result.priceInfo || {};
        priceHistory = result.priceHistory || [];
        discountInfo = result.discountInfo || [];
        
        console.log('제품 상세 정보 조회 완료:', {
          detailItemsCount: productDetailItems.length,
          detailHistoryCount: detailHistory.length,
          categoryCode: categoryCode
        });
      }
    } catch (err) {
      console.error('제품 상세 정보 조회 오류:', err);
    } finally {
      loadingDetailInfo = false;
    }
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

    <!-- 반응형 레이아웃 -->
    <div class="flex flex-1 relative">
      <!-- 모바일 오버레이 배경 -->
      {#if typeof window !== 'undefined' && window.innerWidth <= 1024 && leftPanelVisible}
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 z-20"
          style="top: calc(env(safe-area-inset-top, 0px) + 70px);"
          on:click={handleOverlayClick}
          on:touchstart={handleOverlayClick}
          on:touchmove|preventDefault
        ></div>
      {/if}

      <!-- 제품 조회 패널 (왼쪽) -->
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
        
        <div class="bg-white rounded-lg m-2 overflow-hidden mb-5" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: {typeof window !== 'undefined' && window.innerWidth >= 1024 ? '1px' : '8px'}; height: {typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'calc(100vh)' : 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 70px)'};"
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
            
            <!-- 검색 필터 -->
            <div class="space-y-3">
              <!-- 회사구분 -->
              <div class="flex flex-row items-center gap-2">
                <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">회사구분</label>
                <select 
                  bind:value={selectedCompany}
                  on:change={handleCompanyChange}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 flex-1"
                  style="padding: 5px 8px; font-size: 0.9rem;"
                >
                  {#each companyList as company}
                    <option value={company.MINR_CODE}>{company.MINR_NAME}</option>
                  {/each}
                </select>
              </div>

              <!-- 등록구분 -->
              <div class="flex flex-row items-center gap-2">
                <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">등록구분</label>
                <select 
                  bind:value={selectedRegistration}
                  on:change={handleRegistrationChange}
                  disabled={registrationList.length === 0}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100 flex-1"
                  style="padding: 5px 8px; font-size: 0.9rem;"
                >
                  {#each registrationList as registration}
                    <option value={registration.MINR_CODE}>{registration.MINR_NAME}</option>
                  {/each}
                </select>
              </div>

              <!-- 제품구분 (등록구분이 "제품정보"일 때만 표시) -->
              {#if showProductType}
                <div class="flex flex-row items-center gap-2">
                  <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">제품구분</label>
                  <select 
                    bind:value={selectedProductType}
                    class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 flex-1"
                    style="padding: 5px 8px; font-size: 0.9rem;"
                  >
                    {#each productTypeList as productType}
                      <option value={productType.MINR_CODE}>{productType.MINR_NAME}</option>
                    {/each}
                  </select>
                </div>
              {/if}

              <!-- 검색 -->
              <div class="flex gap-1">
                <select 
                  bind:value={searchType}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 5px 6px; font-size: 0.75rem; min-width: 65px;"
                >
                  <option value="name">제품명</option>
                  <option value="code">코드</option>
                </select>
                <input 
                  type="text" 
                  placeholder="검색어 입력 (선택사항)..."
                  bind:value={searchKeyword}
                  class="flex-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  style="padding: 5px 8px; font-size: 0.75rem;"
                  on:focus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0,123,255,0.25)'}
                  on:blur={(e) => e.target.style.boxShadow = 'none'}
                  on:keydown={handleSearchKeydown}
                  on:click|stopPropagation
                />
                <button 
                  class="text-white border-none rounded cursor-pointer transition-colors hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                  style="padding: 5px 8px; background-color: #007bff; min-width: 32px;"
                  on:click|stopPropagation={handleSearch}
                  disabled={searchLoading}
                  title={searchLoading ? '검색중' : '조회'}
                >
                  {#if searchLoading}
                    <div class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  {:else}
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  {/if}
                </button>
              </div>
            </div>
          </div>
          
          <!-- 목록 -->
          <div class="overflow-y-auto" style="max-height: {typeof window !== 'undefined' && window.innerWidth <= 1024 ? 'calc(100vh - env(safe-area-inset-top, 0px) - 250px)' : 'calc(100vh - 200px)'};">
            {#if searchError}
              <div class="text-center text-red-600 bg-red-50" style="padding: 30px 15px;">
                {searchError}
              </div>
            {:else if searchLoading}
              <div class="text-center text-gray-600" style="padding: 30px 15px;">
                <div class="mx-auto mb-2.5 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" style="width: 25px; height: 25px;"></div>
                검색 중...
              </div>
            {:else if products.length > 0}
              <div style="padding: 10px;">
                {#each products as product}
                  <div 
                    class="relative bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer transition-colors hover:bg-gray-50 {selectedProduct?.code === product.code ? 'border-blue-500 bg-blue-50' : ''} {product.discontinued ? 'opacity-60 bg-gray-50' : ''}"
                    style="margin-bottom: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                    on:click|stopPropagation={() => selectProduct(product)}
                  >
                    <!-- 이미지 및 기본 정보 -->
                    <div class="flex" style="gap: 12px;">
                      <!-- 상품 이미지 -->
                      <div class="flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden" style="width: 80px; height: 80px;">
                        <img 
                          src={getProxyImageUrl(product.code)} 
                          alt={product.name}
                          class="w-full h-full object-cover cursor-pointer"
                          on:click|stopPropagation={() => handleImageClick(product.code, product.name)}
                          on:load={cacheImage}
                          on:error={(e) => {
                            e.target.src = '/placeholder.png';
                            e.target.style.background = '#f0f0f0';
                          }}
                        />
                      </div>

                      <!-- 상품 정보 -->
                      <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-gray-900 mb-1" style="font-size: 0.7rem; line-height: 1.3; word-break: break-all;">{product.name}</h3>
                        <div class="text-blue-600 font-bold" style="font-size: 0.65rem;">{product.code}</div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center text-gray-600" style="padding: 30px 15px; font-size: 0.9rem;">
                조회 버튼을 클릭하여 제품을 조회하세요.
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 메인 콘텐츠 영역 (flex-1) -->
      <div class="flex-1 min-w-0 px-2">
        <!-- 반응형 레이아웃: 모바일/PC 모두 세로배치 -->
        <div class="flex flex-col gap-5">
          
          <!-- 카테고리 관리 섹션 (항상 위) -->
          <div class="w-full">
            <!-- 첫 번째 카드: 기본 정보 -->
            <div class="bg-white rounded-lg overflow-hidden mb-5" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div class="border-b border-gray-200" style="padding: 15px 20px;">
                <h3 class="text-gray-800 m-0" style="font-size: 0.9rem;">기본 정보</h3>
              </div>
              
              <div style="padding: 20px;">
                <!-- 첫 번째 행: 코드, 명칭 -->
                <div class="flex gap-4 mb-4">
                  <div class="flex-1">
                    <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">코드</label>
                    <input 
                      type="text" 
                      value={selectedProduct?.code || ''}
                      readonly
                      class="w-full border border-gray-300 rounded focus:outline-none bg-gray-50" 
                      style="padding: 5px 8px; font-size: 0.75rem;" 
                    />
                  </div>
                  <div class="flex-1">
                    <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">명칭</label>
                    <input 
                      type="text" 
                      value={selectedProduct?.name || ''}
                      readonly
                      class="w-full border border-gray-300 rounded focus:outline-none bg-gray-50" 
                      style="padding: 5px 8px; font-size: 0.75rem;" 
                    />
                  </div>
                </div>

                <!-- 두 번째 행: 외부코드 -->
                <div class="mb-4">
                  <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">외부코드</label>
                  <input 
                    type="text" 
                    value={productDetailInfo.PROH_CDOT || ''}
                    readonly
                    class="w-full border border-gray-300 rounded focus:outline-none bg-gray-50" 
                    style="padding: 5px 8px; font-size: 0.75rem;" 
                  />
                </div>

                <!-- QR코드 (새로 추가) -->
                <div class="mb-4">
                  <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">QR코드</label>
                  <input 
                    type="text" 
                    value={productDetailInfo.PROH_QRCD || ''}
                    readonly
                    class="w-full border border-gray-300 rounded focus:outline-none bg-gray-50" 
                    style="padding: 5px 8px; font-size: 0.75rem;" 
                  />
                </div>

                <!-- 제품설명 -->
                <div class="mb-4">
                  <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">제품설명</label>
                  <textarea 
                    value={productDetailInfo.PROH_BIGO || ''}
                    readonly
                    class="w-full border border-gray-300 rounded focus:outline-none bg-gray-50" 
                    rows="3" 
                    style="padding: 5px 8px; font-size: 0.75rem;"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- 두 번째 카드: 가격 정보 (제품정보일 때만 표시) -->
            {#if isProductInfo}
            <div class="bg-white rounded-lg overflow-hidden mb-5" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div class="border-b border-gray-200" style="padding: 15px 20px;">
                <h3 class="text-gray-800 m-0" style="font-size: 0.9rem;">가격 정보</h3>
              </div>
              
              <div class="p-5">
                <!-- 탭 버튼 -->
                <div class="flex mb-4" style="border-bottom: 1px solid #e5e7eb;">
                  <button 
                    class="px-2 py-1 text-sm font-medium border-b-2 transition-colors {activePriceTab === 'current' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => activePriceTab = 'current'}
                  >
                    가격
                  </button>
                  <button 
                    class="px-2 py-1 text-sm font-medium border-b-2 transition-colors {activePriceTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => activePriceTab = 'history'}
                  >
                    이력
                  </button>
                </div>

                <!-- 가격 탭 내용 -->
                {#if activePriceTab === 'current'}
                  <!-- 현재 가격 테이블 -->
                  <div class="border border-gray-300 rounded overflow-hidden mb-4">
                    <table class="w-full" style="font-size: 0.75rem;">
                      <thead class="bg-gray-100">
                        <tr>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px; width: 40px;">✓</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px;">원가</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px;">카드가</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px;">현금가</th>
                          <th class="text-center" style="padding: 6px;">납품가</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                            <input type="checkbox" />
                          </td>
                          <td class="border-r border-gray-300 text-right" style="padding: 8px; font-weight: 500;">
                            {priceInfo.DPRC_BAPR ? Number(priceInfo.DPRC_BAPR).toLocaleString('ko-KR') : '-'}
                          </td>
                          <td class="border-r border-gray-300 text-right" style="padding: 8px; font-weight: 500;">
                            {priceInfo.DPRC_SOPR ? Number(priceInfo.DPRC_SOPR).toLocaleString('ko-KR') : '-'}
                          </td>
                          <td class="border-r border-gray-300 text-right" style="padding: 8px; font-weight: 500;">
                            {priceInfo.DPRC_DCPR ? Number(priceInfo.DPRC_DCPR).toLocaleString('ko-KR') : '-'}
                          </td>
                          <td class="text-right" style="padding: 8px; font-weight: 500;">
                            {priceInfo.DPRC_DEPR ? Number(priceInfo.DPRC_DEPR).toLocaleString('ko-KR') : '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- 수량 할인 테이블 -->
                  <div class="mt-4">
                    <h4 class="text-gray-700 font-medium mb-2" style="font-size: 0.8rem;">수량 할인</h4>
                    <div class="border border-gray-300 rounded overflow-hidden">
                      <table class="w-full" style="font-size: 0.75rem;">
                        <thead class="bg-gray-100">
                          <tr>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px; width: 40px;">✓</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;" colspan="2">현금</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">할인수량</th>
                            <th class="text-center" style="padding: 6px;">할인금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                              <input type="checkbox" />
                            </td>
                            <td class="border-r border-gray-300 text-center" style="padding: 6px; color: #2563eb; font-weight: 500;">
                              {discountInfo[0]?.YOUL_GUBN || ''}
                            </td>
                            <td class="border-r border-gray-300" style="padding: 6px;">
                              {discountInfo[0]?.MINR_NAME || ''}
                            </td>
                            <td class="border-r border-gray-300 text-right" style="padding: 6px; font-weight: 500;">
                              {discountInfo[0]?.YOUL_QTY1 ? Number(discountInfo[0].YOUL_QTY1).toLocaleString('ko-KR') : '-'}
                            </td>
                            <td class="text-right" style="padding: 6px; font-weight: 500;">
                              {discountInfo[0]?.YOUL_AMT1 ? Number(discountInfo[0].YOUL_AMT1).toLocaleString('ko-KR') : '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                {/if}

                <!-- 이력 탭 내용 -->
                {#if activePriceTab === 'history'}
                  <div class="border border-gray-300 rounded overflow-hidden">
                    {#if priceHistory.length > 0}
                      <table class="w-full" style="font-size: 0.75rem;">
                        <thead class="bg-gray-100">
                          <tr>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">일자</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">원가</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">카드가</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">현금가</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">납품가</th>
                            <th class="text-center" style="padding: 6px;">등록자</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each priceHistory as history}
                            <tr class="hover:bg-gray-50">
                              <td class="border-r border-gray-300 text-center" style="padding: 6px; color: #2563eb;">
                                {history.DPRC_DATE.substring(0,4)}-{history.DPRC_DATE.substring(4,6)}-{history.DPRC_DATE.substring(6,8)}
                              </td>
                              <td class="border-r border-gray-300 text-right" style="padding: 6px;">
                                {history.DPRC_BAPR ? Number(history.DPRC_BAPR).toLocaleString('ko-KR') : '-'}
                              </td>
                              <td class="border-r border-gray-300 text-right" style="padding: 6px;">
                                {history.DPRC_SOPR ? Number(history.DPRC_SOPR).toLocaleString('ko-KR') : '-'}
                              </td>
                              <td class="border-r border-gray-300 text-right" style="padding: 6px;">
                                {history.DPRC_DCPR ? Number(history.DPRC_DCPR).toLocaleString('ko-KR') : '-'}
                              </td>
                              <td class="border-r border-gray-300 text-right" style="padding: 6px;">
                                {history.DPRC_DEPR ? Number(history.DPRC_DEPR).toLocaleString('ko-KR') : '-'}
                              </td>
                              <td class="text-center" style="padding: 6px; color: #666; font-size: 0.7rem;">
                                {history.DPRC_IUSR || '-'}
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    {:else}
                      <div class="text-center text-gray-500 py-8">
                        가격 이력이 없습니다.
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            {/if}

            <!-- 세 번째 카드: 상세내역 -->
            <div class="bg-white rounded-lg overflow-hidden" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div class="border-b border-gray-200" style="padding: 15px 20px;">
                <h3 class="text-gray-800 m-0" style="font-size: 0.9rem;">상세내역</h3>
              </div>
              
              <div class="p-5">
                <!-- 탭 버튼 -->
                <div class="flex mb-4" style="border-bottom: 1px solid #e5e7eb;">
                  <button 
                    class="px-2 py-1 text-sm font-medium border-b-2 transition-colors {activeDetailTab === 'info' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => activeDetailTab = 'info'}
                  >
                    정보
                  </button>
                  <button 
                    class="px-2 py-1 text-sm font-medium border-b-2 transition-colors {activeDetailTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => activeDetailTab = 'history'}
                  >
                    이력
                  </button>
                </div>

                <!-- 정보 탭 내용 -->
                {#if activeDetailTab === 'info'}
                  <div class="border border-gray-300 rounded overflow-hidden">
                    <table class="w-full" style="font-size: 0.75rem;">
                      <thead class="bg-gray-100">
                        <tr>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px; width: 40px;">✓</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px; width: 60px;">코드</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px;">명칭</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px;">입력</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 6px;">입력명</th>
                          <th class="text-center" style="padding: 6px;">형태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each productDetailItems as item, index}
                          <tr class="hover:bg-gray-50">
                            <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                              <input type="checkbox" readonly />
                            </td>
                            <td class="border-r border-gray-300 text-center" style="padding: 6px; font-weight: 500; color: #2563eb;">
                              {item.MINR_CODE}
                            </td>
                            <td class="border-r border-gray-300" style="padding: 6px;">
                              {item.MINR_NAME}
                            </td>
                            <td class="border-r border-gray-300" style="padding: 6px; text-align: center;">
                              {#if item.PROD_TXT1}
                                <span class="text-gray-800 font-medium">{item.PROD_TXT1}</span>
                              {:else if item.PROD_NUM1 && item.PROD_NUM1 > 0}
                                <span class="text-blue-600 font-medium">{item.PROD_NUM1}</span>
                              {:else}
                                <span class="text-gray-400">-</span>
                              {/if}
                            </td>
                            <td class="border-r border-gray-300" style="padding: 6px; color: #666;">
                              {item.CODE_NAME || '-'}
                            </td>
                            <td class="border-r border-gray-300 text-center" style="padding: 6px; color: #666; font-size: 0.7rem;">
                              {item.MINR_BIGO || '-'}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                <!-- 이력 탭 내용 -->
                {#if activeDetailTab === 'history'}
                  <div class="border border-gray-300 rounded overflow-hidden">
                    {#if detailHistory.length > 0}
                      <table class="w-full" style="font-size: 0.75rem;">
                        <thead class="bg-gray-100">
                          <tr>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">일자</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px; width: 60px;">코드</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">명칭</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">입력</th>
                            <th class="border-r border-gray-300 text-center" style="padding: 6px;">입력명</th>
                            <th class="text-center" style="padding: 6px;">형태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each detailHistory as history}
                            <tr class="hover:bg-gray-50">
                              <td class="border-r border-gray-300 text-center" style="padding: 6px; color: #2563eb;">
                                {history.PROT_DATE.substring(0,4)}-{history.PROT_DATE.substring(4,6)}-{history.PROT_DATE.substring(6,8)}
                              </td>
                              <td class="border-r border-gray-300 text-center" style="padding: 6px; font-weight: 500; color: #2563eb;">
                                {history.MINR_CODE}
                              </td>
                              <td class="border-r border-gray-300" style="padding: 6px;">
                                {history.MINR_NAME}
                              </td>
                              <td class="border-r border-gray-300" style="padding: 6px; text-align: center;">
                                {#if history.PROT_TXT1}
                                  <span class="text-gray-800 font-medium">{history.PROT_TXT1}</span>
                                {:else if history.PROT_NUM1 && history.PROT_NUM1 > 0}
                                  <span class="text-blue-600 font-medium">{history.PROT_NUM1}</span>
                                {:else}
                                  <span class="text-gray-400">-</span>
                                {/if}
                              </td>
                              <td class="border-r border-gray-300" style="padding: 6px; color: #666;">
                                {history.CODE_NAME || '-'}
                              </td>
                              <td class="text-center" style="padding: 6px; color: #666; font-size: 0.7rem;">
                                {history.MINR_BIGO || '-'}
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    {:else}
                      <div class="text-center text-gray-500 py-8">
                        상세 이력이 없습니다.
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- 이미지 관리 섹션 (항상 아래) -->
          <div class="w-full">
            <div class="bg-white rounded-lg overflow-hidden" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- 헤더 -->
              <div class="border-b border-gray-200 flex justify-between items-center flex-wrap" style="padding: 15px 20px; gap: 15px;">
                <div class="flex items-center gap-2.5">
                  <h3 class="text-gray-800 m-0" style="font-size: 0.8rem;">
                    📷 이미지 관리{#if selectedProduct} - {selectedProduct.name}{/if}
                  </h3>
                  {#if selectedProduct}
                    <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {selectedProduct.code}
                    </span>
                  {/if}
                </div>
              </div>
                            
              <!-- 이미지 업로더 -->
              <div class="p-5">
                <ImageUploader
                  bind:this={imageUploader}
                  imagGub1={currentCompanyCode}
                  imagGub2={currentRegistrationCode}
                  imagCode={selectedProduct?.code || ''}
                />
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 이미지 모달 -->
<ImageModalStock 
  on:stockUpdated={handleStockUpdated}
  on:discontinuedUpdated={handleDiscontinuedUpdated}
/>