<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { simpleCache } from '$lib/utils/simpleImageCache.js';
  
  export let data;
  
  // 프리마켓 데이터 상태
  let saleItems = [];
  let selectedDate = new Date().toISOString().split('T')[0];
  let showSidebar = false;
  let showSijeModal = false;
  let sijeAmount = '';
  let loading = false;
  let salesList = [];
  
  // 상품 선택 상태
  let showProductSelector = false;
  let categories = [];
  let selectedCategory = 'ALL';
  let products = [];
  
  // 검색 상태
  let showSearchModal = false;
  let searchTerm = '';
  let searchType = 'name';
  let productFilter = 'flea';
  let discontinuedFilter = 'normal';
  let searchResults = [];
  
  // 바코드 스캔 상태
  let showBarcodeScanner = false;
  let isScanning = false;
  let isPaused = false;
  let scannerStatus = 'QuaggaJS 스캔 준비 완료';
  let flashEnabled = false;
  
  let itemCounter = 0;
  
  onMount(() => {
    if (browser) {
      // QuaggaJS 및 기타 스크립트 로드
      loadExternalScripts();
      
      // IndexedDB 이미지 캐시 초기화
      simpleCache.init();
      
      // 초기 데이터 로드
      loadInitialData();
      loadSijeAmount();
    }
  });
  
  async function loadExternalScripts() {
    // QuaggaJS 로드
    if (!window.Quagga) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
      script.onload = () => {
        console.log('QuaggaJS 로드 완료');
      };
      document.head.appendChild(script);
    }
  }
  
  async function loadInitialData() {
    try {
      loading = true;
      await loadCategories();
      await loadProducts();
    } catch (error) {
      console.error('초기 데이터 로드 오류:', error);
    } finally {
      loading = false;
    }
  }
  
  async function loadCategories() {
    try {
      const response = await fetch('/api/sales/flea-market?action=get_flea_categories');
      const result = await response.json();
      if (result.success) {
        categories = [{ code: 'ALL', name: '전체' }, ...result.data];
      }
    } catch (error) {
      console.error('카테고리 로드 오류:', error);
    }
  }
  
  async function loadProducts() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_flea_products&category=${selectedCategory}`);
      const result = await response.json();
      if (result.success) {
        products = result.data;
        
        // 이미지가 있는 상품들에 대해 IndexedDB 캐시 적용
        setTimeout(() => {
          products.forEach(product => {
            const img = document.querySelector(`img[data-product-code="${product.code}"]`);
            if (img) {
              simpleCache.handleImage(img);
            }
          });
        }, 100);
      }
    } catch (error) {
      console.error('상품 로드 오류:', error);
    }
  }
  
  async function loadSijeAmount() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_sije_amt3&date=${selectedDate.replace(/-/g, '')}`);
      const result = await response.json();
      if (result.success) {
        // 시제 금액 표시 (필요시)
      }
    } catch (error) {
      console.error('시제 조회 오류:', error);
    }
  }
  
  async function loadSalesList() {
    if (!selectedDate) {
      alert('조회할 날짜를 선택해주세요.');
      return;
    }
    
    try {
      loading = true;
      const startDate = selectedDate.replace(/-/g, '');
      const endDate = selectedDate.replace(/-/g, '');
      
      const response = await fetch(`/api/sales/flea-market?action=get_sales_list&startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();
      
      if (result.success) {
        salesList = result.data;
      } else {
        alert('매출 조회 오류: ' + result.error);
      }
    } catch (error) {
      console.error('매출 목록 조회 오류:', error);
      alert('매출 조회 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  async function searchProducts() {
    if (!searchTerm.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }
    
    try {
      loading = true;
      const response = await fetch(`/api/sales/flea-market?action=search_products&searchTerm=${encodeURIComponent(searchTerm)}&searchType=${searchType}&productFilter=${productFilter}&discontinuedFilter=${discontinuedFilter}`);
      const result = await response.json();
      
      if (result.success) {
        searchResults = result.data;
      } else {
        alert('검색 오류: ' + result.error);
      }
    } catch (error) {
      console.error('상품 검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  // 바코드 스캔 관련 함수들
  async function startScanning() {
    if (!window.Quagga) {
      alert('바코드 스캐너가 로드되지 않았습니다.');
      return;
    }
    
    try {
      showBarcodeScanner = true;
      updateScannerStatus('카메라를 시작하는 중...');
      
      const config = {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#reader'),
          constraints: {
            width: { ideal: 1920, min: 1280, max: 1920 },
            height: { ideal: 1080, min: 720, max: 1080 },
            facingMode: "environment",
            frameRate: { ideal: 30, min: 20 },
            aspectRatio: { ideal: 1.77 }
          },
          area: { top: "20%", right: "10%", left: "10%", bottom: "20%" }
        },
        locator: {
          patchSize: "large",
          halfSample: false,
          willReadFrequently: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        frequency: 20,
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader", 
            "code_39_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader",
            "i2of5_reader",
            "2of5_reader",
            "code_93_reader"
          ],
          debug: {
            drawBoundingBox: true,
            showFrequency: false,
            drawScanline: true,
            drawPatches: false
          },
          multiple: false
        },
        locate: true
      };
      
      window.Quagga.init(config, (err) => {
        if (err) {
          console.error('QuaggaJS 초기화 실패:', err);
          handleScanError(err);
          return;
        }
        
        console.log('QuaggaJS 초기화 성공');
        
        window.Quagga.onDetected((result) => {
          const code = result.codeResult.code;
          const format = result.codeResult.format;
          onScanSuccess(code, format);
        });
        
        window.Quagga.start();
        
        isScanning = true;
        updateScannerStatus('QuaggaJS로 바코드 스캔 중...');
      });
      
    } catch (error) {
      console.error('스캔 시작 실패:', error);
      handleScanError(error);
    }
  }
  
  function stopScanning() {
    try {
      if (isScanning && window.Quagga) {
        window.Quagga.stop();
        window.Quagga.offDetected();
        window.Quagga.offProcessed();
      }
      
      isScanning = false;
      isPaused = false;
      showBarcodeScanner = false;
      flashEnabled = false;
      updateScannerStatus('스캔을 시작하려면 "시작" 버튼을 눌러주세요');
      
    } catch (error) {
      console.error('스캔 중지 실패:', error);
    }
  }
  
  async function onScanSuccess(barcodeData, format = 'BARCODE') {
    if (isPaused) return;
    
    isPaused = true;
    updateScannerStatus(`${format} 스캔 중... 제품 정보 조회 중`);
    
    try {
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_product_info',
          barcode: barcodeData
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        addSaleItem(result.data);
        updateScannerStatus('제품이 추가되었습니다! (1초 후 다시 스캔 가능)');
        provideFeedback('success');
      } else {
        updateScannerStatus(result.message || '제품을 찾을 수 없습니다 (1초 후 다시 스캔 가능)');
        provideFeedback('error');
      }
    } catch (error) {
      updateScannerStatus('제품 정보 조회 실패 (1초 후 다시 스캔 가능)');
      provideFeedback('error');
    }
    
    setTimeout(() => {
      isPaused = false;
      if (isScanning) {
        updateScannerStatus('QuaggaJS로 바코드 스캔 중...');
      }
    }, 1000);
  }
  
  function addSaleItem(productData) {
    const existingItem = saleItems.find(item => item.code === productData.code);
    if (existingItem) {
      existingItem.quantity += 1;
      provideFeedback('quantity');
      return;
    }
    
    const itemId = ++itemCounter;
    const saleItem = {
      id: itemId,
      code: productData.code,
      name: productData.name,
      price: productData.price,
      cost: productData.cost,
      imageUrl: productData.image_url,
      quantity: 1,
      unitPrice: productData.price,
      totalAmount: productData.price,
      isCash: true
    };
    
    saleItems = [saleItem, ...saleItems];
  }
  
  function provideFeedback(type) {
    // 햅틱 피드백
    if ('vibrate' in navigator) {
      switch (type) {
        case 'success':
          navigator.vibrate(200);
          break;
        case 'error':
          navigator.vibrate([100, 50, 100, 50, 100]);
          break;
        case 'quantity':
          navigator.vibrate(100);
          break;
        case 'save':
          navigator.vibrate(300);
          break;
        default:
          navigator.vibrate(200);
      }
    }
    
    // 소리 피드백 (가능한 경우)
    if (type === 'success') {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUZrTp66hVFApGn+DyvmGCBj2Z3PLEcyYEK4TO8tiJOQcZZ7zp46FQFM=');
        audio.play();
      } catch (e) {}
    }
  }
  
  function handleScanError(error) {
    isScanning = false;
    isPaused = false;
    
    let message = '';
    if (error.name === 'NotAllowedError' || error.code === 'PERMISSION_DENIED') {
      message = '카메라 권한을 허용해주세요!';
    } else if (error.name === 'NotFoundError' || error.code === 'NOT_FOUND_ERR') {
      message = '카메라를 찾을 수 없습니다';
    } else {
      message = 'QuaggaJS 시작 실패. 새로고침 후 재시도하세요';
    }
    
    updateScannerStatus(message);
  }
  
  function updateScannerStatus(message) {
    scannerStatus = message;
  }
  
  function toggleFlash() {
    if (!isScanning) return;
    
    try {
      const track = window.Quagga.CameraAccess.getActiveTrack();
      if (track && 'torch' in track.getCapabilities()) {
        flashEnabled = !flashEnabled;
        track.applyConstraints({
          advanced: [{ torch: flashEnabled }]
        });
      } else {
        alert('이 기기에서는 손전등을 지원하지 않습니다');
      }
    } catch (error) {
      alert('손전등 제어에 실패했습니다');
    }
  }
  
  function toggleSidebar() {
    showSidebar = !showSidebar;
  }
  
  function closeSidebar() {
    showSidebar = false;
  }
  
  function toggleProductSelector() {
    showProductSelector = !showProductSelector;
  }
  
  function openSijeModal() {
    showSijeModal = true;
  }
  
  function closeSijeModal() {
    showSijeModal = false;
    sijeAmount = '';
  }
  
  function openSearchModal() {
    showSearchModal = true;
  }
  
  function closeSearchModal() {
    showSearchModal = false;
    searchTerm = '';
    searchResults = [];
  }
  
  function selectProduct(product) {
    const existingItem = saleItems.find(item => item.code === product.code);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      saleItems = [...saleItems, {
        id: Date.now(),
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: 1,
        isCash: true,
        imageUrl: product.image_url
      }];
    }
    
    toggleProductSelector();
  }
  
  function selectSearchResult(product) {
    selectProduct(product);
    closeSearchModal();
  }
  
  function removeItem(itemId) {
    saleItems = saleItems.filter(item => item.id !== itemId);
  }
  
  function updateQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    
    saleItems = saleItems.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    );
  }
  
  function togglePaymentType(itemId) {
    saleItems = saleItems.map(item => 
      item.id === itemId ? { ...item, isCash: !item.isCash } : item
    );
  }
  
  async function saveSale() {
    if (saleItems.length === 0) {
      alert('매출 항목을 추가해주세요.');
      return;
    }
    
    try {
      loading = true;
      
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_sales',
          date: selectedDate.replace(/-/g, ''),
          items: saleItems.map(item => ({
            code: item.code,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            isCash: item.isCash
          }))
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('매출이 저장되었습니다.');
        saleItems = [];
        loadSijeAmount();
        provideFeedback('save');
      } else {
        alert('저장 오류: ' + result.error);
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  async function registerSije() {
    if (!sijeAmount || sijeAmount <= 0) {
      alert('시제 금액을 입력해주세요.');
      return;
    }
    
    try {
      loading = true;
      
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_sije',
          date: selectedDate.replace(/-/g, ''),
          sijeAmount: parseInt(sijeAmount)
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('시제가 등록되었습니다.');
        closeSijeModal();
        loadSijeAmount();
      } else {
        alert('등록 오류: ' + result.error);
      }
    } catch (error) {
      console.error('시제 등록 오류:', error);
      alert('시제 등록 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  async function deleteSale(slipNo) {
    if (!confirm('이 매출을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      loading = true;
      
      const response = await fetch(`/api/sales/flea-market?sSlip=${slipNo}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        alert('매출이 삭제되었습니다.');
        loadSalesList();
        loadSijeAmount();
      } else {
        alert('삭제 오류: ' + result.error);
      }
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  }
  
  $: totalAmount = saleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
</script>

<svelte:head>
  <title>프리마켓 매출 등록</title>
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-touch-fullscreen" content="yes">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
</svelte:head>

<div class="ui-page">
  <!-- 사이드바 메뉴 -->
  <div class="sidebar" class:active={showSidebar}>
    <div class="sidebar-header">
      <h3>매출 목록</h3>
      <button class="close-sidebar" on:click={closeSidebar}>×</button>
    </div>
    
    <div class="sidebar-content">
      <div class="date-filter">
        <label>조회 날짜:</label>
        <input type="date" bind:value={selectedDate}>
        <button class="search-btn" on:click={loadSalesList}>조회</button>
      </div>
      
      <div class="sales-list">
        {#if salesList.length === 0}
          <div class="no-data">날짜를 선택하고 조회 버튼을 눌러주세요</div>
        {:else}
          {#each salesList as sale}
            <div class="sale-item">
              <div class="sale-info">
                <div class="sale-slip">{sale.slipNo}</div>
                <div class="sale-amount">{formatCurrency(sale.amount)}</div>
                <div class="sale-time">{sale.regTime}</div>
              </div>
              <button class="delete-btn" on:click={() => deleteSale(sale.slipNo)}>삭제</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  
  <!-- 사이드바 오버레이 -->
  {#if showSidebar}
    <div class="sidebar-overlay" on:click={closeSidebar}></div>
  {/if}
  
  <!-- 헤더 -->
  <div class="ui-header">
    <a href="/admin" class="ui-btn-left">🏠</a>
    <button class="toggle-btn" on:click={toggleSidebar}>››</button>
    <div class="header-title-group">
      <h1>매출 등록 (FLEA)</h1>
      <span class="sije-amount-display">{formatCurrency(totalAmount)}</span>
    </div>
    <button class="ui-btn-right" on:click={openSijeModal}>시제등록</button>
  </div>
  
  <!-- 상품 선택 토글 버튼 -->
  <button 
    class="product-toggle-btn" 
    class:collapsed={!showProductSelector}
    on:click={toggleProductSelector}
  >
    <span class="toggle-arrow">{showProductSelector ? '▼' : '▲'}</span>
  </button>
  
  <!-- 상품 선택 오버레이 -->
  {#if showProductSelector}
    <div class="product-selector-overlay" on:click={toggleProductSelector}></div>
  {/if}
  
  <!-- 상품 선택 섹션 -->
  <div class="product-selector-section" class:active={showProductSelector}>
    <div class="selector-header">
      <div class="selector-title">
        <h3>📦 상품 선택</h3>
      </div>
      <button class="close-selector-btn" on:click={toggleProductSelector}>×</button>
    </div>
    
    <!-- 카테고리 탭 -->
    <div class="category-tabs-container">
      <div class="category-tabs">
        {#each categories as category}
          <div 
            class="category-tab"
            class:active={selectedCategory === category.code}
            on:click={() => { selectedCategory = category.code; loadProducts(); }}
          >
            {category.name}
          </div>
        {/each}
      </div>
    </div>
    
    <!-- 상품 그리드 -->
    <div class="product-grid">
      {#each products as product}
        <div class="product-item" on:click={() => selectProduct(product)}>
          <img 
            src={product.image_url} 
            alt={product.name}
            data-product-code={product.code}
            class="product-image"
            loading="lazy"
          >
          <div class="product-info">
            <div class="product-name">{product.name}</div>
            <div class="product-price">{formatCurrency(product.price)}</div>
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- 메인 컨텐츠 -->
  <div class="ui-content">
    <!-- 바코드 스캔 섹션 -->
    <div class="barcode-scanner-section" class:active={showBarcodeScanner}>
      <div class="scanner-container">
        <div id="reader"></div>
        <div class="scan-overlay"></div>
      </div>
      
      <div class="scanner-status">
        <div class="scanner-status-text">{scannerStatus}</div>
        <div class="scanner-controls-mini">
          {#if !isScanning}
            <button class="scanner-btn-mini start" on:click={startScanning}>시작</button>
          {:else}
            <button class="scanner-btn-mini stop" on:click={stopScanning}>중지</button>
            <button class="scanner-btn-mini flash" on:click={toggleFlash}>
              {flashEnabled ? '끄기' : '손전등'}
            </button>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- 매출 항목 섹션 -->
    <div class="sale-items-section">
      <h3 class="sales-header-mini">
        <span class="sales-title-text">🛍️ 매출 항목</span>
        <div class="sales-actions-mini">
          <button class="action-btn-mini search" on:click={openSearchModal}>🔍 검색</button>
          <button class="action-btn-mini save" on:click={saveSale} disabled={loading}>💾 저장</button>
        </div>
      </h3>
      
      <div class="sale-items-list">
        {#if saleItems.length === 0}
          <div class="empty-list">
            바코드를 스캔하거나 상품을 선택하여 제품을 추가하세요
          </div>
        {:else}
          {#each saleItems as item (item.id)}
            <div class="sale-item-row" class:cash-item={item.isCash} class:card-item={!item.isCash}>
              <img src={item.imageUrl} alt={item.name} class="item-image" loading="lazy">
              
              <div class="item-info">
                <div class="item-name">{item.name}</div>
                <div class="item-code">{item.code}</div>
                <div class="item-price">{formatCurrency(item.price)}</div>
              </div>
              
              <div class="item-controls">
                <button class="qty-btn minus" on:click={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                <span class="qty-display">{item.quantity}</span>
                <button class="qty-btn plus" on:click={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
              
              <div class="payment-controls">
                <button 
                  class="payment-btn"
                  class:cash={item.isCash}
                  class:card={!item.isCash}
                  on:click={() => togglePaymentType(item.id)}
                >
                  {item.isCash ? '현금' : '카드'}
                </button>
                <div class="item-total">{formatCurrency(item.price * item.quantity)}</div>
              </div>
              
              <button class="remove-btn" on:click={() => removeItem(item.id)}>×</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  
  <!-- 검색 모달 -->
  {#if showSearchModal}
    <div class="modal-overlay" on:click={closeSearchModal}>
      <div class="modal-content search-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h3>상품 검색</h3>
          <button class="modal-close-btn" on:click={closeSearchModal}>×</button>
        </div>
        <div class="modal-body">
          <div class="search-filters">
            <div class="filter-row">
              <select bind:value={searchType}>
                <option value="name">제품명</option>
                <option value="code">제품코드</option>
              </select>
              
              <select bind:value={productFilter}>
                <option value="all">전체</option>
                <option value="flea">프리마켓만</option>
                <option value="normal">일반상품만</option>
              </select>
              
              <select bind:value={discontinuedFilter}>
                <option value="normal">정상품목</option>
                <option value="all">전체</option>
                <option value="discontinued">단종품목</option>
              </select>
            </div>
          </div>
          
          <div class="search-input-group">
            <input 
              type="text" 
              bind:value={searchTerm}
              placeholder="검색어를 입력하세요"
              on:keydown={(e) => e.key === 'Enter' && searchProducts()}
            >
            <button class="search-btn" on:click={searchProducts} disabled={loading}>검색</button>
          </div>
          
          <div class="search-results">
            {#each searchResults as product}
              <div class="search-result-item" on:click={() => selectSearchResult(product)}>
                <img src={product.image_url} alt={product.name} class="result-image" loading="lazy">
                <div class="result-info">
                  <div class="result-name">{product.name}</div>
                  <div class="result-code">{product.code}</div>
                  <div class="result-price">{formatCurrency(product.price)}</div>
                </div>
                <div class="result-badges">
                  {#if product.is_flea}
                    <span class="badge flea">프리마켓</span>
                  {/if}
                  {#if product.discontinued === '1'}
                    <span class="badge discontinued">단종</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 시제 등록 모달 -->
  {#if showSijeModal}
    <div class="modal-overlay" on:click={closeSijeModal}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h3>시제 등록</h3>
          <button class="modal-close-btn" on:click={closeSijeModal}>×</button>
        </div>
        <div class="modal-body">
          <div class="sije-input-group">
            <label>시제 금액</label>
            <input 
              type="number" 
              bind:value={sijeAmount}
              placeholder="금액을 입력하세요"
            >
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" on:click={closeSijeModal}>취소</button>
          <button class="confirm-btn" on:click={registerSije} disabled={loading}>등록</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Safe Area 대응 */
  .ui-page {
    position: relative;
    min-height: 100vh;
    padding-top: env(safe-area-inset-top, 60px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background-color: #f5f5f5;
    font-family: 'Malgun Gothic', Arial, sans-serif;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  /* 헤더 - Safe Area 대응 */
  .ui-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: calc(60px + env(safe-area-inset-top, 0px));
    padding-top: env(safe-area-inset-top, 0px);
    background: linear-gradient(135deg, #2a69ac 0%, #4a90e2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: max(1rem, env(safe-area-inset-left, 1rem));
    padding-right: max(1rem, env(safe-area-inset-right, 1rem));
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  
  .ui-btn-left, .ui-btn-right {
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    text-decoration: none;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.3s ease;
    min-width: 50px;
    text-align: center;
  }
  
  .toggle-btn {
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    margin-right: 1rem;
  }
  
  .header-title-group {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .header-title-group h1 {
    font-size: 1.2rem;
    font-weight: bold;
    margin: 0;
  }
  
  .sije-amount-display {
    font-size: 0.9rem;
    font-weight: bold;
    color: #ffeb3b;
    margin-top: 0.2rem;
  }
  
  /* 사이드바 */
  .sidebar {
    position: fixed;
    left: -100%;
    top: 0;
    width: 80%;
    max-width: 300px;
    height: 100vh;
    background: white;
    z-index: 1001;
    transition: left 0.3s ease;
    box-shadow: 2px 0 10px rgba(0,0,0,0.1);
    overflow-y: auto;
    padding-top: env(safe-area-inset-top, 0px);
  }
  
  .sidebar.active {
    left: 0;
  }
  
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
  }
  
  .sidebar-header {
    background: #2a69ac;
    color: white;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .close-sidebar {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
  }
  
  .sidebar-content {
    padding: 1rem;
  }
  
  .date-filter label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }
  
  .date-filter input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  
  .search-btn {
    width: 100%;
    background: #4CAF50;
    color: white;
    border: none;
    padding: 0.7rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  
  /* 상품 선택 토글 버튼 */
  .product-toggle-btn {
    position: fixed;
    top: calc(60px + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    background: #2a69ac;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0 0 20px 20px;
    cursor: pointer;
    z-index: 999;
    transition: all 0.3s ease;
  }
  
  .product-selector-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 998;
  }
  
  .product-selector-section {
    position: fixed;
    top: calc(110px + env(safe-area-inset-top, 0px));
    left: 0;
    right: 0;
    height: 60%;
    background: white;
    z-index: 999;
    transform: translateY(-100%);
    transition: transform 0.3s ease;
    border-radius: 20px 20px 0 0;
    overflow: hidden;
  }
  
  .product-selector-section.active {
    transform: translateY(0);
  }
  
  .selector-header {
    background: #f8f9fa;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e9ecef;
  }
  
  .close-selector-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #666;
    cursor: pointer;
  }
  
  .category-tabs {
    display: flex;
    overflow-x: auto;
    padding: 0 1rem;
  }
  
  .category-tab {
    padding: 0.7rem 1rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    font-size: 0.9rem;
    color: #666;
    transition: all 0.3s ease;
  }
  
  .category-tab.active {
    color: #2a69ac;
    border-bottom-color: #2a69ac;
    font-weight: bold;
  }
  
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.8rem;
    padding: 1rem;
    height: calc(100% - 140px);
    overflow-y: auto;
  }
  
  .product-item {
    background: white;
    border-radius: 8px;
    padding: 0.8rem;
    cursor: pointer;
    transition: transform 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    text-align: center;
  }
  
  .product-item:hover {
    transform: translateY(-2px);
  }
  
  .product-image {
    width: 100%;
    height: 80px;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  
  .product-name {
    font-size: 0.8rem;
    font-weight: bold;
    margin-bottom: 0.3rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .product-price {
    color: #2a69ac;
    font-weight: bold;
    font-size: 0.8rem;
  }
  
  /* 메인 컨텐츠 */
  .ui-content {
    padding: 1rem;
    margin-top: 50px;
  }
  
  /* 바코드 스캐너 */
  .barcode-scanner-section {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .barcode-scanner-section.active .scanner-container {
    display: block;
  }
  
  .scanner-container {
    position: relative;
    display: none;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 1rem;
  }
  
  #reader {
    width: 100%;
    height: 300px;
  }
  
  .scan-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 100px;
    border: 2px solid #00ff00;
    border-radius: 8px;
    pointer-events: none;
  }
  
  .scanner-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
  }
  
  .scanner-status-text {
    flex: 1;
    font-size: 0.9rem;
    color: #333;
  }
  
  .scanner-controls-mini {
    display: flex;
    gap: 0.5rem;
  }
  
  .scanner-btn-mini {
    background: #2a69ac;
    color: white;
    border: none;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }
  
  .scanner-btn-mini.stop {
    background: #f44336;
  }
  
  .scanner-btn-mini.flash {
    background: #ff9800;
  }
  
  /* 매출 항목 */
  .sale-items-section {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .sales-header-mini {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    margin: 0;
    font-size: 1rem;
    font-weight: bold;
    color: #2a69ac;
  }
  
  .sales-actions-mini {
    display: flex;
    gap: 0.3rem;
  }
  
  .action-btn-mini {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  
  .action-btn-mini:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .sale-items-list {
    padding: 1rem;
  }
  
  .sale-item-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-left: 4px solid transparent;
  }
  
  .sale-item-row.cash-item {
    background: #e8f5e8;
    border-left-color: #4CAF50;
  }
  
  .sale-item-row.card-item {
    background: #e3f2fd;
    border-left-color: #2196F3;
  }
  
  .item-image {
    width: 50px;
    height: 50px;
    border-radius: 4px;
    object-fit: cover;
  }
  
  .item-info {
    flex: 1;
  }
  
  .item-name {
    font-weight: bold;
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }
  
  .item-code {
    color: #666;
    font-size: 0.8rem;
    margin-bottom: 0.2rem;
  }
  
  .item-price {
    color: #999;
    font-size: 0.8rem;
  }
  
  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .qty-btn {
    width: 30px;
    height: 30px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
  }
  
  .qty-btn.minus {
    background: #ffebee;
    color: #d32f2f;
  }
  
  .qty-btn.plus {
    background: #e8f5e8;
    color: #4CAF50;
  }
  
  .qty-display {
    min-width: 30px;
    text-align: center;
    font-weight: bold;
    font-size: 1.1rem;
  }
  
  .payment-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }
  
  .payment-btn {
    padding: 0.3rem 0.6rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
    transition: background-color 0.3s ease;
    min-width: 50px;
  }
  
  .payment-btn.cash {
    background: #4CAF50;
    color: white;
  }
  
  .payment-btn.card {
    background: #2196F3;
    color: white;
  }
  
  .item-total {
    font-weight: bold;
    color: #2a69ac;
    font-size: 0.9rem;
    text-align: center;
  }
  
  .remove-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 50%;
    background: #f44336;
    color: white;
    cursor: pointer;
    font-size: 1.2rem;
  }
  
  .empty-list {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
  }
  
  /* 검색 모달 */
  .search-modal {
    max-width: 600px;
    width: 95%;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .search-filters {
    margin-bottom: 1rem;
  }
  
  .filter-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .filter-row select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  
  .search-input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .search-input-group input {
    flex: 1;
    padding: 0.7rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .search-results {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .search-result-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .search-result-item:hover {
    background: #f8f9fa;
  }
  
  .result-image {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }
  
  .result-info {
    flex: 1;
  }
  
  .result-name {
    font-weight: bold;
    margin-bottom: 0.2rem;
  }
  
  .result-code {
    color: #666;
    font-size: 0.8rem;
  }
  
  .result-price {
    color: #2a69ac;
    font-weight: bold;
    font-size: 0.9rem;
  }
  
  .result-badges {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  
  .badge {
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    text-align: center;
  }
  
  .badge.flea {
    background: #4CAF50;
    color: white;
  }
  
  .badge.discontinued {
    background: #f44336;
    color: white;
  }
  
  /* 모달 공통 스타일 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }
  
  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  }
  
  .modal-header {
    padding: 1.5rem 1.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e9ecef;
  }
  
  .modal-header h3 {
    margin: 0;
    color: #2a69ac;
  }
  
  .modal-close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #666;
    cursor: pointer;
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .sije-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .sije-input-group label {
    font-weight: bold;
    color: #333;
  }
  
  .sije-input-group input {
    padding: 0.7rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  .modal-footer {
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  
  .cancel-btn, .confirm-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  
  .cancel-btn {
    background: #e9ecef;
    color: #666;
  }
  
  .confirm-btn {
    background: #2a69ac;
    color: white;
  }
  
  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .no-data {
    text-align: center;
    padding: 2rem 1rem;
    color: #666;
    font-style: italic;
  }
  
  /* 반응형 디자인 */
  @media (max-width: 480px) {
    .sale-item-row {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .item-info {
      order: 1;
      flex: 1 1 100%;
    }
    
    .item-controls {
      order: 2;
    }
    
    .payment-controls {
      order: 3;
    }
    
    .remove-btn {
      order: 4;
    }
  }
</style>