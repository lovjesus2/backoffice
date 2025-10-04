
<!-- src/routes/admin/sales/sales-registration/+page.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  import { openImageModal, getProxyImageUrl } from '$lib/utils/imageModalUtils';
  import ImageModalStock from '$lib/components/ImageModalStock.svelte';
  import { getLayoutConstants } from '$lib/utils/deviceUtils';
  import ProductSearchPopup from '$lib/components/ProductSearchPopup.svelte'; // 품목검색 팝업
  
  export let data;
  
  // =============================================================================
  // 모든 변수를 상단에 한번에 선언 (순서 중요)
  // =============================================================================
  
  // 기본 상태 변수들
  
  let showProductPopup = false; // 제품 조회 팝업 관련 변수 추가
  let leftPanelVisible = true;
  let error = '';
  let success = '';
  let loadingDetailInfo = false; // 🔥 이 변수 먼저 선언
  let isSaving = false;
  let saveSuccess = '';
  let saveError = '';
  let detailChanged = false;
  let searchLoading = false;
  let searchError = '';
  let isSearchingProduct = false;
  let backofficeMenuOpen = false;
  
  // 검색 및 필터 관련
  let companyList = [];
  let registrationList = [];
  let selectedCompany = '';
  let selectedRegistration = 'AK';
  let searchType = 'name';
  let searchKeyword = '';
  let startDate = '';
  let endDate = '';
  
  // 제품 관련
  let products = [];
  let selectedProduct = null;
  let productDetailItems = [];
  
  // 매출 정보
  let saleInfo = {
    slip: '',
    date: '',
    categoryCode: '',
    categoryName: '',
    shopCode: '',
    shopName: '',
    customerCode: '',
    customerName: '',
    memo: ''
  };
  
  // 상세내역
  let detailItems = [];
  let selectedSaleSlip = '';
  let basicInfoExpanded = false;
  
  // 합계 정보
  let totalSummaryData = {
    totalAmount: 0,
    cashAmount: 0,
    cardAmount: 0,
    totalQty: 0,
    cashQty: 0,
    cardQty: 0
  };
  
  let summaryData = {
    totalAmount: 0,
    cashAmount: 0,
    cardAmount: 0,
    totalQty: 0,
    cashQty: 0,
    cardQty: 0
  };
  
  // 콤보박스 데이터
  let saleCategoryList = [];
  let shopList = [];
  let customerList = [];
  
  // 바코드 관련
  let barcodeInput;
  let barcodeValue = '';
  
  // 기타
  let layoutConstants = [];
  let basicInfo = {
    code: '',
    name: '',
    externalCode: '',
    qrCode: '',
    description: ''
  };
  
  // 가격정보 및 수량할인 데이터
  let priceData = {
    basePrice: 0,
    cardPrice: 0,
    cashPrice: 0,
    deliveryPrice: 0,
    priceEnabled: false
  };
  
  let discountData = {
    discountType: '',
    quantity: 0,
    amount: 0,
    isChecked: false
  };
  
  let discountTypeOptions = [];
  
  // =============================================================================
  // Reactive Statements (변수 선언 후에 배치)
  // =============================================================================
  
  $: allCashChecked = detailItems.length > 0 && detailItems.every(item => item.isCash);
  $: currentCompanyCode = selectedCompany;
  $: currentRegistrationCode = selectedRegistration;
  $: currentRegistrationName = registrationList.find(r => r.MINR_CODE === selectedRegistration)?.MINR_NAME || '';
  $: canSave = detailItems.length > 0 && 
              saleInfo.date && 
              saleInfo.shopCode && 
              saleInfo.categoryCode &&
              !isSaving;
  $: canDelete = selectedSaleSlip && !isSaving;
  
  // 메시지 자동 숨김
  $: if (success) {
    setTimeout(() => success = '', 3000);
  }
  
  $: if (error) {
    setTimeout(() => error = '', 5000);
  }
  
  // 모바일에서 패널 열림/닫힘 상태에 따른 body 스크롤 제어
  $: if (typeof window !== 'undefined') {
    if (window.innerWidth <= 740 && leftPanelVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  
  // =============================================================================
  // 함수들 (모든 변수 선언 후에 배치)
  // =============================================================================
  
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

  // 기본정보 접기
  function toggleBasicInfo() {
    basicInfoExpanded = !basicInfoExpanded;
  }
  
  function handleBasicInfoKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleBasicInfo();
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
  
  // 스크롤 이벤트 전파 차단 함수들
  function handlePanelWheel(event) {
    if (typeof window !== 'undefined' && window.innerWidth >= 740) {
      return;
    }

    const target = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    const isScrollable = scrollHeight > clientHeight;
    
    if (!isScrollable) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    const delta = event.deltaY;
    
    if (scrollTop === 0 && delta < 0) {
      event.stopPropagation();
    } else if (scrollTop >= scrollHeight - clientHeight && delta > 0) {
      event.stopPropagation();
    }
  }

  function handlePanelTouchMove(event) {
    event.stopPropagation();
  }  

  // ESC 키로 패널 닫기
  function handleKeydown(event) {
    if (event.key === 'Escape' && leftPanelVisible && typeof window !== 'undefined' && window.innerWidth <= 1024) {
      leftPanelVisible = false;
    }
  }

  // 회사구분 목록 조회
  async function loadCompanyList() {
    try {
      const response = await fetch('/api/common-codes/minr?majr_code=A0001');
      const result = await response.json();
      
      if (result.success) {
        companyList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
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

  // 회사구분 선택 시 처리
  async function handleCompanyChange() {
    const selectedCompanyItem = companyList.find(item => item.MINR_CODE === selectedCompany);
    selectedRegistration = 'AK';
    
    await tick();
    await loadDetailStructure();
    
    products = [];
    selectedProduct = null;
    searchError = '';
  }

  // 매출구분 목록 조회
  async function loadSaleCategoryList() {
    try {
      const response = await fetch('/api/common-codes/minr?majr_code=D0001');
      const result = await response.json();
      
      if (result.success) {
        saleCategoryList = result.data.sort((a, b) => parseInt(a.MINR_SORT) - parseInt(b.MINR_SORT));
        saleInfo.categoryCode = 'SL';
      }
    } catch (err) {
      console.error('매출구분 조회 오류:', err);
    }
  }

  // 매장 목록 조회
  async function loadShopList() {
    try {
      const response = await fetch('/api/common-codes/shop');
      const result = await response.json();
      
      if (result.success) {
        shopList = result.data;
        saleInfo.shopCode = 'A1';
      } else {
        console.error('매장 목록 조회 실패:', result.message);
      }
    } catch (err) {
      console.error('매장 목록 조회 오류:', err);
    }
  }

  // 납품처 목록 조회
  async function loadCustomerList() {
    try {
      const response = await fetch('/api/common-codes/customer');
      const result = await response.json();
      
      if (result.success) {
        customerList = result.data;
      } else {
        console.error('납품처 목록 조회 실패:', result.message);
      }
    } catch (err) {
      console.error('납품처 목록 조회 오류:', err);
    }
  }

  // 상세내역 구조 조회
  async function loadDetailStructure() {
        // 임시 디버깅용 - 변수가 정의되지 않은 경우 초기화
    if (typeof loadingDetailInfo === 'undefined') {
      loadingDetailInfo = false;
      console.log('⚠️ loadingDetailInfo 변수를 강제 초기화했습니다');
    }
    
    console.log('🔍 loadDetailStructure 호출됨');
    console.log('🔍 조건 확인:', { 
      currentCompanyCode, 
      currentRegistrationCode,
      selectedRegistration,
      registrationListLength: registrationList.length
    });

    if (!currentCompanyCode || !currentRegistrationCode) {
      console.log('⏰ 상세내역 구조 조회 조건 부족');
      productDetailItems = [];
      return;
    }

    try {
      loadingDetailInfo = true;
      
      const selectedRegistrationItem = registrationList.find(item => item.MINR_CODE === selectedRegistration);
      console.log('🔍 선택된 등록구분 아이템:', selectedRegistrationItem);
      
      const categoryCode = selectedRegistrationItem?.MINR_BIGO || '';
      console.log('🔍 categoryCode:', categoryCode);
      
      if (!categoryCode) {
        console.log('⏰ 등록구분의 MINR_BIGO가 없음');
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
        product_code: '',
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
        console.error('⏰ 상세내역 구조 조회 실패:', result.message);
        productDetailItems = [];
      }
    } catch (err) {
      console.error('⏰ 상세내역 구조 조회 오류:', err);
      productDetailItems = [];
    } finally {
      loadingDetailInfo = false;
    }
  }

  // 검색 실행
  async function handleSearch() {
    console.log('=== 제품 검색 시작 ===');
    
    if (!currentCompanyCode || !currentRegistrationCode) {
      searchError = '회사구분과 등록구분을 선택해주세요.';
      return;
    }

    searchLoading = true;
    searchError = '';
    products = [];
    
    totalSummaryData = {
      totalAmount: 0,
      cashAmount: 0,
      cardAmount: 0,
      totalQty: 0,
      cashQty: 0,
      cardQty: 0
    };

    try {
      const params = new URLSearchParams({
        search_term: searchKeyword.trim() || '',
        search_type: searchType,
        discontinued_filter: 'all',
        company_code: currentCompanyCode,
        registration_code: currentRegistrationCode,
        registration_name: currentRegistrationName,
        start_date: startDate.replace(/-/g, '') || '',
        end_date: endDate.replace(/-/g, '') || ''
      });

      const apiUrl = `/api/sales/sales-registration/search?${params}`;
      console.log('API 호출 URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();

      if (result.success) {
        products = result.data;
        
        if (products.length > 0) {
          totalSummaryData.cashAmount = products.reduce((sum, item) => sum + Number(item.CASH_AMT || 0), 0);
          totalSummaryData.cardAmount = products.reduce((sum, item) => sum + Number(item.CARD_AMT || 0), 0);
          totalSummaryData.totalAmount = totalSummaryData.cashAmount + totalSummaryData.cardAmount;
          totalSummaryData.cashQty = products.reduce((sum, item) => sum + Number(item.CASH_QTY || 0), 0);
          totalSummaryData.cardQty = products.reduce((sum, item) => sum + Number(item.CARD_QTY || 0), 0);
          totalSummaryData.totalQty = totalSummaryData.cashQty + totalSummaryData.cardQty;
        }
        
        if (products.length === 0) {
          searchError = '검색 결과가 없습니다.';
        }
      } else {
        searchError = result.message || '검색 실패';
        products = [];
      }
    } catch (err) {
      console.error('네트워크 에러:', err);
      searchError = `검색 중 오류가 발생했습니다: ${err.message}`;
      products = [];
    } finally {
      searchLoading = false;
    }
  }

  // 바코드 입력 처리
  async function handleBarcodeKeydown(event) {
    if (event.key === 'Enter' && barcodeValue.trim()) {
      event.preventDefault();
      await searchAndAddProduct(barcodeValue.trim().toUpperCase());
      barcodeValue = '';
    }
  }

  // 제품 검색 및 추가(바코드)
  async function searchAndAddProduct(productCode) {
    if (isSearchingProduct) return;
    
    try {
      isSearchingProduct = true;
      console.log('제품 검색:', productCode);
      
      const params = new URLSearchParams({
        code: productCode
      });
      
      const response = await fetch(`/api/sales/sales-registration/barcode-search?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const productInfo = result.data;
        
        const existingIndex = detailItems.findIndex(item => item.itemCode === productCode);
        
        if (existingIndex >= 0) {
          detailItems[existingIndex].quantity++;
          const unitPrice = detailItems[existingIndex].isCash ? 
            detailItems[existingIndex].cashPrice : 
            detailItems[existingIndex].cardPrice;
          detailItems[existingIndex].amount = detailItems[existingIndex].quantity * unitPrice;
          console.log('기존 제품 수량 증가:', productCode);
        } else {
          const newItem = {
            seq: detailItems.length + 1,
            itemCode: productCode,
            itemName: productInfo.name || '',
            itemDescription: productInfo.description || '',
            isCash: false,
            quantity: 1,
            cardPrice: productInfo.cardPrice || 0,
            cashPrice: productInfo.cashPrice || 0,
            deliveryPrice: productInfo.deliveryPrice || 0,
            currentStock: productInfo.stock || 0,
            stockManaged: productInfo.stockManaged || false,
            isOnline: productInfo.isOnline || false,
            qrCode: '',
            discountQty: 0,
            discountAmount: 0,
            discountType: 0
          };
          
          newItem.amount = newItem.quantity * newItem.cardPrice;
          
          detailItems = [newItem, ...detailItems];
          console.log('새 제품 추가:', productCode);
        }
        
        updateSummary();
        
      } else {
        console.error('제품을 찾을 수 없습니다:', productCode);
        alert(result.message || `제품 코드 '${productCode}'를 찾을 수 없습니다.`);
      }
      
    } catch (error) {
      console.error('제품 검색 오류:', error);
      alert('제품 검색 중 오류가 발생했습니다.');
    } finally {
      isSearchingProduct = false;
      
      if (barcodeInput) {
        setTimeout(() => barcodeInput.focus(), 100);
      }
    }
  }

  // 상세내역 항목 삭제
  function removeDetailItem(index) {
    detailItems.splice(index, 1);
    detailItems = [...detailItems];
    updateSummary();
    
    if (barcodeInput) {
      setTimeout(() => barcodeInput.focus(), 100);
    }
    
    console.log(`항목 ${index} 삭제됨, 남은 항목: ${detailItems.length}개`);
  }

  // 오버레이 클릭 처리
  function handleOverlayClick(event) {
    event.preventDefault();
    event.stopPropagation();
    leftPanelVisible = false;
  }

  // 패널 내부 클릭 시 이벤트 전파 중지
  function handlePanelClick(event) {
    event.stopPropagation();
  }

  // 매출 상세 조회
  async function loadSaleDetail(saleSlip) {
    try {
      const params = new URLSearchParams({
        slip: saleSlip,
        company_code: currentCompanyCode,
        registration_code: currentRegistrationCode
      });
      
      const response = await fetch(`/api/sales/sales-registration/detail?${params}`);
      const result = await response.json();
      
      if (result.success) {
        saleInfo = {
          slip: result.basicInfo.slip,
          date: formatDateForInput(result.basicInfo.date),
          categoryCode: result.basicInfo.categoryCode,
          categoryName: result.basicInfo.categoryName,
          shopCode: result.basicInfo.shopCode,
          shopName: result.basicInfo.shopName,
          customerCode: result.basicInfo.customerCode,
          customerName: result.basicInfo.customerName,
          memo: result.basicInfo.memo
        };
        
        detailItems = result.detailItems;
        summaryData = result.summary;
        selectedSaleSlip = saleSlip;
        
        console.log('매출 상세 조회 완료:', saleSlip);
        
        if (barcodeInput) {
          setTimeout(() => barcodeInput.focus(), 200);
        }
        
      } else {
        console.error('매출 상세 조회 실패:', result.message);
      }
    } catch (error) {
      console.error('매출 상세 조회 오류:', error);
    }
  }

  // 날짜 형식 변환
  function formatDateForInput(dateStr) {
    if (!dateStr || dateStr.length !== 8) return '';
    
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }

  // 결제 타입 변경 시 금액 자동 계산
  function handlePaymentTypeChange(index) {
    const item = detailItems[index];
    const unitPrice = item.isCash ? item.cashPrice : item.cardPrice;
    item.amount = unitPrice * item.quantity;
    detailItems = [...detailItems];
    updateSummary();
  }

  // 수량 변경 시 금액 자동 계산
  function handleQuantityChange(index) {
    const item = detailItems[index];
    const unitPrice = item.isCash ? item.cashPrice : item.cardPrice;
    item.amount = unitPrice * item.quantity;
    detailItems = [...detailItems];
    updateSummary();
  }

  // 금액 직접 변경 시
  function handleAmountChange(index) {
    detailItems = [...detailItems];
    updateSummary();
  }

  // 합계 업데이트
  function updateSummary() {
    summaryData.totalQty = detailItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    summaryData.totalAmount = detailItems.reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    summaryData.cashQty = detailItems.filter(item => item.isCash).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    summaryData.cashAmount = detailItems.filter(item => item.isCash).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    summaryData.cardQty = detailItems.filter(item => !item.isCash).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    summaryData.cardAmount = detailItems.filter(item => !item.isCash).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
  }

  // 전체현금 체크 처리
  function handleAllCashChange() {
    const newCashState = !allCashChecked;
    
    detailItems = detailItems.map(item => ({
      ...item,
      isCash: newCashState
    }));
    
    detailItems.forEach((item, index) => {
      handlePaymentTypeChange(index);
    });
    
    updateSummary();
  }

  // 팝업에서 제품 선택 시 처리
  function handleProductSelected(event) {
    const product = event.detail;
    
    // 기존 제품이 있는지 확인
    const existingIndex = detailItems.findIndex(item => item.itemCode === product.code);
    
    if (existingIndex >= 0) {
      // 기존 제품이 있으면 수량 증가
      detailItems[existingIndex].quantity++;
      const unitPrice = detailItems[existingIndex].isCash ? 
        detailItems[existingIndex].cashPrice : 
        detailItems[existingIndex].cardPrice;
      detailItems[existingIndex].amount = detailItems[existingIndex].quantity * unitPrice;
      console.log('기존 제품 수량 증가:', product.code);
    } else {
      // 새 제품 추가 (바코드 스캔과 동일한 로직 사용)
      searchAndAddProductByCode(product.code);
    }
    
    updateSummary();
  }

  // 제품 코드로 상세 정보를 가져와서 추가하는 함수
  async function searchAndAddProductByCode(productCode) {
    try {
      const params = new URLSearchParams({
        code: productCode
      });
      
      const response = await fetch(`/api/sales/sales-registration/barcode-search?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const productInfo = result.data;
        
        const newItem = {
          seq: detailItems.length + 1,
          itemCode: productCode,
          itemName: productInfo.name || '',
          itemDescription: productInfo.description || '',
          isCash: false,
          quantity: 1,
          cardPrice: productInfo.cardPrice || 0,
          cashPrice: productInfo.cashPrice || 0,
          deliveryPrice: productInfo.deliveryPrice || 0,
          currentStock: productInfo.stock || 0,
          stockManaged: productInfo.stockManaged || false,
          isOnline: productInfo.isOnline || false,
          qrCode: '',
          discountQty: 0,
          discountAmount: 0,
          discountType: 0
        };
        
        newItem.amount = newItem.quantity * newItem.cardPrice;
        
        detailItems = [newItem, ...detailItems];
        console.log('새 제품 추가:', productCode);
        
        updateSummary();
      }
    } catch (error) {
      console.error('제품 정보 조회 오류:', error);
    }
  }

  // 현금할인 적용
  function applyCashDiscount() {
    if (detailItems.length === 0) {
      alert('할인을 적용할 항목이 없습니다.');
      return;
    }
    
    const cashItems = detailItems.filter(item => item.isCash);
    
    if (cashItems.length === 0) {
      alert('현금으로 체크된 항목이 없습니다.');
      return;
    }
    
    const confirmMessage = `현금으로 체크된 ${cashItems.length}개 항목에 5% 할인을 적용하시겠습니까?\n(100원 단위 절삭 처리됩니다)`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    detailItems = detailItems.map(item => {
      if (item.isCash) {
        const originalAmount = item.quantity * item.cashPrice;
        const discountedAmount = originalAmount * 0.95;
        const roundedAmount = Math.floor(discountedAmount / 100) * 100;
        
        return {
          ...item,
          amount: roundedAmount
        };
      }
      return item;
    });
    
    updateSummary();
  }

  // 비고내역 토글
  function toggleItemDescription(index) {
    detailItems[index].descriptionExpanded = !detailItems[index].descriptionExpanded;
    detailItems = [...detailItems];
  }

  // 토스트 메시지 표시 함수 추가
  function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
      font-weight: 600;
      font-size: 16px;
      max-width: 400px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      ${type === 'success' ? 'background: linear-gradient(135deg, #10b981, #059669);' : 
        type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626);' : 
        'background: linear-gradient(135deg, #3b82f6, #2563eb);'}
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션으로 표시
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // 4초 후 자동 제거
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // 매출등록 초기화
  function resetAll() {
    const hasAnyChanges = detailItems.length > 0 || 
                        saleInfo.slip || 
                        selectedSaleSlip ||
                        summaryData.totalAmount > 0;
    
    console.log('매출등록 데이터 초기화 시작...');
    
    const today = new Date().toISOString().split('T')[0];
    saleInfo = {
      slip: '',
      date: today,
      categoryCode: 'SL',
      categoryName: '',
      shopCode: 'A1',
      shopName: '',
      customerCode: '',
      customerName: '',
      memo: ''
    };
    
    detailItems = [];
    
    summaryData = {
      totalAmount: 0,
      cashAmount: 0,
      cardAmount: 0,
      totalQty: 0,
      cashQty: 0,
      cardQty: 0
    };
    
    selectedSaleSlip = '';
    barcodeValue = '';
    success = '';
    error = '';
    saveSuccess = '';
    saveError = '';
    searchError = '';
    
    setTimeout(() => {
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 100);
    
    console.log('매출등록 데이터 초기화 완료');
  }

  // 매출등록 저장
  async function saveAll() {
    if (!saleInfo.date) {
      saveError = '매출일자를 입력해주세요.';
      setTimeout(() => saveError = '', 3000);
      return;
    }
    
    if (!saleInfo.shopCode) {
      saveError = '매장을 선택해주세요.';
      setTimeout(() => saveError = '', 3000);
      return;
    }
    
    if (!saleInfo.categoryCode) {
      saveError = '매출구분을 선택해주세요.';
      setTimeout(() => saveError = '', 3000);
      return;
    }
    
    if (!detailItems || detailItems.length === 0) {
      saveError = '매출 상세내역이 없습니다. 상품을 추가해주세요.';
      setTimeout(() => saveError = '', 3000);
      return;
    }
    
    for (let i = 0; i < detailItems.length; i++) {
      const item = detailItems[i];
      if (!item.itemCode) {
        saveError = `${i + 1}번째 상품의 코드가 없습니다.`;
        setTimeout(() => saveError = '', 3000);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        saveError = `${i + 1}번째 상품의 수량이 올바르지 않습니다.`;
        setTimeout(() => saveError = '', 3000);
        return;
      }
      if (!item.amount || item.amount <= 0) {
        saveError = `${i + 1}번째 상품의 금액이 올바르지 않습니다.`;
        setTimeout(() => saveError = '', 3000);
        return;
      }
    }
    
    try {
      isSaving = true;
      saveError = '';
      saveSuccess = '';
      
      console.log('매출등록 저장 시작...');
      
      const saveData = {
        saleInfo: {
          date: saleInfo.date,
          shopCode: saleInfo.shopCode,
          categoryCode: saleInfo.categoryCode,
          customerCode: saleInfo.customerCode || '',
          memo: saleInfo.memo || ''
        },
        detailItems: detailItems.map(item => ({
          itemCode: item.itemCode,
          itemName: item.itemName || '',
          quantity: parseInt(item.quantity),
          amount: parseInt(item.amount),
          isCash: item.isCash || false
        })),
        summaryData: {
          totalQty: summaryData.totalQty,
          totalAmount: summaryData.totalAmount,
          cashAmount: summaryData.cashAmount,
          cardAmount: summaryData.cardAmount,
          cashQty: summaryData.cashQty,
          cardQty: summaryData.cardQty
        },
        selectedSaleSlip: selectedSaleSlip || null,
        companyCode: currentCompanyCode || '',
        registrationCode: currentRegistrationCode || ''
      };
      
      console.log('저장 데이터:', saveData);
      
      const response = await fetch('/api/sales/sales-registration/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || '저장 요청 실패');
      }
      
      if (result.success) {
        // 토스트 메시지 표시
        const amount = summaryData.totalAmount || 0;
        showToast(`💰 매출 저장 완료!\n💳 ${amount.toLocaleString()}원 (${result.slipNo})`, 'success');
        
        saveSuccess = result.message || '매출이 성공적으로 저장되었습니다.';
        
        if (result.slipNo) {
          selectedSaleSlip = result.slipNo;
          console.log('저장된 매출번호:', result.slipNo);
          
          if (result.rand) {
            const receiptUrl = `/receipt?slip=${result.slipNo}&rand=${result.rand}&shop=${result.shop}&date=${result.date}`;
            console.log('영수증 URL:', receiptUrl);
          }
        }
        
        setTimeout(() => {
          saveSuccess = '';
        }, 1000);

        handleSearch();
        resetAll();
        
        console.log('매출등록 저장 완료');
        
      } else {
        throw new Error(result.message || '저장 처리 실패');
      }
      
    } catch (error) {
      console.error('매출등록 저장 오류:', error);
  
      // 토스트 오류 메시지 표시
      showToast(`❌ 저장 실패\n${error.message || '저장 중 오류가 발생했습니다.'}`, 'error');
      saveError = error.message || '저장 중 오류가 발생했습니다.';
      
      setTimeout(() => {
        saveError = '';
      }, 5000);
    } finally {
      isSaving = false;
    }
  }

  // 매출 삭제
  async function deleteSale() {
    if (!selectedSaleSlip) {
      saveError = '삭제할 매출이 선택되지 않았습니다.';
      setTimeout(() => saveError = '', 3000);
      return;
    }
    
    const confirmMessage = `정말로 매출번호 "${selectedSaleSlip}"을 삭제하시겠습니까?\n\n⚠️ 주의사항:\n- 삭제된 데이터는 복구할 수 없습니다\n- 재고가 복원됩니다`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      isSaving = true;
      saveError = '';
      saveSuccess = '';
      
      console.log('매출 삭제 시작:', selectedSaleSlip);
      
      const response = await fetch('/api/sales/sales-registration/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleSlip: selectedSaleSlip,
          companyCode: currentCompanyCode || '',
          registrationCode: currentRegistrationCode || ''
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || '삭제 요청 실패');
      }
      
      if (result.success) {
        showToast('🗑️ 매출 삭제 완료!', 'success');

        setTimeout(() => {
          saveSuccess = '';
        }, 1000);

        handleSearch();
        resetAll();
        console.log('매출 삭제 완료!');
        
      } else {
        throw new Error(result.message || '삭제 처리 실패');
      }
      
    } catch (error) {
      console.error('매출 삭제 오류:', error);
      // 토스트 오류 메시지 표시
      showToast(`❌ 삭제 실패\n${error.message || '삭제 중 오류가 발생했습니다.'}`, 'error');
      saveError = error.message || '삭제 중 오류가 발생했습니다.';
      
      setTimeout(() => {
        saveError = '';
      }, 5000);
    } finally {
      isSaving = false;
    }
  }


  // 페이지 로드 시 초기화
  onMount(async () => {
    layoutConstants = getLayoutConstants();
    
    const today = new Date().toISOString().split('T')[0];
    startDate = today;
    endDate = today;
    saleInfo.date = today;

    await loadSaleCategoryList();
    await loadShopList();
    await loadCustomerList();

    leftPanelVisible = window.innerWidth > 740;
    
    await loadCompanyList();
    
    const detectBackofficeMenu = () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        backofficeMenuOpen = sidebar.classList.contains('open');
        if (window.innerWidth <= 740 && backofficeMenuOpen) {
          leftPanelVisible = false;
        }
      }
    };
    
    const observer = new MutationObserver(detectBackofficeMenu);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    setTimeout(() => {
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 500);
    
    return () => {
      observer.disconnect();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  });


  

</script>

<svelte:head>
  <title>매출등록</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="min-h-screen relative" style="background-color: #f5f5f5;" >
  <!-- 메인 컨텐츠 -->
  <div class="flex flex-col" style="padding: 0; min-height: calc(100vh - var(--header-height));">
    <!-- 헤더 (고정 + 버튼 오른쪽 정렬) -->
    <div class="bg-white border-b mb-2.5" style="position: fixed; top: var(--header-total-height); left: 0; right: 0; border-color: #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 50;">
      <div style="padding: 10px 8px;">
        <div class="flex items-center justify-between">
          <!-- 왼쪽: 햄버거 메뉴 + 제목 -->
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
            <h1 class="text-gray-800 font-semibold m-0" style="font-size: 1rem;">매출등록</h1>
          </div>
          
          <!-- 오른쪽: 초기화, 저장, 삭제 버튼들 -->
          <!-- 헤더의 버튼 섹션 (기존 코드에서 이 부분만 교체) -->
          <div class="flex gap-2">
            <!-- 1. 초기화 버튼 -->
            <button 
              type="button"
              on:click={resetAll}
              disabled={isSaving}
              class="px-3 py-1 text-xs rounded transition-colors duration-200 bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              초기화
            </button>
            
            <!-- 2. 저장 버튼 -->
            <button 
              type="button"
              on:click={saveAll}
              disabled={!canSave}
              class="px-3 py-1 text-xs rounded transition-colors duration-200 
                    {canSave
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
              title={canSave ? '매출 저장' : '저장하려면 매출구분, 매장, 상세내역이 필요합니다'}
            >
              {#if isSaving}
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  저장중
                </div>
              {:else}
                저장
              {/if}
            </button>
            
            <!-- 3. 삭제 버튼 -->
            <button 
              type="button"
              on:click={deleteSale}
              disabled={!canDelete}
              class="px-3 py-1 text-xs rounded transition-colors duration-200 
                    {canDelete
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
              title={canDelete ? '현재 매출 완전 삭제' : '삭제할 매출이 선택되지 않았습니다'}
            >
              삭제
            </button>
          </div>

          <!-- 저장/삭제 결과 메시지 (기존 success/error 메시지 아래에 추가) -->
          {#if saveSuccess}
            <div class="mx-2 my-2.5 px-4 py-2.5 rounded" style="background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; font-size: 0.9rem;">
              ✅ {saveSuccess}
            </div>
          {/if}

          {#if saveError}
            <div class="mx-2 my-2.5 px-4 py-2.5 rounded" style="background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; font-size: 0.9rem;">
              ❌ {saveError}
            </div>
          {/if}
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
    <div class="flex flex-1 relative" style="padding-top: {layoutConstants.safeAreaTop};">
      <!-- 모바일 오버레이 배경 -->
      {#if typeof window !== 'undefined' && window.innerWidth <= 740 && leftPanelVisible}
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 z-20"
          style="top: var(--header-total-height);"
          on:click={handleOverlayClick}
          on:touchstart={handleOverlayClick}
          on:touchmove|preventDefault
        ></div>
      {/if}

      <!-- 매출 조회 패널 (왼쪽) -->
      <div class="transition-all duration-300 {leftPanelVisible ? 'opacity-100' : 'opacity-0'} lg:relative lg:ml-2.5 {leftPanelVisible ? '' : 'hidden'}" 
          style="flex: 0 0 350px; background: transparent; z-index: 25; max-width: 350px; min-width: 350px;"
          class:fixed={typeof window !== 'undefined' && window.innerWidth <= 740}
          class:left-0={typeof window !== 'undefined' && window.innerWidth <= 740}
          class:bg-white={typeof window !== 'undefined' && window.innerWidth <= 740}
          style:top={typeof window !== 'undefined' && window.innerWidth <= 740 ? layoutConstants.sideMenuTop : 'auto'}
          style:height={typeof window !== 'undefined' && window.innerWidth <= 740 ? layoutConstants.sideMenuHeight : 'auto'}
          style:box-shadow={typeof window !== 'undefined' && window.innerWidth <= 740 ? '2px 0 8px rgba(0,0,0,0.1)' : 'none'}
          style:transform={typeof window !== 'undefined' && window.innerWidth <= 740 && !leftPanelVisible ? 'translateX(-100%)' : 'translateX(0)'}
          on:click={handlePanelClick}>
        
        <div class="bg-white rounded-lg m-2 overflow-hidden mb-5" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: {typeof window !== 'undefined' && window.innerWidth >= 1024 ? '1px' : '8px'}; height: {typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'calc(100vh + 20px)' : layoutConstants.sideMenuHeight};"
              on:click={handlePanelClick}
              on:wheel={handlePanelWheel}
              on:touchmove|nonpassive={handlePanelTouchMove}>
          
          <!-- 패널 헤더 -->
          <div class="py-4 px-5 border-b border-gray-200 flex flex-col items-stretch gap-4 relative" style="gap: 15px;">
            {#if typeof window !== 'undefined' && window.innerWidth <= 740}
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
                  style="padding: 5px 8px; font-size: 0.8rem;"
                >
                  {#each companyList as company}
                    <option value={company.MINR_CODE}>{company.MINR_NAME}</option>
                  {/each}
                </select>
              </div>

              <!-- 등록구분 -->
              <div class="flex flex-row items-center gap-2" style="display: none;">
                <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">등록구분</label>
                <select 
                  bind:value={selectedRegistration}
                  disabled={registrationList.length === 0}
                  class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100 flex-1"
                  style="padding: 5px 8px; font-size: 0.8rem;"
                >
                  {#each registrationList as registration}
                    <option value={registration.MINR_CODE}>{registration.MINR_NAME}</option>
                  {/each}
                </select>
              </div>

              <!-- 기간 선택 -->
              <div class="flex flex-row items-center gap-2">
                <label class="mb-0 text-gray-600 font-medium min-w-0 flex-shrink-0" style="color: #555; font-weight: 500; font-size: 0.75rem; width: 60px;">기간</label>
                <div class="flex gap-1 flex-1">
                  <input 
                    type="date" 
                    bind:value={startDate}
                    class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 flex-1"
                    style="padding: 5px 8px; font-size: 0.75rem; min-width: 0; width: 1px;"
                  />
                  <span class="text-gray-500 text-xs flex items-center">~</span>
                  <input 
                    type="date" 
                    bind:value={endDate}
                    class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 flex-1"
                    style="padding: 5px 8px; font-size: 0.75rem; min-width: 0; width: 1px;"
                  />
                </div>
              </div>

              <!-- 검색 -->
              <div class="flex gap-1">
                <!-- 검색 타입 선택 추가 -->
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
          <div 
            class="overflow-y-auto" 
            style="max-height: {typeof window !== 'undefined' && window.innerWidth <= 1024 ? layoutConstants.listMaxHeight : 'calc(100vh - 150px)'}; overscroll-behavior: contain;"
            on:wheel={handlePanelWheel}
            on:touchmove={handlePanelTouchMove}
          >
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
                
                <!-- 매출 합계 카드 (상단 한번만) -->
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-3" style="padding: 4px;">
                  <div class="grid grid-cols-3 gap-1 text-xs">
                    <!-- 전체 합계 -->
                    <div class="bg-white rounded border border-blue-100" style="padding: 6px; text-align: center;">
                      <div class="text-gray-600 font-medium" style="font-size: 0.6rem;">
                        전체 ({totalSummaryData.totalQty.toLocaleString('ko-KR')}개)
                      </div>
                      <div class="font-bold text-blue-900" style="font-size: 0.65rem;">
                        {totalSummaryData.totalAmount.toLocaleString('ko-KR')}원
                      </div>
                    </div>
                    
                    <!-- 카드 합계 -->
                    <div class="bg-white rounded border border-green-100" style="padding: 6px; text-align: center;">
                      <div class="text-gray-600 font-medium" style="font-size: 0.6rem;">
                        카드 ({totalSummaryData.cardQty.toLocaleString('ko-KR')}개)
                      </div>
                      <div class="font-bold text-green-700" style="font-size: 0.65rem;">
                        {totalSummaryData.cardAmount.toLocaleString('ko-KR')}원
                      </div>
                    </div>
                    
                    <!-- 현금 합계 -->
                    <div class="bg-white rounded border border-yellow-100" style="padding: 6px; text-align: center;">
                      <div class="text-gray-600 font-medium" style="font-size: 0.6rem;">
                        현금 ({totalSummaryData.cashQty.toLocaleString('ko-KR')}개)
                      </div>
                      <div class="font-bold text-yellow-700" style="font-size: 0.65rem;">
                        {totalSummaryData.cashAmount.toLocaleString('ko-KR')}원
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 매출 이력 테이블 (가로 스크롤) -->
                <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <!-- 가로 스크롤 컨테이너 -->
                  <div class="overflow-x-auto" style="max-width: 100%;">
                    <table class="w-full" style="font-size: 0.7rem; min-width: 600px;">
                      <thead class="bg-gray-100">
                        <tr>
                          <th class="border-r border-gray-300 text-center" style="padding: 8px; width: 80px; min-width: 80px;">매출일자</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 8px; width: 40px; min-width: 40px;">수량</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 8px; width: 90px; min-width: 90px;">금액</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 8px; width: 50px; min-width: 50px;">엽서</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 8px; width: 80px; min-width: 80px;">매출구분</th>
                          <th class="border-r border-gray-300 text-center" style="padding: 8px; width: 100px; min-width: 100px;">납품처</th>
                          <th class="text-center" style="padding: 8px; width: 100px; min-width: 100px;">매출번호</th>
                        </tr>
                      </thead>
                      <tbody>
                          {#each products as sale}
                            <tr class="border-b border-gray-100 cursor-pointer hover:bg-blue-50
                                      {Number(sale.CASH_AMT) > 0 && Number(sale.CARD_AMT) === 0 ? 'bg-pink-50 hover:bg-pink-100' : 
                                      Number(sale.CASH_AMT) > 0 && Number(sale.CARD_AMT) > 0 ? 'bg-green-50 hover:bg-green-100' : 
                                      'hover:bg-gray-50'}"
                                on:click={() => loadSaleDetail(sale.DNHD_SLIP)}>
                            
                            <!-- 매출일자 -->
                            <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                              <div class="text-blue-600 font-medium" style="font-size: 0.65rem;">
                                {sale.DNHD_DATE_FORMATTED || sale.DNHD_DATE}
                              </div>
                            </td>
                            
                            <!-- 매출수량 -->
                            <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                              <div class="font-medium" style="font-size: 0.65rem;">
                                {Number(sale.DNHD_QTY1 || 0).toLocaleString('ko-KR')}
                              </div>
                            </td>
                            
                            <!-- 매출금액 -->
                            <td class="border-r border-gray-300 text-right" style="padding: 6px;">
                              <div class="font-bold text-green-700" style="font-size: 0.65rem;">
                                {Number(sale.DNHD_TAMT || 0).toLocaleString('ko-KR')}원
                              </div>
                            </td>
                            
                            <!-- 엽서 -->
                            <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                              <div style="font-size: 0.65rem;">
                                {sale.POST_SLIP ? '✓' : '-'}
                              </div>
                            </td>

                            <!-- 매출구분 -->
                            <td class="border-r border-gray-300 text-center" style="padding: 6px;">
                              <div class="text-gray-700" style="font-size: 0.65rem;">
                                {sale.SLGB_NAME || '-'}
                              </div>
                            </td>
                            
                            <!-- 납품처 -->
                            <td class="border-r border-gray-300 text-left" style="padding: 6px;">
                              <div class="text-gray-700" style="font-size: 0.65rem;">
                                {sale.BPCD_NAME || '-'}
                              </div>
                              <div class="text-xs text-gray-500" style="font-size: 0.55rem;">
                                {sale.SHOP_NAME || ''}
                              </div>
                            </td>
                            
                            <!-- 매출번호 -->
                            <td class="text-center" style="padding: 6px;">
                              <div class="text-blue-600 font-mono font-medium" style="font-size: 0.65rem;">
                                {sale.DNHD_SLIP}
                              </div>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {:else}
              <div class="text-center text-gray-600" style="padding: 30px 15px; font-size: 0.9rem;">
                조회 버튼을 클릭하여 매출을 조회하세요.
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 메인 콘텐츠 영역 (flex-1) -->
      <div class="flex-1 min-w-0 px-2">
        <!-- 반응형 레이아웃: 모바일/PC 모두 세로배치 -->
        <div class="flex flex-col gap-1">
          
          <!-- 카테고리 관리 섹션 (항상 위) -->
          <div class="w-full">
            <!-- 기본 정보 카드 -->
            <!-- 기본정보 패널 전체를 이것으로 교체 -->
            <div class="w-full max-md:mt-4">
              <div class="bg-white rounded-lg overflow-hidden mb-1" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- 클릭 가능한 헤더 -->
                <div 
                  class="border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200 user-select-none"
                  style="padding: 10px 20px;"
                  on:click={toggleBasicInfo}
                  on:keydown={handleBasicInfoKeydown}
                  tabindex="0"
                  role="button"
                  aria-expanded={basicInfoExpanded}
                  aria-label="기본정보 {basicInfoExpanded ? '접기' : '펼치기'}"
                >
                  <div class="flex items-center justify-between">
                    <!-- 왼쪽: 제목 + 매출번호 -->
                    <div class="flex items-center gap-4">
                      <h3 class="text-gray-800 m-0" style="font-size: 0.9rem;">기본정보</h3>
                      <div class="text-sm text-blue-600 font-medium">
                        {selectedSaleSlip || '-'}
                      </div>
                    </div>
                    
                    <!-- 오른쪽: 화살표 아이콘 -->
                    <div 
                      class="transform transition-transform duration-300 ease-in-out text-gray-500"
                      class:rotate-180={basicInfoExpanded}
                    >
                      <!-- SVG 화살표 아이콘 -->
                      <svg 
                        class="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          stroke-linecap="round" 
                          stroke-linejoin="round" 
                          stroke-width="2" 
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <!-- 애니메이션 콘텐츠 컨테이너 -->
                <div 
                  class="basic-info-content overflow-hidden transition-all duration-300 ease-in-out"
                  class:expanded={basicInfoExpanded}
                  class:collapsed={!basicInfoExpanded}
                >
                  <div style="padding: 20px;">
                    <!-- 매출일자 + 매출구분 (1줄) -->
                    <div class="flex gap-4 mb-4">
                      <div class="flex-1">
                        <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">매출일자</label>
                        <input 
                          type="date" 
                          bind:value={saleInfo.date}
                          class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500" 
                          style="padding: 5px 8px; font-size: 0.75rem;"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">매출구분</label>
                        <select 
                          bind:value={saleInfo.categoryCode}
                          class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                          style="padding: 5px 8px; font-size: 0.75rem;"
                        >
                          <option value="">선택하세요</option>
                          {#each saleCategoryList as category}
                            <option value={category.MINR_CODE}>{category.MINR_NAME}</option>
                          {/each}
                        </select>
                      </div>
                    </div>
                    
                    <!-- 매장, 납품처 (1줄) -->
                    <div class="flex gap-4 mb-4">
                      <div class="flex-1">
                        <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">매장</label>
                        <select 
                          bind:value={saleInfo.shopCode}
                          class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                          style="padding: 5px 8px; font-size: 0.75rem;"
                        >
                          <option value="">선택하세요</option>
                          {#each shopList as shop}
                            <option value={shop.SHOP_CODE}>{shop.SHOP_NAME}</option>
                          {/each}
                        </select>
                      </div>
                      
                      <div class="flex-1">
                        <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">납품처</label>
                        <select 
                          bind:value={saleInfo.customerCode}
                          class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                          style="padding: 5px 8px; font-size: 0.75rem;"
                        >
                          <option value="">선택하세요</option>
                          {#each customerList as customer}
                            <option value={customer.BPCD_CODE}>{customer.BPCD_NAME}</option>
                          {/each}
                        </select>
                      </div>
                    </div>
                    
                    <!-- 비고 -->
                    <div class="mb-4">
                      <label class="block mb-1 text-gray-600 font-medium" style="color: #555; font-weight: 500; font-size: 0.75rem;">비고내역</label>
                      <textarea 
                        bind:value={saleInfo.memo}
                        class="w-full border border-gray-300 rounded focus:outline-none focus:border-blue-500" 
                        rows="2" 
                        style="padding: 5px 8px; font-size: 0.75rem;"
                        placeholder="비고사항을 입력하세요"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 합계 정보 카드 (상세내역 위에) -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-1" style="padding: 6px;">
              <div class="grid grid-cols-3 gap-1 text-xs">
                <!-- 전체 합계 -->
                <div class="bg-white rounded border border-blue-100" style="padding: 2px; text-align: center;">
                  <div class="text-gray-600 font-medium" style="font-size: 0.65rem;">
                    전체 ({summaryData.totalQty.toLocaleString('ko-KR')}개)
                  </div>
                  <div class="font-bold text-blue-900" style="font-size: 0.65rem;">
                    {summaryData.totalAmount.toLocaleString('ko-KR')}원
                  </div>
                </div>
                
                <!-- 카드 합계 -->
                <div class="bg-white rounded border border-green-100" style="padding: 2px; text-align: center;">
                  <div class="text-gray-600 font-medium" style="font-size: 0.65rem;">
                    카드 ({summaryData.cardQty.toLocaleString('ko-KR')}개)
                  </div>
                  <div class="font-bold text-green-700" style="font-size: 0.65rem;">
                    {summaryData.cardAmount.toLocaleString('ko-KR')}원
                  </div>
                </div>
                
                <!-- 현금 합계 -->
                <div class="bg-white rounded border border-yellow-100" style="padding: 2px; text-align: center;">
                  <div class="text-gray-600 font-medium" style="font-size: 0.65rem;">
                    현금 ({summaryData.cashQty.toLocaleString('ko-KR')}개)
                  </div>
                  <div class="font-bold text-yellow-700" style="font-size: 0.65rem;">
                    {summaryData.cashAmount.toLocaleString('ko-KR')}원
                  </div>
                </div>
              </div>
            </div>

            <!-- 상세내역 -->
            <div class="bg-white rounded-lg overflow-hidden mb-1" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- 상세내역 헤더 부분 수정 (기존 헤더를 이것으로 교체) -->
              <div class="border-b border-gray-200 flex items-center justify-between" style="padding: 10px 10px;">
                <!-- 왼쪽: 제목 + 바코드 입력 + 전체 현금 체크박스 -->
                <div class="flex items-center gap-1">
                  <h3 class="text-gray-800 m-0" style="font-size: 0.9rem;">상세내역</h3>
                  <div class="flex items-center gap-1">
                    <!-- 바코드 입력 -->
                    <input 
                      type="text" 
                      bind:this={barcodeInput}
                      bind:value={barcodeValue}
                      on:keydown={handleBarcodeKeydown}
                      class="border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      style="padding: 4px 8px; font-size: 0.75rem; width: 150px; text-transform: uppercase; ime-mode: disabled;"
                      placeholder="바코드 스캔..."
                      inputmode="latin"
                      autocomplete="off"
                      lang="en"
                    />
                    
                    <!-- 전체 현금 체크박스 -->
                    <label class="flex items-center gap-1 cursor-pointer text-xs text-gray-700 font-medium">
                      <input 
                        type="checkbox" 
                        checked={allCashChecked}
                        on:change={handleAllCashChange}
                        class="w-3.5 h-3.5"
                      />
                      <span>현금</span>
                    </label>
                  </div>
                </div>
                
                <!-- 오른쪽: 검색 버튼 + 현금할인 버튼 -->
                <div class="flex gap-2">
                  <!-- 검색 버튼 추가 -->
                  <button 
                    type="button"
                    on:click={() => showProductPopup = true}
                    class="px-3 py-1.5 text-xs rounded transition-colors duration-200 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    검색
                  </button>
                  
                  <button 
                    type="button"
                    on:click={applyCashDiscount}
                    class="px-3 py-1.5 text-xs rounded transition-colors duration-200 bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                    disabled={detailItems.filter(item => item.isCash).length === 0}
                    title="현금 체크된 항목들에 5% 할인 적용"
                  >
                    현금할인
                  </button>
                </div>
              </div>
              
              <div style="padding: 10px;">
                {#if detailItems.length > 0}
                  <div class="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-1.5">
                    <!-- 상세내역 항목 부분 수정 (각 항목의 div 클래스를 조건부로 변경) -->
                    <!-- 기존: <div class="border border-gray-200 rounded-lg p-4 relative"> -->
                    <!-- 수정: 아래와 같이 조건부 클래스 적용 -->

                    {#each detailItems as item, index}
                      <div class="rounded-lg p-1 relative transition-colors duration-200 {item.isCash ? 'border border-pink-200 bg-pink-50' : 'border border-gray-200 bg-white'}" 
                          style="transition: all 0.2s ease;">
                        <!-- 삭제 버튼 (오른쪽 상단) -->
                        <button 
                          type="button"
                          class="absolute top-2 right-2 px-2 py-1 flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-bold transition-colors z-10"
                          on:click={() => removeDetailItem(index)}
                          title="항목 삭제"
                        >
                          삭제
                        </button>
                        
                        <!-- 상단: 이미지 + 제품정보 -->
                        <div class="flex gap-3 mb-3">
                          <div class="relative w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            <!-- 이미지 (다른 메뉴와 동일한 방식) -->
                            <img 
                              src={getProxyImageUrl(item.itemCode)} 
                              alt={item.itemName}
                              class="w-full h-full object-cover cursor-pointer"
                              style="background: #f8f9fa;"
                              on:click={() => handleImageClick(item.itemCode, item.itemName)}
                              on:error={cacheImage}
                              on:load={cacheImage}
                            />
                            
                            <!-- 온라인 배지 (왼쪽 위) -->
                            {#if item.isOnline}
                              <span class="absolute top-0.5 left-0.5 bg-blue-100 text-blue-800 border border-blue-200 text-xs rounded-full px-1.5 py-0.5 font-medium shadow-sm" 
                              style="font-size: 0.6rem; line-height: 1;">
                                On
                              </span>
                            {/if}
                            
                            <!-- 재고 배지 (오른쪽 위) -->
                            {#if item.stockManaged}
                              <span class="absolute top-0.5 right-0.5 {item.currentStock === 0 ? 'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-1 py-0.5 rounded-lg text-xs font-bold min-w-6 text-center" style="font-size: 10px;">
                                {item.currentStock || 0}
                              </span>
                            {/if}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="text-xs text-gray-600 mb-1">{item.itemCode}</div>
                            <div class="text-xs font-medium mb-1">{item.itemName}</div>
                            
                            <!-- 비고내역 한줄로 -->
                            <!-- 부드러운 애니메이션 포함 -->
                            {#if item.itemDescription && item.itemDescription.trim()}
                              <div class="text-xs text-gray-600 mb-1 bg-gray-50 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 transition-all duration-200"
                                  on:click={() => toggleItemDescription(index)}>
                                
                                <!-- 플렉스 컨테이너로 내용과 화살표 배치 -->
                                <div class="flex items-start justify-between gap-2">
                                  <!-- 왼쪽: 비고 내용 -->
                                  <div class="overflow-hidden transition-all duration-300 {item.descriptionExpanded ? 'max-h-40' : 'max-h-5'} flex-1">
                                    <div class="text-gray-600 {item.descriptionExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}">
                                      {item.itemDescription}
                                    </div>
                                  </div>
                                  
                                  <!-- 오른쪽: 화살표 아이콘 -->
                                  <svg 
                                    class="w-3 h-3 text-gray-400 transform transition-transform duration-200 flex-shrink-0 mt-0.5 {item.descriptionExpanded ? 'rotate-180' : ''}"
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            {/if}

                            <!-- 가격정보 각각 한줄로 -->
                            <div class="flex gap-0.5 text-xs">
                              <span class="text-gray-500 px-1 py-1 rounded">카드: {item.cardPrice.toLocaleString('ko-KR')}</span>
                              <span class="text-gray-500 px-1 py-1 rounded">현금: {item.cashPrice.toLocaleString('ko-KR')}</span>
                              <span class="text-gray-500 px-1 py-1 rounded">납품: {item.deliveryPrice.toLocaleString('ko-KR')}</span>
                            </div>
                          </div>
                        </div>
                        
                        <!-- 하단: 현금, 수량, 금액 한줄로 (크기 조정) -->
                        <div class="border-t border-gray-100 pt-3">
                          <div class="flex items-center gap-1 text-xs">
                            <!-- 현금 체크박스 -->
                            <label class="flex items-center gap-0.5 cursor-pointer flex-shrink-0">
                              <input 
                                type="checkbox" 
                                bind:checked={item.isCash}
                                on:change={() => handlePaymentTypeChange(index)}
                                class="w-3 h-3"
                              />
                              <span>현금</span>
                            </label>
                            
                            <!-- 수량 (+/- 버튼 포함) -->
                            <div class="flex items-center gap-0.5 flex-shrink-0 mx-1">
                              <span class="text-gray-600">수량</span>
                              <div class="flex items-center border border-gray-300 rounded">
                                <button 
                                  type="button"
                                  class="w-5 h-5 flex items-center justify-center text-gray-600 bg-gray-200 hover:bg-gray-300 text-xs"
                                  on:click={() => {
                                    if (item.quantity > 1) {
                                      item.quantity--;
                                      handleQuantityChange(index);
                                    }
                                  }}
                                >-</button>
                                <input 
                                  type="number" 
                                  bind:value={item.quantity}
                                  on:input={() => handleQuantityChange(index)}
                                  class="w-8 text-center border-0 text-xs"
                                  style="padding: 1px;"
                                  min="1"
                                />
                                <button 
                                  type="button"
                                  class="w-5 h-5 flex items-center justify-center text-gray-600 bg-gray-200 hover:bg-gray-300 text-xs"
                                  on:click={() => {
                                    item.quantity++;
                                    handleQuantityChange(index);
                                  }}
                                >+</button>
                              </div>
                            </div>
                            
                            <!-- 금액 -->
                            <div class="flex items-center gap-0.5 flex-1 min-w-0">
                              <span class="text-gray-600 flex-shrink-0">금액</span>
                              <input 
                                type="text" 
                                value={item.amount.toLocaleString('ko-KR')}
                                on:input={(e) => {
                                  const value = e.target.value.replace(/,/g, '');
                                  if (!isNaN(value) && value !== '') {
                                    item.amount = parseInt(value);
                                    handleAmountChange(index);
                                  }
                                }}
                                class="border border-gray-300 rounded text-xs text-right"
                                style="padding: 1px 2px; width: 80px;"
                              />
                            </div>

                            <!-- 순번 (맨 오른쪽) -->
                            <div class="flex items-center justify-center bg-gray-500 text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0 ml-2">
                              {index + 1}
                            </div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="text-center text-gray-500 py-8">
                    매출을 선택하면 상세내역이 표시됩니다.
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 제품 조회 팝업 -->
<ProductSearchPopup 
  bind:visible={showProductPopup}
  currentCompanyCode={selectedCompany}
  currentRegistrationCode={selectedRegistration}
  on:productSelected={handleProductSelected}
  on:close={() => showProductPopup = false}
/>

<!-- 이미지 모달 -->
<ImageModalStock 
  on:stockUpdated={handleStockUpdated}
  on:discontinuedUpdated={handleDiscontinuedUpdated}
/>


<style>
  /* 사이드 메뉴 스크롤 제어 */
  .panel-scroll-container {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  /* 모바일에서 바운스 효과 방지 */
  .no-bounce {
    overscroll-behavior-y: contain;
  }

  /* number input 스피너 제거 */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }

  /* 기본정보 아코디언 애니메이션 */
  .basic-info-content {
    transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
  }
  
  .basic-info-content.collapsed {
    max-height: 0;
    opacity: 0;
  }
  
  .basic-info-content.expanded {
    max-height: 400px; /* 콘텐츠 높이에 맞게 조정 */
    opacity: 1;
  }
  
  /* 텍스트 선택 방지 (헤더 클릭 시) */
  .user-select-none {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  /* 화살표 아이콘 회전 애니메이션 */
  .rotate-180 {
    transform: rotate(180deg);
  }
  
  /* 헤더 포커스 스타일 (키보드 접근성) */
  .basic-info-content:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
  
  /* 헤더 호버 효과 강화 */
  .cursor-pointer:hover h3 {
    color: #374151;
  }
  
  .cursor-pointer:hover svg {
    color: #6b7280;
  }

</style>