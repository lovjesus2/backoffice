<!-- src/routes/admin/sales/flea-market/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { simpleCache } from '$lib/utils/simpleImageCache';
  
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
  let productFilter = 'all'; // 초기값을 'all'로 변경
  let discontinuedFilter = 'normal';
  let searchResults = [];
  let hasSearched = false; // 검색을 했는지 여부 추적
  
  // 바코드 스캔 상태
  let showBarcodeScanner = false;
  let isScanning = false;
  let isPaused = false;
  let scannerStatus = 'QuaggaJS 스캔 준비 완료';
  let flashEnabled = false;
  
  let itemCounter = 0;
  
  // 숫자 포맷팅 함수
  function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // iPhone 오디오 컨텍스트 초기화 (사용자 제스처 필요)
  let audioContextInitialized = false;
  let audioContext = null;

  function initAudioContext() {
    if (audioContextInitialized || audioContext) return;
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextInitialized = true;
      console.log('오디오 컨텍스트 초기화 완료');
      
      // 컨텍스트가 suspended 상태면 즉시 resume
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } catch (error) {
      console.log('오디오 컨텍스트 초기화 실패:', error);
    }
  }

  // 첫 터치 시 오디오 컨텍스트 활성화
  function handleFirstTouch() {
    initAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('오디오 컨텍스트 resumed');
      });
    }
    // 테스트 소리 재생
    provideFeedback('success');
  }

  // 이미지 캐싱 (sale01과 동일한 방식)
  async function cacheImage(event) {
    await simpleCache.handleImage(event.target);
  }

  onMount(() => {
    if (browser) {
      // 첫 터치 이벤트 리스너 등록 (iPhone 오디오 활성화용)
      document.addEventListener('touchstart', handleFirstTouch, { once: true });
      document.addEventListener('click', handleFirstTouch, { once: true });
      
      // QuaggaJS 및 기타 스크립트 로드
      loadExternalScripts();
      
      // 초기 데이터 로드
      loadInitialData();
      loadSijeAmount();
    }
  });
  
  onDestroy(() => {
    if (browser) {
      if (isScanning) {
        stopScanning();
      }
      // 이벤트 리스너 정리
      document.removeEventListener('touchstart', handleFirstTouch);
      document.removeEventListener('click', handleFirstTouch);
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
        products = result.data.map(item => ({
          code: item.PROH_CODE,
          name: item.PROH_NAME,
          price: item.DPRC_SOPR,
          cost: item.DPRC_BAPR,
          category: item.category_name,
          imageUrl: `/proxy-images/${item.PROH_CODE}_1.jpg`
        }));
      }
    } catch (error) {
      console.error('상품 로드 오류:', error);
    }
  }
  
  async function loadSijeAmount() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_sije_amount&date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        sijeAmount = result.amount.toString();
      }
    } catch (error) {
      console.error('시제 금액 로드 오류:', error);
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
    
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_product_by_barcode&barcode=${code}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const productData = {
          code: result.data.PROH_CODE,
          name: result.data.PROH_NAME,
          price: result.data.DPRC_SOPR,
          cost: result.data.DPRC_BAPR,
          image_url: `/proxy-images/${result.data.PROH_CODE}_1.jpg`
        };
        
        addSaleItem(productData);
        scannerStatus = `제품 추가됨: ${productData.name} (1초 후 다시 스캔 가능)`;
        provideFeedback('success');
      } else {
        scannerStatus = result.message || '제품을 찾을 수 없습니다 (1초 후 다시 스캔 가능)';
        provideFeedback('error');
      }
    } catch (error) {
      console.error('제품 정보 조회 실패:', error);
      scannerStatus = '제품 정보 조회 실패 (1초 후 다시 스캔 가능)';
      provideFeedback('error');
    }
    
    // 1초 후 스캔 재개
    setTimeout(() => {
      isPaused = false;
      if (isScanning) {
        scannerStatus = 'QuaggaJS로 바코드 스캔 중...';
      }
    }, 1000);
  }
  
  function provideFeedback(type = 'success') {
    // 1. 진동 (Android 등)
    try {
      if ('vibrate' in navigator) {
        switch(type) {
          case 'success':
            navigator.vibrate([200]);
            break;
          case 'quantity':
            navigator.vibrate([100]);
            break;
          case 'error':
            navigator.vibrate([100, 100, 100, 100, 100]);
            break;
          case 'save':
            navigator.vibrate([300]);
            break;
        }
      }
    } catch (error) {
      console.log('진동 기능을 사용할 수 없습니다:', error);
    }

    // 2. 오디오 피드백 (iPhone 포함 모든 기기)
    try {
      if (!audioContext) {
        initAudioContext();
      }
      
      if (audioContext && audioContext.state !== 'suspended') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 타입별 다른 주파수와 길이
        switch(type) {
          case 'success':
            // 바코드 스캔 소리: 높은 주파수의 짧은 삑 소리
            oscillator.frequency.setValueAtTime(1400, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
          case 'quantity':
            // 수량 증가: 띠링 소리
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
            break;
          case 'error':
            // 에러: 낮은 주파수의 긴 소리
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
          case 'save':
            // 저장: 상승하는 톤
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        }
      }
    } catch (error) {
      console.log('오디오 피드백을 사용할 수 없습니다:', error);
    }

    // 3. 시각적 피드백
    visualFeedback(type);
  }

  function visualFeedback(type) {
    const scanner = document.querySelector('.scanner-container');
    if (!scanner) return;

    let color = '#4CAF50'; // 기본 성공 색상
    
    switch(type) {
      case 'success':
        color = '#4CAF50'; // 초록색
        break;
      case 'quantity':
        color = '#2196F3'; // 파란색
        break;
      case 'error':
        color = '#f44336'; // 빨간색
        break;
      case 'save':
        color = '#ff9800'; // 주황색
        break;
    }

    // 화면 테두리 깜빡임 효과
    scanner.style.transition = 'border-color 0.1s ease';
    scanner.style.borderColor = color;
    scanner.style.borderWidth = '4px';
    
    setTimeout(() => {
      scanner.style.borderColor = '#e0e0e0';
      scanner.style.borderWidth = '2px';
    }, type === 'error' ? 500 : 200);
  }
  
  function addSaleItem(productData) {
    // 이미 추가된 제품인지 확인
    const existingItem = saleItems.find(item => item.code === productData.code);
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.totalAmount = existingItem.unitPrice * existingItem.quantity;
      updateTotals();
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
    
    // 새 항목을 배열 맨 앞에 추가
    saleItems.unshift(saleItem);
    saleItems = saleItems;
    updateTotals();
    // 새 제품 추가시에도 소리 재생
    provideFeedback('success');
  }
  
  function removeSaleItem(itemId) {
    saleItems = saleItems.filter(item => item.id !== itemId);
    updateTotals();
  }
  
  function increaseQuantity(itemId) {
    const item = saleItems.find(item => item.id === itemId);
    if (item) {
      item.quantity += 1;
      item.totalAmount = item.unitPrice * item.quantity;
      saleItems = saleItems;
      updateTotals();
      provideFeedback('quantity');
    }
  }
  
  function decreaseQuantity(itemId) {
    const item = saleItems.find(item => item.id === itemId);
    if (item && item.quantity > 1) {
      item.quantity -= 1;
      item.totalAmount = item.unitPrice * item.quantity;
      saleItems = saleItems;
      updateTotals();
      provideFeedback('quantity');
    }
  }
  
  function updateTotalAmount(itemId, totalAmount) {
    const item = saleItems.find(item => item.id === itemId);
    if (item) {
      item.totalAmount = Math.max(0, totalAmount);
      saleItems = saleItems;
      updateTotals();
    }
  }
  
  function togglePaymentType(itemId) {
    const item = saleItems.find(item => item.id === itemId);
    if (item) {
      item.isCash = !item.isCash;
      saleItems = saleItems;
      updateTotals();
    }
  }
  
  function updateTotals() {
    // 총 수량, 총 금액 계산 등은 화면에서 실시간으로 계산
  }
  
  async function saveSales() {
    if (saleItems.length === 0) {
      alert('저장할 매출 항목이 없습니다.');
      return;
    }
    
    try {
      loading = true;
      
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'save_sales',
          date: selectedDate,
          sijeAmount: parseInt(sijeAmount) || 0,
          items: saleItems.map(item => ({
            code: item.code,
            quantity: item.quantity,
            price: item.unitPrice,
            totalAmount: item.totalAmount,
            isCash: item.isCash
          }))
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('매출이 저장되었습니다.');
        saleItems = [];
        provideFeedback('save');
        await loadSalesList();
      } else {
        alert('저장 실패: ' + result.message);
        provideFeedback('error');
      }
      
    } catch (error) {
      console.error('매출 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
      provideFeedback('error');
    } finally {
      loading = false;
    }
  }
  
  async function saveSijeAmount() {
    try {
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'save_sije_amount',
          date: selectedDate,
          amount: parseInt(sijeAmount) || 0
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showSijeModal = false;
        alert('시제 금액이 저장되었습니다.');
        provideFeedback('save');
      } else {
        alert('저장 실패: ' + result.message);
        provideFeedback('error');
      }
      
    } catch (error) {
      console.error('시제 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
      provideFeedback('error');
    }
  }
  
  async function loadSalesList() {
    try {
      const response = await fetch(`/api/sales/flea-market?action=get_sales_list&startDate=${selectedDate}&endDate=${selectedDate}`);
      const result = await response.json();
      
      if (result.success) {
        salesList = result.data;
      }
    } catch (error) {
      console.error('매출 목록 로드 오류:', error);
    }
  }
  
  async function deleteSale(slipNo) {
    if (!confirm('이 매출을 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(`/api/sales/flea-market?sSlip=${slipNo}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('매출이 삭제되었습니다.');
        provideFeedback('save');
        await loadSalesList();
        await loadSijeAmount();
      } else {
        alert('삭제 실패: ' + result.message);
        provideFeedback('error');
      }
      
    } catch (error) {
      console.error('매출 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
      provideFeedback('error');
    }
  }
  
  // PHP 방식과 동일한 검색어 처리 함수
  function processSearchTerm(searchTerm, searchType) {
    if (searchType === 'code') {
      // 코드 검색: 검색어 그대로 사용
      return {
        type: 'code',
        term: searchTerm
      };
    } else {
      // 제품명 검색: PHP 방식으로 각 문자 분리
      const searchTermNoSpace = searchTerm.replace(/\s/g, ''); // 공백 제거
      const searchChars = [...searchTermNoSpace]; // 문자 분리 (유니코드 지원)
      
      return {
        type: 'name_chars',
        chars: searchChars
      };
    }
  }
  
  // 검색 핸들러 (PHP 방식과 동일)
  function handleSearch() {
    // 검색어가 비어있으면 검색하지 않음 (PHP와 동일)
    if (!searchTerm.trim()) {
      searchResults = [];
      hasSearched = false;
      return;
    }
    hasSearched = true;
    searchProducts();
  }
  
  async function searchProducts() {
    try {
      // PHP 방식으로 검색어 처리
      const processedSearch = processSearchTerm(searchTerm, searchType);
      
      // API 요청시 검색 방식 정보 포함
      const searchParams = new URLSearchParams({
        action: 'search_products',
        searchTerm: searchTerm,
        searchType: searchType,
        productFilter: productFilter,
        discontinuedFilter: discontinuedFilter,
        // PHP 방식 검색 플래그 추가
        phpStyle: 'true'
      });
      
      // 문자 분리 검색인 경우 문자들도 전송
      if (processedSearch.type === 'name_chars') {
        searchParams.append('searchChars', JSON.stringify(processedSearch.chars));
      }
      
      const response = await fetch(`/api/sales/flea-market?${searchParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        searchResults = result.data.map(product => ({
          ...product,
          imageUrl: `/proxy-images/${product.PROH_CODE}_1.jpg`
        }));
      }
    } catch (error) {
      console.error('상품 검색 오류:', error);
    }
  }
  
  function selectSearchResult(product) {
    const productData = {
      code: product.PROH_CODE,
      name: product.PROH_NAME,
      price: product.DPRC_SOPR,
      cost: product.DPRC_BAPR,
      image_url: `/proxy-images/${product.PROH_CODE}_1.jpg`
    };
    
    addSaleItem(productData);
    showSearchModal = false;
    // 검색 상태 초기화
    searchTerm = '';
    searchResults = [];
    hasSearched = false;
  }
  
  function selectProduct(product) {
    const productData = {
      code: product.code,
      name: product.name,
      price: product.price,
      cost: product.cost,
      image_url: product.imageUrl  // imageUrl을 image_url로 변환
    };
    
    addSaleItem(productData);
    // 상품 선택 후 패널은 열린 상태로 유지
  }
  
  async function addToFlea(productCode) {
    try {
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add_flea_product',
          productCode: productCode
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('FLEA에 추가되었습니다.');
        provideFeedback('save');
        await searchProducts(); // 검색 결과 갱신
      } else {
        alert('추가 실패: ' + result.message);
        provideFeedback('error');
      }
      
    } catch (error) {
      console.error('FLEA 추가 오류:', error);
      alert('추가 중 오류가 발생했습니다.');
      provideFeedback('error');
    }
  }
  
  async function removeFromFlea(productCode) {
    try {
      const response = await fetch('/api/sales/flea-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'remove_flea_product',
          productCode: productCode
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('FLEA에서 제거되었습니다.');
        provideFeedback('save');
        await searchProducts(); // 검색 결과 갱신
      } else {
        alert('제거 실패: ' + result.message);
        provideFeedback('error');
      }
      
    } catch (error) {
      console.error('FLEA 제거 오류:', error);
      alert('제거 중 오류가 발생했습니다.');
      provideFeedback('error');
    }
  }

  function closeSidebar() {
    showSidebar = false;
  }

  // 반응형 변수 - 숫자 합계로 정확하게 계산
  $: totalQuantity = saleItems.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
  $: totalAmount = saleItems.reduce((sum, item) => sum + parseInt(item.totalAmount || 0), 0);
  $: cashAmount = saleItems.filter(item => item.isCash).reduce((sum, item) => sum + parseInt(item.totalAmount || 0), 0);
  $: cardAmount = saleItems.filter(item => !item.isCash).reduce((sum, item) => sum + parseInt(item.totalAmount || 0), 0);
  
  // 카테고리 변경 시 상품 재로드
  $: if (selectedCategory) {
    loadProducts();
  }
</script>

<div class="ui-page">
  <!-- 사이드바 메뉴 -->
  {#if showSidebar}
    <!-- 모바일용 오버레이 -->
    <div class="sidebar-overlay" on:click={closeSidebar}></div>
    
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h3>매출 목록</h3>
        <button class="close-sidebar" on:click={closeSidebar}>×</button>
      </div>
      
      <div class="sidebar-content">
        <div class="date-filter">
          <label>조회 기간:</label>
          <input type="date" bind:value={selectedDate}>
          <input type="date" bind:value={selectedDate}>
          <button on:click={loadSalesList} class="search-btn">조회</button>
        </div>
        
        <div id="salesListContainer">
          {#if salesList.length === 0}
            <div class="no-data">조회된 매출 데이터가 없습니다.</div>
          {:else}
            {#each salesList as sale}
              <div class="sales-list-item" on:click={() => deleteSale(sale.slipNo)}>
                <div class="sales-item-date">{sale.date} {sale.regTime}</div>
                <div class="sales-item-info">
                  전표: {sale.slipNo} | 수량: {sale.qty}개 | 금액: {formatNumber(sale.amount)}원
                  {#if sale.rand}
                    <br>RAND: {sale.rand}
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- 메인 컨테이너 -->
  <div class="main-container">
    <!-- 헤더 -->
    <div class="header">
      <div class="header-left">
        <button class="sidebar-toggle" on:click={() => showSidebar = true}>☰</button>
        <h1>프리마켓</h1>
      </div>
      <div class="header-right">
        <input type="date" bind:value={selectedDate} class="date-input">
        <button class="sije-btn" on:click={() => showSijeModal = true}>시제</button>
      </div>
    </div>

    <!-- 바코드 스캐너 섹션 -->
    <div class="barcode-scanner-section">
      <div class="scanner-status">
        <div class="scanner-status-text">{scannerStatus}</div>
        <div class="scanner-controls-mini">
          {#if !isScanning}
            <button class="scanner-btn-mini start" on:click={startScanning}>스캔</button>
          {:else}
            <button class="scanner-btn-mini stop" on:click={stopScanning}>중지</button>
          {/if}
        </div>
      </div>
      
      {#if showBarcodeScanner}
        <div class="scanner-container">
          <div id="reader"></div>
          <div class="scan-overlay"></div>
        </div>
      {/if}
    </div>

    <!-- 상품 선택 토글 버튼 -->
    <button class="product-toggle-btn" class:collapsed={!showProductSelector} on:click={() => showProductSelector = !showProductSelector}>
      <span class="toggle-arrow">▼</span>
    </button>

    <!-- 상품 선택 섹션 -->
    {#if showProductSelector}
      <div class="product-selector-section">
        <div class="selector-header">
          <h3>상품 선택</h3>
          <button class="close-btn" on:click={() => showProductSelector = false}>×</button>
        </div>
        
        <div class="selector-content">
          <div class="category-tabs-container">
            <div class="category-tabs">
              {#each categories as category}
                <button 
                  class="category-tab" 
                  class:active={selectedCategory === category.code}
                  on:click={() => selectedCategory = category.code}
                >
                  {category.name}
                </button>
              {/each}
            </div>
          </div>
          
          <div class="flea-products-grid">
            {#each products as product}
              <div class="flea-product-item" on:click={() => selectProduct(product)}>
                <div class="flea-product-image">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    on:load={cacheImage}
                    on:error={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div class="no-image" style="display: none;">
                    이미지<br>없음
                  </div>
                </div>
                <div class="flea-product-code">{product.code}</div>
                <div class="flea-product-name">{product.name}</div>
                <div class="flea-product-price">{formatNumber(product.price)}원</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- 합계 정보 (mini 형태) -->
    {#if saleItems.length > 0}
      <div class="totals-section-mini">
        <div class="totals-grid-mini">
          <div class="total-item-mini">
            <div class="total-label-mini">📊 총 수량:</div>
            <div class="total-value-mini">{totalQuantity}</div>
          </div>
          <div class="total-item-mini">
            <div class="total-label-mini">💰 총 금액:</div>
            <div class="total-value-mini">{formatNumber(totalAmount)}원</div>
          </div>
        </div>
        <div class="totals-grid-mini">
          <div class="total-item-mini">
            <div class="total-label-mini">💵 현금:</div>
            <div class="total-value-mini">{formatNumber(cashAmount)}원</div>
          </div>
          <div class="total-item-mini">
            <div class="total-label-mini">💳 카드:</div>
            <div class="total-value-mini">{formatNumber(cardAmount)}원</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- 매출 항목 리스트 -->
    <div class="sale-items-section">
      <div class="section-header">
        <span>매출 항목 ({totalQuantity}개 - {formatNumber(totalAmount)}원)</span>
        <div class="header-buttons">
          <button class="search-btn" on:click={() => {
            showSearchModal = true;
            // 검색 모달 열 때 상태 초기화
            searchTerm = '';
            searchResults = [];
            hasSearched = false;
          }}>검색</button>
          <button class="save-btn" on:click={saveSales} disabled={loading || saleItems.length === 0}>
            {loading ? '저장중...' : '저장'}
          </button>
        </div>
      </div>
      
      <div class="sale-items-list">
        {#if saleItems.length === 0}
          <div class="empty-list">바코드를 스캔하거나 상품을 선택하여 제품을 추가하세요</div>
        {:else}
          {#each saleItems as item (item.id)}
            <div class="sale-item-row" class:cash-payment={item.isCash}>
              <div class="sale-item-top">
                <div class="sale-item-image">
                  <img 
                    src={item.imageUrl} 
                    alt={item.name} 
                    on:load={cacheImage}
                    on:error={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div class="no-image" style="display: none;">
                    이미지<br>없음
                  </div>
                </div>
                <div class="sale-item-info">
                  <div class="sale-item-code">{item.code}</div>
                  <div class="sale-item-name">{item.name}</div>
                </div>
                <button class="remove-btn" on:click={() => removeSaleItem(item.id)}>×</button>
              </div>
              
              <div class="sale-item-controls">
                <div class="quantity-controls">
                  <button class="qty-btn minus" on:click={() => decreaseQuantity(item.id)}>-</button>
                  <span class="quantity-display">{item.quantity}</span>
                  <button class="qty-btn plus" on:click={() => increaseQuantity(item.id)}>+</button>
                </div>
                
                <div class="price-info">
                  <span class="price-label">단가:</span>
                  <span class="price-value">{formatNumber(item.unitPrice)}원</span>
                </div>
                
                <div class="total-info">
                  <span class="total-label">총액:</span>
                  <input 
                    type="text" 
                    class="total-input" 
                    value={formatNumber(item.totalAmount)}
                    on:input={(e) => {
                      const value = parseInt(e.target.value.replace(/,/g, '')) || 0;
                      updateTotalAmount(item.id, value);
                    }}
                  >
                </div>
                
                <button 
                  class="payment-toggle-btn" 
                  class:cash={item.isCash}
                  class:card={!item.isCash}
                  on:click={() => togglePaymentType(item.id)}
                >
                  {item.isCash ? '현금' : '카드'}
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- 시제 모달 -->
{#if showSijeModal}
  <div class="modal-overlay" on:click={() => showSijeModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>시제 금액 입력</h3>
        <button class="modal-close" on:click={() => showSijeModal = false}>×</button>
      </div>
      <div class="modal-body">
        <label>시제 금액:</label>
        <input type="number" bind:value={sijeAmount} placeholder="금액을 입력하세요">
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showSijeModal = false}>취소</button>
        <button class="btn-save" on:click={saveSijeAmount}>저장</button>
      </div>
    </div>
  </div>
{/if}

<!-- 검색 모달 -->
{#if showSearchModal}
  <div class="modal-overlay" on:click={() => {
    showSearchModal = false;
    // 검색 상태 초기화
    searchTerm = '';
    searchResults = [];
    hasSearched = false;
  }}>
    <div class="search-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>상품 검색</h3>
        <button class="modal-close" on:click={() => {
          showSearchModal = false;
          // 검색 상태 초기화
          searchTerm = '';
          searchResults = [];
          hasSearched = false;
        }}>×</button>
      </div>
      
      <div class="search-controls">
        <div class="search-input-row">
          <input 
            type="text" 
            bind:value={searchTerm} 
            placeholder="검색어를 입력하세요"
            on:keypress={(e) => e.key === 'Enter' && handleSearch()}
          >
          <button class="search-btn" on:click={handleSearch}>검색</button>
        </div>
        
        <div class="search-filters">
          <select bind:value={searchType}>
            <option value="name">품목명</option>
            <option value="code">품목코드</option>
          </select>
          
          <select bind:value={productFilter}>
            <option value="all">전체</option>
            <option value="flea">FLEA 상품</option>
            <option value="non_flea">일반 상품</option>
          </select>
          
          <select bind:value={discontinuedFilter}>
            <option value="all">전체</option>
            <option value="normal">정상</option>
            <option value="discontinued">단종</option>
          </select>
        </div>
      </div>
      
      <div class="search-results">
        {#if !hasSearched}
          <div class="search-instruction">검색어를 입력하고 검색 버튼을 클릭하세요.</div>
        {:else if searchResults.length === 0}
          <div class="no-results">검색 결과가 없습니다.</div>
        {:else}
          {#each searchResults as result}
            <div class="search-result-item" on:click={() => selectSearchResult(result)}>
              <div class="result-image">
                {#if result.imageUrl}
                  <img src={result.imageUrl} alt={result.PROH_NAME}>
                {:else}
                  <div class="no-image">이미지<br>없음</div>
                {/if}
              </div>
              
              <div class="result-info">
                <div class="result-code">{result.PROH_CODE}</div>
                <div class="result-name" class:discontinued={result.PROD_COD2 === 'L2'}>
                  {result.PROH_NAME}
                </div>
                <div class="result-price">{formatNumber(result.DPRC_SOPR)}원</div>
              </div>
              
              <div class="result-actions">
                {#if result.is_flea}
                  <div class="flea-mark">FLEA</div>
                  <button class="flea-remove-btn" on:click|stopPropagation={() => removeFromFlea(result.PROH_CODE)}>-</button>
                {:else}
                  <button class="flea-toggle-btn add" on:click|stopPropagation={() => addToFlea(result.PROH_CODE)}>+</button>
                {/if}
                
                {#if result.PROD_COD2 === 'L2'}
                  <div class="discontinued-mark">단종</div>
                {/if}
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
  <div class="scanner-modal-overlay" on:click={stopScanning}>
    <div class="scanner-modal" on:click|stopPropagation>
      <div class="scanner-header">
        <h3>바코드 스캔</h3>
        <button class="modal-close" on:click={stopScanning}>×</button>
      </div>
      
      <div class="scanner-container">
        <div id="reader"></div>
        <div class="scanner-overlay"></div>
      </div>
      
      <div class="scanner-status">{scannerStatus}</div>
      
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

<style>
  .ui-page {
    position: relative;
    width: 100%;
    min-height: 100vh;
    background: #f5f5f5;
    font-family: 'Malgun Gothic', Arial, sans-serif;
    
  }

  /* 사이드바 스타일 */
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    z-index: 20;
    display: none;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 320px;
    height: 100vh;
    background: #fff;
    border-right: 1px solid #ddd;
    z-index: 30;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 1rem;
    background: #1976d2;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .close-sidebar {
    background: none;
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.25rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .sidebar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .date-filter {
    flex-shrink: 0;
    padding: 1rem;
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
  }

  .date-filter label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
  }

  .date-filter input {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  #salesListContainer {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.5rem 0;
    background: #fafafa;
  }

  .sales-list-item {
    margin: 0.5rem 0.75rem;
    padding: 0.75rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .sales-list-item:hover {
    background: #f8f9fa;
    border-color: #2196f3;
    transform: translateY(-1px);
  }

  .sales-item-date {
    font-weight: bold;
    color: #2a69ac;
    font-size: 0.95rem;
    margin-bottom: 0.4rem;
  }

  .sales-item-info {
    font-size: 0.85rem;
    color: #666;
    line-height: 1.4;
  }

  .no-data {
    text-align: center;
    padding: 2rem 1rem;
    color: #999;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* 메인 컨테이너 */
  .main-container {
    width: 100%;
    padding: 0.5rem;
    box-sizing: border-box;
  }

  /* 헤더 - 다른 메뉴와 동일한 노치 대응 */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 1rem;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .sidebar-toggle {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .sidebar-toggle:hover {
    background: #f0f0f0;
  }

  .header h1 {
    margin: 0;
    font-size: 1.3rem;
    color: #333;
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .date-input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .sije-btn {
    background: #ff9800;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s ease;
  }

  .sije-btn:hover {
    background: #f57c00;
  }

  /* 바코드 스캐너 섹션 */
  .barcode-scanner-section {
    margin-bottom: 1rem;
  }

  .scanner-container {
    position: relative;
    width: 100%;
    height: 150px;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid #e0e0e0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .scanner-container :global(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    transform: scaleX(1);
    background: #000;
    border-radius: 10px;
  }

  #reader {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
  }

  .scan-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    height: 100px;
    border: 3px solid #4CAF50;
    border-radius: 10px;
    pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
  }

  .scanner-status {
    background: #fff;
    padding: 0.5rem 1rem;
    text-align: left;
    color: #1976d2;
    font-size: 0.9rem;
    border-bottom: 1px solid #eaeaea;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 40px;
  }

  .scanner-status-text {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: #1976d2;
    margin-bottom: 8px;
    line-height: 1.4;
    text-align: center;
  }

  .scanner-controls-mini {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
  }

  .scanner-btn-mini {
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 60px;
    background: #9ca3af;
    color: white;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    white-space: nowrap;
  }

  .scanner-btn-mini.start {
    background: linear-gradient(45deg, #4CAF50, #45a049);
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  }

  .scanner-btn-mini.stop {
    background: linear-gradient(45deg, #f44336, #d32f2f);
    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
  }

  /* 상품 토글 버튼 - 다른 메뉴와 동일한 노치 대응 */
  .product-toggle-btn {
    position: fixed;
    top: 120px; /* env() 제거 */
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    background: rgba(42, 105, 172, 0.9);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    z-index: 15;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .product-toggle-btn:hover {
    background: rgba(42, 105, 172, 1);
    transform: translateX(-50%) scale(1.1);
  }

  .product-toggle-btn:active {
    transform: translateX(-50%) scale(0.95);
  }

  .product-toggle-btn.collapsed .toggle-arrow {
    transform: rotate(180deg);
  }

  /* 상품 선택 섹션 - 다른 메뉴와 동일한 노치 대응 */
  .product-selector-section {
    position: fixed;
    top: 170px; /* env() 제거 */
    left: 10px;
    right: 10px;
    height: 450px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 20;
    overflow: hidden;
  }

  .selector-header {
    padding: 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .selector-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s ease;
  }

  .close-btn:hover {
    background: #f0f0f0;
  }

  .selector-content {
    height: calc(100% - 65px);
    display: flex;
    flex-direction: column;
    padding: 10px 15px 20px 15px;
  }

  .category-tabs-container {
    flex-shrink: 0;
    padding: 0.5rem 0.8rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
  }

  .category-tabs {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.2rem;
  }

  .category-tab {
    flex: 0 0 auto;
    padding: 0.4rem 0.8rem;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.8rem;
    color: #666;
    transition: all 0.2s ease;
    white-space: nowrap;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .category-tab.active {
    background: #2a69ac;
    color: white;
    border-color: #2a69ac;
  }

  .category-tab:hover:not(.active) {
    background: #f0f0f0;
    border-color: #bbb;
  }

  .flea-products-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.6rem;
    overflow-y: auto;
    padding: 0.5rem 0;
    max-height: calc(100% - 20px);
  }

  .flea-product-item {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.5rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .flea-product-item:hover {
    border-color: #2196f3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .flea-product-image {
    width: 100px;
    height: 100px;
    margin: 0 auto 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }

  .flea-product-image img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
  }

  .flea-product-code {
    font-size: 0.75rem;
    color: #2a69ac;
    font-weight: 600;
    margin-bottom: 0.25rem;
    word-break: break-all;
  }

  .flea-product-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: #333;
    margin-bottom: 0.25rem;
    line-height: 1.2;
    min-height: 2.4em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .flea-product-price {
    font-size: 0.8rem;
    font-weight: bold;
    color: #4CAF50;
  }

  /* 수량 컨트롤 */
  .quantity-controls {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .qty-btn {
    width: 24px;
    height: 24px;
    background: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .qty-btn:hover {
    background: #1976d2;
  }

  .qty-btn:active {
    transform: scale(0.95);
  }

  .qty-btn.minus {
    background: #f44336;
  }

  .qty-btn.minus:hover {
    background: #d32f2f;
  }

  .quantity-display {
    font-size: 12px;
    font-weight: bold;
    color: #333;
    min-width: 24px;
    text-align: center;
    padding: 2px 4px;
    background: #f5f5f5;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  /* 합계 섹션 mini */
  .totals-section-mini {
    position: relative;
    margin: 1rem 0 0.5rem 0;
    background: #f8f9fa;
    border: 1px solid #2a69ac;
    border-radius: 6px;
    padding: 0.4rem;
    z-index: 1;
  }

  .totals-grid-mini {
    display: flex;
    justify-content: space-around;
    gap: 1rem;
    text-align: center;
    margin-bottom: 0.2rem;
  }

  .totals-grid-mini:last-child {
    margin-bottom: 0;
  }

  .total-item-mini {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .total-label-mini {
    font-size: 0.75rem;
    color: #666;
  }

  .total-value-mini {
    font-size: 0.9rem;
    font-weight: bold;
    color: #2a69ac;
  }

  /* 매출 항목 섹션 */
  .sale-items-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .section-header {
    padding: 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: #495057;
  }

  .header-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .save-btn {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s ease;
  }

  .save-btn:hover:not(:disabled) {
    background: #45a049;
  }

  .save-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .sale-items-list {
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .empty-list {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-size: 0.9rem;
  }

  /* 매출 항목 */
  .sale-item-row {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: relative;
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .sale-item-row:active {
    transform: scale(0.98);
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  }

  .sale-item-row.cash-payment {
    border-left: 4px solid #4CAF50;
    background: linear-gradient(90deg, rgba(76, 175, 80, 0.05), white 20%);
  }

  .sale-item-row:not(.cash-payment) {
    border-left: 4px solid #2196F3;
    background: linear-gradient(90deg, rgba(33, 150, 243, 0.05), white 20%);
  }

  .sale-item-top {
    display: flex;
    align-items: center;
    padding: 0.7rem;
    gap: 0.7rem;
    border-bottom: 1px solid #eee;
  }

  .sale-item-image {
    flex: 0 0 auto;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }

  .sale-item-image img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
  }

  .sale-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .sale-item-code {
    font-weight: bold;
    font-size: 1rem;
    color: #2a69ac;
    word-break: break-all;
  }

  .sale-item-name {
    font-size: 1.1rem;
    font-weight: bold;
    color: #333;
    line-height: 1.3;
    word-break: break-word;
  }

  .remove-btn {
    background: #f44336;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background: #d32f2f;
    transform: scale(1.1);
  }

  .sale-item-controls {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap;
    padding: 0.4rem;
    background-color: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
    font-size: 0.7rem;
  }

  .price-info, .total-info {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex: 1;
  }

  .price-label, .total-label {
    font-size: 0.7rem;
    color: #666;
    white-space: nowrap;
  }

  .price-value {
    font-size: 0.7rem;
    font-weight: bold;
    color: #4CAF50;
  }

  .total-input {
    width: 70px;
    padding: 0.2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
    font-size: 0.7rem;
    height: 24px;
    line-height: 1.2;
    box-sizing: border-box;
  }

  .payment-toggle-btn {
    padding: 0.2rem 0.5rem;
    border: none;
    border-radius: 12px;
    font-size: 0.65rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 35px;
    height: 24px;
    white-space: nowrap;
  }

  .payment-toggle-btn.cash {
    background: #4CAF50;
    color: white;
  }

  .payment-toggle-btn.card {
    background: #2196F3;
    color: white;
  }

  /* 공통 스타일 */
  .no-image {
    font-size: 0.7rem;
    color: #666;
    text-align: center;
    line-height: 1.2;
  }

  .search-btn {
    background: #2196f3;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s ease;
  }

  .search-btn:hover {
    background: #1976d2;
  }

  /* 모달 스타일 - 다른 메뉴와 동일한 노치 대응 */
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
    z-index: 18;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }

  .modal-header {
    padding: 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #333;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s ease;
  }

  .modal-close:hover {
    background: #f0f0f0;
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-body label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #333;
  }

  .modal-body input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .modal-footer {
    padding: 1rem;
    background: #f8f9fa;
    border-top: 1px solid #e9ecef;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn-cancel {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-save {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  /* 검색 모달 */
  .search-modal {
    background: white;
    border-radius: 12px;
    width: 95%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
  }

  .search-controls {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
  }

  .search-input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .search-input-row input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .search-filters {
    display: flex;
    gap: 0.5rem;
  }

  .search-filters select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .no-results {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-size: 0.9rem;
  }

  .search-instruction {
    text-align: center;
    padding: 2rem;
    color: #999;
    font-size: 0.9rem;
    font-style: italic;
  }

  .search-result-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .search-result-item:hover {
    border-color: #2196f3;
    background: #f8f9fa;
  }

  .result-image {
    flex: 0 0 auto;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }

  .result-image img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
  }

  .result-info {
    flex: 1;
  }

  .result-code {
    font-size: 0.75rem;
    color: #2a69ac;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .result-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .result-name.discontinued {
    color: #999;
    text-decoration: line-through;
  }

  .result-price {
    color: #4CAF50;
    font-weight: 500;
  }

  .result-actions {
    flex: 0 0 auto;
    position: relative;
  }

  .flea-mark {
    position: absolute;
    top: -8px;
    right: -8px;
    background: linear-gradient(45deg, #ff9800, #f57c00);
    color: white;
    font-size: 0.6rem;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 8px;
    z-index: 5;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }

  .flea-remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: all 0.2s ease;
  }

  .flea-toggle-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.6rem;
    font-weight: bold;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .flea-toggle-btn.add {
    background: #2196F3;
    color: white;
  }

  .discontinued-mark {
    position: absolute;
    top: 4px;
    left: 4px;
    background: #f44336;
    color: white;
    font-size: 0.6rem;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    z-index: 1;
  }

  /* 스캐너 모달 */
  .scanner-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99;
  }

  .scanner-modal {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }

  .scanner-header {
    padding: 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .scanner-controls {
    padding: 1rem;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .scanner-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .scanner-btn.start {
    background: #48bb78;
    color: white;
  }

  .scanner-btn.stop {
    background: #f56565;
    color: white;
  }

  /* ✅ 모바일 최적화 - PHP CSS와 픽셀 단위로 정확히 동일 */
  @media (max-width: 640px) {
    .product-toggle-btn {
      top: 100px;
      width: 30px;
      height: 30px;
      font-size: 10px;
    }
    
    .product-selector-section {
      top: 140px;
      height: 420px;
    }
    
    .selector-content {
      padding: 8px 10px 15px 10px;
    }
    
    .category-tabs-container {
      padding: 0.4rem 0.6rem;
    }
    
    .category-tabs {
      gap: 0.3rem;
    }
    
    .category-tab {
      padding: 0.3rem 0.6rem;
      font-size: 0.75rem;
      min-height: 28px;
    }
    
    .flea-products-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.5rem;
    }
    
    .flea-product-item {
      padding: 0.5rem;
    }
    
    .flea-product-image {
      width: 100px;
      height: 100px;
    }
    
    .flea-product-code {
      font-size: 0.7rem;
    }
    
    .flea-product-name {
      font-size: 0.75rem;
      min-height: 2.2em;
    }
    
    .flea-product-price {
      font-size: 0.75rem;
    }
    
    .sale-item-row {
      margin-bottom: 0.4rem;
    }
    
    .sale-item-top {
      padding: 0.6rem;
      gap: 0.6rem;
    }
    
    .sale-item-image {
      width: 70px;
      height: 70px;
    }
    
    .sale-item-code {
      font-size: 0.9rem;
    }
    
    .sale-item-name {
      font-size: 1rem;
      line-height: 1.2;
    }
    
    .sale-item-controls {
      padding: 0.35rem;
      gap: 0.25rem;
      font-size: 0.65rem;
    }
    
    .qty-btn {
      width: 20px;
      height: 20px;
      font-size: 10px;
    }
    
    .quantity-display {
      font-size: 10px;
      min-width: 22px;
      padding: 1px 3px;
    }
    
    .price-label, .total-label {
      font-size: 0.65rem;
    }
    
    .price-value {
      font-size: 0.65rem;
    }
    
    .total-input {
      width: 60px;
      font-size: 0.65rem;
      height: 20px;
    }
    
    .payment-toggle-btn {
      padding: 0.15rem 0.4rem;
      font-size: 0.6rem;
      min-width: 30px;
      height: 20px;
    }
    
    .remove-btn {
      width: 28px;
      height: 28px;
      font-size: 1rem;
    }
  }

  @media (max-width: 480px) {
    .product-selector-section {
      top: 120px;
      height: 400px;
    }
    
    .flea-products-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 0.4rem;
    }
    
    .flea-product-item {
      padding: 0.4rem;
    }
    
    .flea-product-image {
      width: 80px;
      height: 80px;
    }
    
    .flea-product-code {
      font-size: 0.65rem;
    }
    
    .flea-product-name {
      font-size: 0.7rem;
      min-height: 2em;
    }
    
    .flea-product-price {
      font-size: 0.7rem;
    }
    
    .sale-item-top {
      padding: 0.5rem;
      gap: 0.5rem;
    }
    
    .sale-item-image {
      width: 60px;
      height: 60px;
    }
    
    .sale-item-code {
      font-size: 0.8rem;
    }
    
    .sale-item-name {
      font-size: 0.9rem;
    }
    
    .sale-item-controls {
      padding: 0.3rem;
      gap: 0.3rem;
      font-size: 0.6rem;
    }
    
    .total-input {
      width: 55px;
      font-size: 0.6rem;
      height: 18px;
    }
    
    .payment-toggle-btn {
      font-size: 0.55rem;
      min-width: 28px;
      height: 18px;
    }
    
    .remove-btn {
      width: 24px;
      height: 24px;
      font-size: 0.9rem;
    }
  }

  @media (max-width: 375px) {
    .flea-products-grid {
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 0.3rem;
    }
    
    .flea-product-item {
      padding: 0.3rem;
    }
    
    .flea-product-image {
      width: 70px;
      height: 70px;
    }
    
    .flea-product-code {
      font-size: 0.6rem;
    }
    
    .flea-product-name {
      font-size: 0.65rem;
      min-height: 1.8em;
    }
    
    .flea-product-price {
      font-size: 0.65rem;
    }
    
    .sale-item-top {
      padding: 0.4rem;
      gap: 0.4rem;
    }
    
    .sale-item-image {
      width: 50px;
      height: 50px;
    }
    
    .sale-item-code {
      font-size: 0.75rem;
    }
    
    .sale-item-name {
      font-size: 0.85rem;
      line-height: 1.1;
    }
    
    .total-input {
      width: 50px;
      font-size: 0.55rem;
      height: 16px;
    }
    
    .payment-toggle-btn {
      font-size: 0.5rem;
      min-width: 26px;
      height: 16px;
    }
    
    .remove-btn {
      width: 22px;
      height: 22px;
      font-size: 0.8rem;
    }
  }

  /* 사이드바 스타일 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  z-index: 50;
  display: none;
}

.sidebar {
  position: fixed;
  top: 0;           /* 70px → 0 (원래대로) */
  left: 0;
  width: 320px;
  height: 100vh;    /* calc(100vh - 70px) → 100vh (원래대로) */
  background: #fff;
  border-right: 1px solid #ddd;
  z-index: 55;      /* 1000 → 95 (PWA UI보다 낮게) */
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* iOS: 사이드바 노치 대응 */
@supports (padding: max(0px)) {
  @media (max-width: 768px) {
    .sidebar {
      top: env(safe-area-inset-top, 0px);
      height: calc(100vh - env(safe-area-inset-top, 0px));
    }
    
    .sidebar-header {
      padding-top: calc(1rem + env(safe-area-inset-top, 0px));
    }
  }
}

  /* 반응형 - 다른 섹션들과 노치 대응 추가 */
  @media (max-width: 768px) {
    .sidebar {
      width: 50%; /* 모바일에서 화면의 절반만 차지 */
    }

    .sidebar-overlay {
      display: block; /* 모바일에서 오버레이 표시 */
    }

    .flea-products-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    /* 노치 대응 - 다른 메뉴와 동일 */
    .product-toggle-btn {
      top: 100px; /* env() 제거 */
    }
    
    .product-selector-section {
      top: 140px; /* env() 제거 */
    }
  }

  @media (max-width: 480px) {
    .sidebar {
      width: 60%; /* 작은 화면에서는 60% */
    }
    
    .product-selector-section {
      top: 120px;
      height: 400px;
    }
  }

  @media (max-width: 375px) {
    .sidebar {
      width: 70%; /* 매우 작은 화면에서는 70% */
    }
  }

  @media (min-resolution: 2dppx) {
    .total-input {
      font-size: 16px; /* iOS 줌 방지 */
    }
  }
</style>