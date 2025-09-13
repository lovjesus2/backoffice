<!-- src/lib/components/ImageModalStock.svelte - simpleImageCache 적용 버전 -->
<script>
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { imageModalStore, closeImageModal } from '$lib/utils/imageModalUtils';
  import { simpleCache } from '$lib/utils/simpleImageCache.js';
  import BarcodeModal from '$lib/components/BarcodeModal.svelte';

  const dispatch = createEventDispatcher();

  // store 구독 - productCode로 변경
  $: ({ show, imageSrc, imagePath, imageAlt, zIndex, productCode } = $imageModalStore);

  // blob URL 문제 해결: blob URL이면 프록시 URL로 교체
  $: actualSrc = (imageSrc && imageSrc.startsWith('blob:') && imagePath) 
    ? `/proxy-images/${imagePath}` 
    : imageSrc;

  // 상태
  let loading = false;
  let error = false;
  let isMobile = false;
  let retryCount = 0;
  const MAX_RETRY = 2;
  let imgElement = null;

  // 제품 정보 관련 상태 - API로 조회
  let productData = null;
  let loadingProductData = false;
  let productDataError = false;

  // 재고 관리 관련 상태
  let adjustingStock = new Set();
  let selectedProduct = null;
  let barcodeModal;

  // 모바일 체크
  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 768;
    }
  }

  // 초기 설정
  onMount(() => {
    checkMobile();
    
    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (browser) {
        document.body.style.overflow = '';
      }
    };
  });

  // productCode가 변경되면 제품 정보 조회
  $: if (productCode && show) {
    loadProductData(productCode);
  }

  // 제품 정보 조회 함수
  async function loadProductData(code) {
    if (!code) return;

    console.log('🔍 제품 정보 조회 시작:', code);
    loadingProductData = true;
    productDataError = false;
    productData = null;

    try {
      const response = await fetch(`/api/product-management/product-stock/product-detail?code=${encodeURIComponent(code)}`);
      const result = await response.json();

      if (result.success) {
        productData = result.data;
        console.log('✅ 제품 정보 조회 성공:', productData);
      } else {
        console.error('❌ 제품 정보 조회 실패:', result.message);
        productDataError = true;
      }
    } catch (error) {
      console.error('❌ 제품 정보 조회 에러:', error);
      productDataError = true;
    } finally {
      loadingProductData = false;
    }
  }

  // 모달 열림/닫힘 처리
  $: if (show && actualSrc) {
    loading = true;
    error = false;
    retryCount = 0;
    
    // 모바일에서 스크롤 방지
    if (browser && window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    }
  }

  // 모달 닫힐 때 정리
  $: if (!show && browser) {
    document.body.style.overflow = '';
    // 제품 데이터 초기화
    productData = null;
    loadingProductData = false;
    productDataError = false;
  }

  // 이미지 엘리먼트가 준비되면 캐시 처리 시작
  $: if (imgElement && actualSrc && show) {
    handleImageWithCache();
  }

  // simpleCache를 사용한 이미지 처리
  async function handleImageWithCache() {
    if (!imgElement || !actualSrc) return;
    
    console.log('🔄 캐시를 통한 이미지 로딩 시작:', actualSrc);
    
    try {
      // simpleCache의 handleImage 메소드 사용
      await simpleCache.handleImage(imgElement);
    } catch (error) {
      console.error('❌ 캐시 이미지 처리 실패:', error);
      handleImageError();
    }
  }

  // 이미지 로드 완료
  function handleImageLoad(event) {
    console.log('✅ 모달 이미지 로드 완료:', event.target.src);
    loading = false;
    error = false;
    retryCount = 0;
  }

  // 이미지 로드 실패
  function handleImageError() {
    console.error('❌ 모달 이미지 로드 실패:', actualSrc);
    loading = false;
    error = true;
  }

  // 다시 시도
  function retryImage() {
    if (retryCount >= MAX_RETRY) {
      console.error('❌ 최대 재시도 횟수 초과');
      return;
    }

    loading = true;
    error = false;
    retryCount++;

    console.log(`🔄 이미지 재시도 (${retryCount}/${MAX_RETRY})`);
    
    // 캐시 클리어 후 다시 시도
    if (imgElement) {
      // 강제로 src를 변경해서 재로드 트리거
      const timestamp = Date.now();
      const separator = actualSrc.includes('?') ? '&' : '?';
      const newSrc = `${actualSrc.split('?')[0]}${separator}_retry=${timestamp}`;
      imgElement.src = newSrc;
    }
  }

  // ESC 키 처리
  function handleKeydown(event) {
    if (event.key === 'Escape' && show) {
      closeImageModal();
    }
  }

  // 외부 클릭 처리
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      closeImageModal();
    }
  }

  // 재고 조정 (ImageModalStock.svelte용 수정 버전)
  async function adjustStock(productCode, quantity) {
    const qty = parseInt(quantity);
    if (!qty || qty === 0) {
      showToast('수량을 입력해주세요.', 'error');
      return;
    }
    
    adjustingStock.add(productCode);
    adjustingStock = adjustingStock;
    
    try {
      console.log('모달에서 재고 조정 시작:', { productCode, quantity: qty });
      
      const response = await fetch('/api/product-management/product-stock/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode,
          quantity: qty
        })
      });
      
      const result = await response.json();
      console.log('모달 재고 조정 API 응답:', result);
      
      if (result.success) {
        // ⭐ 기존 재고 확인
        const beforeStock = productData?.stock || 0;
        console.log('모달 업데이트 전 재고:', beforeStock);
        console.log('모달 API에서 받은 새 재고:', result.new_stock);
        
        // ⭐ 강제 반응성 트리거 방식들
        if (productData && productData.code === productCode) {
          // 방법 1: 새로운 객체 생성 후 재할당
          const updatedProductData = {
            ...productData,
            stock: result.new_stock,
            stockManaged: true  // 재고 조정 시 자동으로 재고관리 활성화
          };
          
          // 명시적 재할당으로 반응성 보장
          productData = updatedProductData;
          
          // 방법 2: 추가 반응성 트리거 (선택사항)
          productData = productData;
          
          console.log('모달 업데이트 후 productData:', productData);
        }
        
        showToast(result.message, 'success');
        
        // 입력 필드 초기화
        const input = document.querySelector(`input[data-code="${productCode}"]`);
        if (input) input.value = '';
        
        // ⭐ 부모 컴포넌트에 변경 사항 알림 (재고와 재고관리 상태 모두 전달)
        dispatch('stockUpdated', {
          productCode,
          newStock: result.new_stock,
          stockManaged: true  // 재고관리 상태도 함께 전달
        });
        
      } else {
        showToast(result.message || '재고 조정 실패', 'error');
      }
    } catch (err) {
      console.error('모달 재고 조정 오류:', err);
      showToast('재고 조정 중 오류가 발생했습니다.', 'error');
    } finally {
      adjustingStock.delete(productCode);
      adjustingStock = adjustingStock;
    }
  }

  // 단종 처리
  async function toggleDiscontinued(productCode) {
    try {
      console.log('단종 토글 시작, 현재 상태:', productData?.discontinued); // 디버그 로그
      
      const response = await fetch('/api/product-management/product-stock/toggle-attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode, 
          attribute_code: 'L5'  // 단종
        })
      });
      
      const result = await response.json();
      console.log('API 응답:', result); // 디버그 로그
      
      if (result.success) {
        // ✅ 강제 반응성 트리거를 위한 방법
        const isDiscontinued = result.new_status === '1';
        console.log('새로운 단종 상태:', isDiscontinued); // 디버그 로그
        
        // 제품 데이터 업데이트 (강제 재할당으로 반응성 보장)
        if (productData && productData.code === productCode) {
          productData = {
            ...productData,
            discontinued: isDiscontinued
          };
          // 강제 반응성 트리거
          productData = productData;
        }
        
        console.log('업데이트된 productData:', productData); // 디버그 로그
        
        showToast(result.message, 'success');
        
        // 부모 컴포넌트에 변경 사항 알림
        dispatch('discontinuedUpdated', {
          productCode,
          discontinued: isDiscontinued
        });
        
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      console.error('단종 처리 오류:', err);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  }
  
  // ✅ 재고사용 처리 함수 수정
  async function toggleStockUsage(productCode) {
    try {
      console.log('재고사용 토글 시작, 현재 상태:', productData?.stockManaged); // 디버그 로그
      
      const response = await fetch('/api/product-management/product-stock/toggle-attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode, 
          attribute_code: 'L6'  // 재고사용
        })
      });
      
      const result = await response.json();
      console.log('API 응답:', result); // 디버그 로그
      
      if (result.success) {
        // ✅ 강제 반응성 트리거를 위한 방법
        const isStockUsage = result.new_status === '1';
        console.log('새로운 재고사용 상태:', isStockUsage); // 디버그 로그
        
        // 제품 데이터 업데이트 (강제 재할당으로 반응성 보장)
        if (productData && productData.code === productCode) {
          productData = {
            ...productData,
            stockManaged: isStockUsage
          };
          // 강제 반응성 트리거
          productData = productData;
        }
        
        console.log('업데이트된 productData:', productData); // 디버그 로그
        
        showToast(result.message, 'success');
        
        // 부모 컴포넌트에 변경 사항 알림
        dispatch('stockUsageUpdated', {
          productCode,
          stockManaged: isStockUsage
        });
        
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      console.error('재고사용 처리 오류:', err);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  }

  // ✅ 온라인 토글 함수 추가
  async function toggleOnline(productCode) {
    try {
      console.log('이미지 모달에서 온라인 토글:', productCode);
      
      const response = await fetch('/api/product-management/product-stock/toggle-attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_code: productCode, 
          attribute_code: 'L7'  // 온라인
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const isOnline = result.new_status === '1';
        
        // productData 업데이트 (모달 내부)
        if (productData && productData.code === productCode) {
          productData = {
            ...productData,
            isOnline: isOnline
          };
        }
        
        showToast(result.message, 'success');
        
        // 부모 컴포넌트에 변경 사항 알림
        dispatch('onlineUpdated', {
          productCode,
          isOnline: isOnline
        });
        
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      console.error('온라인 처리 오류:', err);
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  }

  // 바코드 출력
  async function printBarcode(product) {
    console.log('출력 요청된 제품:', product);
    
    // 해당 제품의 재고 조정 입력 필드에서 수량 가져오기
    const input = document.querySelector(`input[data-code="${product.code}"]`);
    let quantity = input ? parseInt(input.value) : 0;
    
    // 0보다 작거나 같으면 기본 1장으로 설정
    if (!quantity || quantity <= 0) {
      quantity = 1;
    }
    
    // 출력 시작 토스트 메시지
    showToast(`🖨️ 바코드 ${quantity}장 출력 중...`, 'info');
    
    // 상태를 명시적으로 업데이트
    selectedProduct = {
      code: product.code,
      name: product.name,
      price: product.price || 0
    };
    
    // Svelte DOM 업데이트 대기
    await tick();
    
    console.log('업데이트된 selectedProduct:', selectedProduct);
    console.log('출력 수량:', quantity);
    
    // 바코드 출력 실행
    if (barcodeModal) {
      barcodeModal.directPrint(quantity);
    }
  }

  // 바코드 출력 성공 처리
  function handlePrintSuccess(event) {
    console.log('출력 완료:', event.detail.message);
    showToast('✅ 바코드 출력 완료!', 'success');
  }

  // 바코드 출력 실패 처리
  function handlePrintError(event) {
    console.error('출력 실패:', event.detail.error);
    showToast('❌ 바코드 출력 실패: ' + event.detail.error, 'error');
  }

  // 재고 조정 값 처리
  function handleStockInput(event, productCode) {
    if (event.key === 'Enter') {
      adjustStock(productCode, event.target.value);
    }
  }

  // 토스트 메시지 표시
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
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      ${type === 'success' ? 'background: #10b981;' : type === 'error' ? 'background: #ef4444;' : 'background: #3b82f6;'}
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션으로 표시
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <!-- 모달 컨테이너 -->
  <div 
    class="fixed bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-200 z-[9999] p-4"
    style="
      {isMobile ? 
        'top: 0; left: 0; right: 0; bottom: 0;' : 
        'top: 0; left: 256px; right: 0; bottom: 0;'
      }
      touch-action: none;
    " 
    on:click={handleOverlayClick}
  >
    <div 
      class="relative flex flex-col items-center w-full max-w-4xl max-h-full" 
      on:click|stopPropagation
    >
      <!-- 로딩 상태 -->
      {#if loading}
        <div class="flex items-center justify-center" style="width: 300px; height: 300px;">
          <div class="text-white text-center">
            <div class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-lg font-medium">이미지 로딩 중...</p>
            {#if retryCount > 0}
              <p class="text-sm text-gray-300 mt-2">재시도 중... ({retryCount}/{MAX_RETRY})</p>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- 에러 상태 -->
      {#if error}
        <div class="flex items-center justify-center" style="width: 300px; height: 300px;">
          <div class="text-white text-center max-w-md">
            <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">이미지를 불러올 수 없습니다</h3>
            <p class="text-gray-300 mb-6">네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.</p>
            
            <div class="space-y-3">
              {#if retryCount < MAX_RETRY}
                <button 
                  class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
                  style="touch-action: manipulation;"
                  on:click={retryImage}
                >
                  다시 시도 ({retryCount}/{MAX_RETRY})
                </button>
              {:else}
                <div class="text-sm text-gray-400 mb-4">
                  최대 재시도 횟수를 초과했습니다
                </div>
              {/if}
              
              <button 
                class="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-black"
                style="touch-action: manipulation;"
                on:click={closeImageModal}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- 이미지 컨테이너 - 300x300 고정 크기 -->
      {#if actualSrc && !error}
        <div class="relative flex items-center justify-center" style="width: 300px; height: 300px;">
          <!-- 닫기 버튼 (이미지 상단 오른쪽) -->
          <button 
            class="absolute -top-5 -right-5 w-10 h-10 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 z-20 backdrop-blur-sm"
            style="touch-action: manipulation;"
            on:click={closeImageModal}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <!-- 이미지 -->
          <img 
            bind:this={imgElement}
            src={actualSrc}
            alt={imageAlt}
            class="rounded-lg shadow-2xl transition-all duration-300 {loading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}"
            style="width: 300px; height: 300px; object-fit: cover;"
            on:load={handleImageLoad}
            on:error={handleImageError}
          />
          
          <!-- ✅ 재고 수량 배지 (오른쪽 위) -->
          {#if productData && productData.stockManaged}
            <span class="absolute top-2 right-2 {productData.stock === 0 ? 
              'bg-gray-500 text-white' : 'bg-yellow-400 text-gray-800'} px-2 py-1 rounded-lg text-sm font-bold min-w-8 text-center shadow-lg z-10">
              {productData.stock || 0}
            </span>
          {/if}

          <!-- ✅ 온라인 배지 (왼쪽 위) -->
          {#if productData && productData.isOnline}
            <span class="absolute top-2 left-2 bg-blue-100 text-blue-800 border border-blue-200 text-sm rounded-full px-3 py-1 font-medium shadow-lg z-10">
              ON
            </span>
          {/if}
          
          <!-- 이미지 로딩 오버레이 -->
          {#if loading}
            <div class="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg backdrop-blur-sm">
              <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- 제품 정보 카드 (productCode가 있고 이미지 로딩 완료 시) -->
      <!-- ✅ 1개 통합 카드 - 좌우 영역 분할 -->
      {#if productData && !productDataError}
        <div class="mt-4 w-full max-w-[600px] bg-white border border-gray-300 rounded-lg shadow-sm">
          
          <!-- 좌우 영역 컨테이너 -->
          <div class="flex">
            
            <!-- 왼쪽 영역: 제품 정보 (기준 높이) -->
            <div class="w-1/2 p-4 border-r border-gray-200">
              <div class="text-gray-800 font-medium mb-3" style="font-size: 0.85rem; line-height: 1.4;">
                {productData.name || '제품명 없음'}
              </div>
              <div class="text-gray-700 mb-3" style="font-size: 0.8rem; line-height: 1.3;">
                코드: {productData.code || ''}
              </div>
              <div class="text-gray-700 mb-3" style="font-size: 0.8rem; line-height: 1.3;">
                원가: {productData.cost ? productData.cost.toLocaleString() : '0'}원
              </div>
              <div class="text-gray-700" style="font-size: 0.8rem; line-height: 1.3;">
                금액: {productData.price ? productData.price.toLocaleString() : '0'}원
              </div>
            </div>
            
            <!-- 오른쪽 영역: 기능 그룹 (왼쪽 높이에 맞춤) -->
            <div class="w-1/2 p-4 flex flex-col justify-between">
              
              <!-- 1줄: 재고 표시 + 수량 입력 -->
              <div class="flex items-center gap-2 mb-3">
                <div class="text-gray-600 font-medium" style="font-size: 0.8rem; white-space: nowrap;">
                  재고: {productData.stock || 0}개
                </div>
                <input 
                  type="number" 
                  class="flex-1 border border-gray-300 rounded text-center py-1 px-2"
                  style="font-size: 0.75rem; min-width: 60px;"
                  placeholder="±수량"
                  data-code={productData.code}
                  on:keydown={(e) => handleStockInput(e, productData.code)}
                />
              </div>
              
              <!-- 2줄: 저장/출력 버튼 -->
              <div class="flex gap-2 mb-3">
                <button 
                  type="button"
                  class="flex-1 bg-green-500 text-white border-0 rounded cursor-pointer hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 py-2"
                  style="font-size: 0.7rem; font-weight: 600;"
                  disabled={adjustingStock.has(productData.code)}
                  on:click={() => {
                    const input = document.querySelector(`input[data-code="${productData.code}"]`);
                    adjustStock(productData.code, input?.value || '');
                  }}
                >
                  💾 저장
                </button>
                <button 
                  type="button"
                  class="flex-1 bg-purple-500 text-white border-0 rounded cursor-pointer hover:bg-purple-600 transition-all duration-200 py-2"
                  style="font-size: 0.7rem; font-weight: 600;"
                  on:click={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    printBarcode(productData);
                  }}
                >
                  🖨️ 바코드 출력
                </button>
              </div>
              
              <!-- 3줄: 단종/사용 토글 버튼들 -->
              <div class="flex gap-2 mb-2">
                <!-- 단종/정상 토글 -->
                <button 
                  type="button"
                  class="flex-1 border-0 rounded cursor-pointer transition-all duration-200 py-2 {productData.discontinued ? 
                    'bg-gray-400 text-white hover:bg-gray-500' : 'bg-red-500 text-white hover:bg-red-600'}"
                  style="font-size: 0.7rem; font-weight: 600;"
                  on:click={() => toggleDiscontinued(productData.code)}
                >
                  {productData.discontinued ? '단종' : '정상'}
                </button>
                
                <!-- 재고사용/미사용 토글 -->
                <button 
                  type="button"
                  class="flex-1 border-0 rounded cursor-pointer transition-all duration-200 py-2 {productData.stockManaged ? 
                    'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-400 text-white hover:bg-gray-500'}"
                  style="font-size: 0.7rem; font-weight: 600;"
                  on:click={() => toggleStockUsage(productData.code)}
                >
                  {productData.stockManaged ? '사용' : '미사용'}
                </button>
              </div>

              <!-- ✅ 새로 추가: 가로 구분선 -->
              <hr class="border-0 border-t border-gray-300 my-2">

              <!-- ✅ 새로 추가: 온라인 토글 버튼 -->
              <div>
                <button 
                  type="button"
                  class="w-full border-0 rounded cursor-pointer transition-all duration-200 py-2 {productData.isOnline ? 
                    'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
                  style="font-size: 0.7rem; font-weight: 600;"
                  on:click={() => toggleOnline(productData.code)}
                >
                  {productData.isOnline ? 'ON' : 'OFF'}
                </button>
              </div>
              
            </div>
            
          </div>
          
        </div>
      {/if}

      <!-- 로딩 및 에러 상태 -->
      {#if loadingProductData}
        <div class="mt-4 w-full max-w-[600px] bg-white border border-gray-300 rounded-lg shadow-sm p-4">
          <div class="text-center text-gray-500" style="font-size: 0.8rem;">
            제품 정보를 불러오는 중...
          </div>
        </div>
      {/if}

      {#if productDataError}
        <div class="mt-4 w-full max-w-[600px] bg-white border border-gray-300 rounded-lg shadow-sm p-4">
          <div class="text-center text-red-500" style="font-size: 0.8rem;">
            제품 정보를 불러올 수 없습니다.
          </div>
        </div>
      {/if}
      
    </div>
  </div>
{/if}

<!-- 바코드 출력 컴포넌트 (숨겨져 있지만 직접 출력용) -->
<BarcodeModal 
  bind:this={barcodeModal}
  bind:productData={selectedProduct}
  on:printSuccess={handlePrintSuccess}
  on:printError={handlePrintError}
/>

<style>
  /* 추가 애니메이션 */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .fixed {
    animation: fadeIn 0.2s ease-out;
  }
</style>