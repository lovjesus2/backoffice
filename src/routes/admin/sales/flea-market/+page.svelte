<!-- src/routes/admin/flea-market/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
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
  
  onDestroy(() => {
    if (browser && isScanning) {
      stopScanning();
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
            const img = document.querySelector(`img[data-product-code="${product.PROH_CODE}"]`);
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
        
        // 검색 결과 이미지에도 캐시 적용
        setTimeout(() => {
          searchResults.forEach(product => {
            const img = document.querySelector(`img[data-search-code="${product.code}"]`);
            if (img) {
              simpleCache.handleImage(img);
            }
          });
        }, 100);
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
    
    showBarcodeScanner = true;
    
    try {
      window.Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#reader'),
          constraints: {
            width: 400,
            height: 200,
            facingMode: "environment"
          }
        },
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader", 
            "ean_8_reader",
            "code_39_reader"
          ]
        }
      }, function(err) {
        if (err) {
          console.error('QuaggaJS 초기화 실패:', err);
          scannerStatus = '스캐너 초기화 실패';
          return;
        }
        
        window.Quagga.start();
        isScanning = true;
        scannerStatus = 'QuaggaJS로 바코드 스캔 중...';
      });
      
      // 바코드 감지 이벤트
      window.Quagga.onDetected(function(result) {
        if (isPaused) return;
        
        const code = result.codeResult.code;
        handleBarcodeDetected(code);
      });
      
    } catch (error) {
      console.error('스캔 시작 오류:', error);
      scannerStatus = '스캔 시작 실패';
    }
  }
  
  function stopScanning() {
    if (window.Quagga && isScanning) {
      window.Quagga.stop();
      isScanning = false;
      scannerStatus = 'QuaggaJS 스캔 중지됨';
    }
    showBarcodeScanner = false;
  }
  
  async function handleBarcodeDetected(code) {
    if (isPaused) return;
    
    isPaused = true;
    scannerStatus = `바코드 감지: ${code} - 처리 중...`;
    
    try {
      const response = await fetch(`/api/sales/flea-market?action=lookup_product&barcode=${code}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        addSaleItem(result.data);
        scannerStatus = `상품 추가됨: ${result.data.name} (1초 후 다시 스캔 가능)`;
      } else {
        scannerStatus = '제품을 찾을 수 없습니다 (1초 후 다시 스캔 가능)';
      }
    } catch (error) {
      scannerStatus = '제품 정보 조회 실패 (1초 후 다시 스캔 가능)';
    }
    
    // 1초 후 스캔 재개
    setTimeout(() => {
      isPaused = false;
      if (isScanning) {
        scannerStatus = 'QuaggaJS로 바코드 스캔 중...';
      }
    }, 1000);
  }
  
  // 판매 아이템 관리
  function addSaleItem(productData) {
    // 기존 항목 찾기
    const existingItem = saleItems.find(item => item.code === productData.code);
    if (existingItem) {
      // 수량 증가
      existingItem.quantity += 1;
      existingItem.totalAmount = existingItem.unitPrice * existingItem.quantity;
      saleItems = saleItems; // 반응성 트리거
      return;
    }
    
    const itemId = ++itemCounter;
    const saleItem = {
      id: itemId,
      code: productData.code || productData.PROH_CODE,
      name: productData.name || productData.PROH_NAME,
      price: productData.price || parseInt(productData.DPRC_SOPR || 0),
      cost: productData.cost || parseInt(productData.DPRC_BAPR || 0),
      imageUrl: `https://image.kungkungne.synology.me/${productData.code || productData.PROH_CODE}.jpg`,
      quantity: 1,
      unitPrice: productData.price || parseInt(productData.DPRC_SOPR || 0),
      totalAmount: productData.price || parseInt(productData.DPRC_SOPR || 0),
      isCash: true // 기본값을 현금으로 설정
    };
    
    // 새 항목을 배열 맨 앞에 추가
    saleItems = [saleItem, ...saleItems];
  }
  
  function updateQuantity(itemId, newQuantity) {
    const quantity = parseInt(newQuantity) || 1;
    if (quantity < 1) return;
    
    saleItems = saleItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: quantity,
          totalAmount: item.unitPrice * quantity
        };
      }
      return item;
    });
  }
  
  function updateTotalAmount(itemId, newTotal) {
    const total = parseInt(newTotal) || 0;
    if (total < 0) return;
    
    saleItems = saleItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          totalAmount: total
        };
      }
      return item;
    });
  }
  
  function togglePaymentMethod(itemId) {
    saleItems = saleItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          isCash: !item.isCash
        };
      }
      return item;
    });
  }
  
  function removeItem(itemId) {
    saleItems = saleItems.filter(item => item.id !== itemId);
  }
  
  function clearAllItems() {
    if (saleItems.length === 0) return;
    if (confirm('모든 항목을 삭제하시겠습니까?')) {
      saleItems = [];
    }
  }
  
  // 판매 완료 처리
  async function completeSale() {
    if (saleItems.length === 0) {
      alert('판매할 상품이 없습니다.');
      return;
    }
    
    const totalAmount = saleItems.reduce((sum, item) => sum + item.totalAmount, 0);
    
    if (!confirm(`총 ${formatPrice(totalAmount)}원을 결제하시겠습니까?`)) {
      return;
    }
    
    try {
      loading = true;
      
      const saleData = {
        action: 'save_sales',
        items: saleItems.map(item => ({
          code: item.code,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          saleAmount: item.totalAmount,
          isCash: item.isCash
        }))
      };
      
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`판매가 완료되었습니다!\n매출번호: ${result.slipNo}`);
        
        // 영수증 출력 옵션
        if (confirm('영수증을 출력하시겠습니까?')) {
          const receiptUrl = `/receipt.php?slip=${result.slipNo}&rand=${result.rand}`;
          window.open(receiptUrl, '_blank', 'width=400,height=600,scrollbars=yes');
        }
        
        // 판매 목록 초기화
        saleItems = [];
        
        // 매출 목록 새로고침
        loadSalesList();
      } else {
        alert('판매 저장 실패: ' + result.error);
      }
    } catch (error) {
      console.error('판매 완료 오류:', error);
      alert('판매 처리 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  // 매출 삭제
  async function deleteSale(slipNo) {
    if (!confirm('정말로 이 매출을 삭제하시겠습니까?')) {
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
      } else {
        alert('삭제 실패: ' + result.error);
      }
    } catch (error) {
      console.error('매출 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      loading = false;
    }
  }
  
  function formatPrice(price) {
    return price.toLocaleString();
  }
  
  function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
  }
  
  // 반응형 계산
  $: totalQuantity = saleItems.reduce((sum, item) => sum + item.quantity, 0);
  $: totalAmount = saleItems.reduce((sum, item) => sum + item.totalAmount, 0);
  $: cashTotal = saleItems.filter(item => item.isCash).reduce((sum, item) => sum + item.totalAmount, 0);
  $: cardTotal = saleItems.filter(item => !item.isCash).reduce((sum, item) => sum + item.totalAmount, 0);
</script>

<svelte:head>
  <title>프리마켓 판매 - 백오피스</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</svelte:head>

<div class="flea-market-container">
  <!-- 상단 헤더 -->
  <div class="header">
    <div class="header-left">
      <button class="sidebar-toggle" on:click={() => showSidebar = !showSidebar}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <h1>🛒 프리마켓 판매</h1>
    </div>
    
    <div class="header-right">
      <button class="header-btn" on:click={() => showSearchModal = true}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        검색
      </button>
      <button class="header-btn" on:click={startScanning}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        스캔
      </button>
    </div>
  </div>

  <!-- 메인 콘텐츠 -->
  <div class="main-content">
    <!-- 판매 목록 -->
    <div class="sale-section">
      <div class="section-header">
        <h3>판매 목록 ({totalQuantity}개)</h3>
        <button class="clear-btn" on:click={clearAllItems} disabled={saleItems.length === 0}>
          전체 삭제
        </button>
      </div>
      
      <div class="sale-items">
        {#if saleItems.length === 0}
          <div class="empty-state">
            상품을 검색하거나 바코드를 스캔하여 추가하세요
          </div>
        {:else}
          {#each saleItems as item (item.id)}
            <div class="sale-item">
              <div class="item-image">
                <img 
                  src={item.imageUrl} 
                  alt={item.name}
                  data-sale-code={item.code}
                  on:load={(e) => simpleCache.handleImage(e.target)}
                  on:error={(e) => e.target.src = 'https://via.placeholder.com/60x60?text=No+Image'}
                />
              </div>
              
              <div class="item-info">
                <div class="item-name">{item.name}</div>
                <div class="item-code">{item.code}</div>
                <div class="item-price">단가: {formatPrice(item.unitPrice)}원</div>
              </div>
              
              <div class="item-controls">
                <div class="quantity-control">
                  <button class="qty-btn" on:click={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                  <input 
                    type="number" 
                    class="qty-input" 
                    value={item.quantity}
                    on:change={(e) => updateQuantity(item.id, e.target.value)}
                    min="1"
                  />
                  <button class="qty-btn" on:click={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                </div>
                
                <input 
                  type="number" 
                  class="amount-input" 
                  value={item.totalAmount}
                  on:change={(e) => updateTotalAmount(item.id, e.target.value)}
                />
                
                <button 
                  class="payment-btn" 
                  class:cash={item.isCash}
                  class:card={!item.isCash}
                  on:click={() => togglePaymentMethod(item.id)}
                >
                  {item.isCash ? '💰' : '💳'}
                </button>
                
                <button class="remove-btn" on:click={() => removeItem(item.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- 결제 요약 -->
    <div class="payment-summary">
      <div class="summary-row">
        <span>현금 결제:</span>
        <span>{formatPrice(cashTotal)}원</span>
      </div>
      <div class="summary-row">
        <span>카드 결제:</span>
        <span>{formatPrice(cardTotal)}원</span>
      </div>
      <div class="summary-row total">
        <span>총 금액:</span>
        <span>{formatPrice(totalAmount)}원</span>
      </div>
      
      <button 
        class="complete-btn" 
        on:click={completeSale}
        disabled={saleItems.length === 0 || loading}
      >
        {#if loading}
          <div class="spinner"></div>
          처리 중...
        {:else}
          💳 결제 완료
        {/if}
      </button>
    </div>

    <!-- 당일 매출 목록 -->
    <div class="sales-history">
      <div class="section-header">
        <h3>매출 내역</h3>
        <div class="date-controls">
          <input 
            type="date" 
            bind:value={selectedDate}
            class="date-input"
          />
          <button class="load-btn" on:click={loadSalesList}>조회</button>
        </div>
      </div>
      
      <div class="sales-list">
        {#if salesList.length === 0}
          <div class="empty-state">
            매출 내역이 없습니다
          </div>
        {:else}
          {#each salesList as sale}
            <div class="sales-item">
              <div class="sales-info">
                <div class="sales-slip">{sale.slipNo}</div>
                <div class="sales-date">{formatDate(sale.date)} {sale.regTime}</div>
                <div class="sales-amount">{formatPrice(sale.amount)}원 ({sale.qty}개)</div>
              </div>
              <div class="sales-actions">
                <button class="receipt-btn" on:click={() => window.open(`/receipt.php?slip=${sale.slipNo}&rand=${sale.rand}`, '_blank')}>
                  영수증
                </button>
                <button class="delete-btn" on:click={() => deleteSale(sale.slipNo)}>
                  삭제
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- 사이드바 - 상품 선택 -->
  {#if showSidebar}
    <div class="sidebar-overlay" on:click={() => showSidebar = false}></div>
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>상품 선택</h3>
        <button class="close-btn" on:click={() => showSidebar = false}>×</button>
      </div>
      
      <div class="category-tabs">
        {#each categories as category}
          <button 
            class="category-tab"
            class:active={selectedCategory === category.code}
            on:click={() => { selectedCategory = category.code; loadProducts(); }}
          >
            {category.name}
          </button>
        {/each}
      </div>
      
      <div class="products-grid">
        {#if loading}
          <div class="loading">상품 로딩 중...</div>
        {:else}
          {#each products as product}
            <div class="product-card" on:click={() => addSaleItem(product)}>
              <div class="product-image">
                <img 
                  src={`https://image.kungkungne.synology.me/${product.PROH_CODE}.jpg`}
                  alt={product.PROH_NAME}
                  data-product-code={product.PROH_CODE}
                  on:load={(e) => simpleCache.handleImage(e.target)}
                  on:error={(e) => e.target.src = 'https://via.placeholder.com/100x100?text=No+Image'}
                />
              </div>
              <div class="product-name">{product.PROH_NAME}</div>
              <div class="product-price">{formatPrice(parseInt(product.DPRC_SOPR))}원</div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}

  <!-- 검색 모달 -->
  {#if showSearchModal}
    <div class="modal-overlay" on:click={() => showSearchModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <h3>상품 검색</h3>
          <button class="close-btn" on:click={() => showSearchModal = false}>×</button>
        </div>
        
        <div class="search-form">
          <div class="form-row">
            <input 
              type="text" 
              bind:value={searchTerm}
              placeholder="상품명 또는 바코드 입력"
              class="search-input"
              on:keypress={(e) => e.key === 'Enter' && searchProducts()}
            />
            <button class="search-btn" on:click={searchProducts}>검색</button>
          </div>
          
          <div class="form-row">
            <select bind:value={searchType} class="form-select">
              <option value="name">상품명</option>
              <option value="code">바코드</option>
            </select>
            
            <select bind:value={productFilter} class="form-select">
              <option value="flea">프리마켓</option>
              <option value="all">전체상품</option>
              <option value="normal">일반상품</option>
            </select>
            
            <select bind:value={discontinuedFilter} class="form-select">
              <option value="normal">정상판매</option>
              <option value="all">전체</option>
              <option value="discontinued">단종상품</option>
            </select>
          </div>
        </div>
        
        <div class="search-results">
          {#if loading}
            <div class="loading">검색 중...</div>
          {:else if searchResults.length === 0}
            <div class="empty-state">검색 결과가 없습니다</div>
          {:else}
            {#each searchResults as product}
              <div class="search-result-item" on:click={() => { addSaleItem(product); showSearchModal = false; }}>
                <img 
                  src={product.image_url}
                  alt={product.name}
                  data-search-code={product.code}
                  on:load={(e) => simpleCache.handleImage(e.target)}
                  on:error={(e) => e.target.src = 'https://via.placeholder.com/50x50?text=No+Image'}
                />
                <div class="result-info">
                  <div class="result-name">{product.name}</div>
                  <div class="result-code">{product.code}</div>
                  <div class="result-price">{formatPrice(product.price)}원</div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- 바코드 스캐너 모달 -->
  {#if showBarcodeScanner}
    <div class="modal-overlay" on:click={stopScanning}>
      <div class="scanner-modal" on:click|stopPropagation>
        <div class="scanner-header">
          <h3>바코드 스캔</h3>
          <button class="close-btn" on:click={stopScanning}>×</button>
        </div>
        
        <div class="scanner-container">
          <div id="reader"></div>
          <div class="scanner-overlay"></div>
        </div>
        
        <div class="scanner-status">
          {scannerStatus}
        </div>
        
        <div class="scanner-controls">
          {#if !isScanning}
            <button class="scanner-btn start" on:click={startScanning}>스캔 시작</button>
          {:else}
            <button class="scanner-btn stop" on:click={stopScanning}>스캔 중지</button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .flea-market-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
  }

  /* 헤더 */
  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-left h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .sidebar-toggle, .header-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.3s;
  }

  .sidebar-toggle:hover, .header-btn:hover {
    background: rgba(255,255,255,0.3);
  }

  .header-right {
    display: flex;
    gap: 0.5rem;
  }

  /* 메인 콘텐츠 */
  .main-content {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* 판매 섹션 */
  .sale-section {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    color: #2d3748;
  }

  .clear-btn {
    background: #f56565;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .clear-btn:disabled {
    background: #cbd5e0;
    cursor: not-allowed;
  }

  /* 판매 아이템 */
  .sale-items {
    max-height: 300px;
    overflow-y: auto;
  }

  .sale-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    background: #f7fafc;
  }

  .item-image img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 0.25rem;
    margin-right: 1rem;
  }

  .item-info {
    flex: 1;
    margin-right: 1rem;
  }

  .item-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .item-code {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .item-price {
    font-size: 0.875rem;
    color: #e53e3e;
  }

  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .quantity-control {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .qty-btn {
    width: 2rem;
    height: 2rem;
    border: 1px solid #cbd5e0;
    background: white;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qty-input {
    width: 3rem;
    text-align: center;
    border: 1px solid #cbd5e0;
    padding: 0.25rem;
    border-radius: 0.25rem;
  }

  .amount-input {
    width: 5rem;
    text-align: right;
    border: 1px solid #cbd5e0;
    padding: 0.25rem;
    border-radius: 0.25rem;
  }

  .payment-btn {
    width: 2.5rem;
    height: 2rem;
    border: 2px solid #cbd5e0;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
  }

  .payment-btn.cash {
    background: #48bb78;
    border-color: #38a169;
    color: white;
  }

  .payment-btn.card {
    background: #3182ce;
    border-color: #2c5aa0;
    color: white;
  }

  .remove-btn {
    width: 2rem;
    height: 2rem;
    background: #f56565;
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 결제 요약 */
  .payment-summary {
    background: #2d3748;
    color: white;
    padding: 1rem;
    border-radius: 0.5rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .summary-row.total {
    font-size: 1.25rem;
    font-weight: bold;
    border-top: 1px solid #4a5568;
    padding-top: 0.5rem;
    margin-top: 0.5rem;
  }

  .complete-btn {
    width: 100%;
    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .complete-btn:disabled {
    background: #718096;
    cursor: not-allowed;
  }

  /* 매출 내역 */
  .sales-history {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .date-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .date-input {
    border: 1px solid #cbd5e0;
    padding: 0.5rem;
    border-radius: 0.25rem;
  }

  .load-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .sales-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .sales-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .sales-info {
    flex: 1;
  }

  .sales-slip {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .sales-date {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .sales-amount {
    color: #e53e3e;
    font-weight: 500;
  }

  .sales-actions {
    display: flex;
    gap: 0.5rem;
  }

  .receipt-btn, .delete-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .receipt-btn {
    background: #667eea;
    color: white;
  }

  .delete-btn {
    background: #f56565;
    color: white;
  }

  /* 사이드바 */
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 998;
  }

  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    background: white;
    z-index: 999;
    display: flex;
    flex-direction: column;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .sidebar-header h3 {
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .category-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
  }

  .category-tab {
    flex: 1;
    padding: 0.75rem;
    border: none;
    background: white;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }

  .category-tab.active {
    border-bottom-color: #667eea;
    color: #667eea;
    font-weight: 500;
  }

  .products-grid {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }

  .product-card {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .product-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .product-image img {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .product-name {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .product-price {
    color: #e53e3e;
    font-weight: 600;
  }

  /* 모달 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 0.5rem;
    width: 90%;
    max-width: 600px;
    max-height: 80%;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
  }

  .search-form {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .form-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #cbd5e0;
    border-radius: 0.25rem;
  }

  .search-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .form-select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #cbd5e0;
    border-radius: 0.25rem;
  }

  .search-results {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .search-result-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-result-item:hover {
    background: #f7fafc;
  }

  .search-result-item img {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 0.25rem;
    margin-right: 1rem;
  }

  .result-info {
    flex: 1;
  }

  .result-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .result-code {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .result-price {
    color: #e53e3e;
    font-weight: 500;
  }

  /* 바코드 스캐너 */
  .scanner-modal {
    background: white;
    border-radius: 0.5rem;
    width: 90%;
    max-width: 500px;
    padding: 1rem;
  }

  .scanner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .scanner-header h3 {
    margin: 0;
  }

  .scanner-container {
    width: 100%;
    height: 200px;
    background: #f0f0f0;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    position: relative;
    overflow: hidden;
  }

  #reader {
    width: 100%;
    height: 100%;
  }

  .scanner-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 100px;
    border: 3px solid #667eea;
    border-radius: 0.5rem;
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.3);
    pointer-events: none;
  }

  .scanner-status {
    text-align: center;
    padding: 0.5rem;
    background: #f0f4f8;
    border-radius: 0.25rem;
    margin-bottom: 1rem;
    color: #2d3748;
  }

  .scanner-controls {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .scanner-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-weight: 500;
  }

  .scanner-btn.start {
    background: #48bb78;
    color: white;
  }

  .scanner-btn.stop {
    background: #f56565;
    color: white;
  }

  /* 공통 */
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 반응형 */
  @media (max-width: 768px) {
    .sidebar {
      width: 100%;
    }

    .products-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    .sale-item {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .item-controls {
      justify-content: space-between;
    }
  }
</style>