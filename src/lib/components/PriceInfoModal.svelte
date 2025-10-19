<!-- PriceInfoModal.svelte -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let show = false;
  export let productCode = '';
  export let productName = '';
  export let readonly = false;
  
  // 내부에서 관리할 데이터들
  let priceHistory = [];
  let discountTypeOptions = [];
  
  // 모달 상태
  let modalElement;
  let loading = false;
  let saveLoading = false;
  let error = '';
  let success = '';
  
  // 내부 상태
  let activePriceTab = 'current';
  let priceChanged = false;
  
  // 가격 데이터
  let priceData = {
    basePrice: 0,
    cardPrice: 0,
    cashPrice: 0,
    deliveryPrice: 0,
    priceEnabled: false
  };
  
  // 할인 데이터
  let discountData = {
    discountType: '',
    quantity: 0,
    amount: 0,
    isChecked: false
  };
  
  // 원본 데이터 백업 (취소 시 복원용)
  let originalPriceData = {};
  let originalDiscountData = {};
  
  // show가 변경되고 productCode가 있을 때 데이터 로드
  $: if (show && productCode) {
    loadPriceDataFromAPI();
    error = '';
    success = '';
    priceChanged = false;
  }
  
  // API에서 가격 정보 로드
  async function loadPriceDataFromAPI() {
    if (!productCode) return;
    
    console.log('📊 가격 데이터 API 로드 시작:', productCode);
    
    try {
      // API 파라미터 설정
      const params = new URLSearchParams({
        company_code: 'AK',
        registration_code: 'AK', 
        product_code: productCode,
        category_code: 'CD001'
      });
      
      const apiUrl = `/api/product-management/product-registration/detail?${params}`;
      console.log('🔗 API URL:', apiUrl);
      
      // 가격 정보 API 호출
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (result.success) {
        // 가격 정보 설정
        if (result.priceInfo && Object.keys(result.priceInfo).length > 0) {
          priceData.basePrice = result.priceInfo.DPRC_BAPR || 0;
          priceData.cardPrice = result.priceInfo.DPRC_SOPR || 0;
          priceData.cashPrice = result.priceInfo.DPRC_DCPR || 0;
          priceData.deliveryPrice = result.priceInfo.DPRC_DEPR || 0;
          priceData.priceEnabled = true;
        }
        
        // 히스토리 설정
        priceHistory = result.priceHistory || [];
        
        // 할인 정보 설정
        if (result.discountInfo && result.discountInfo.length > 0) {
          const discount = result.discountInfo[0];
          discountData.discountType = discount.YOUL_GUBN || '';
          discountData.quantity = discount.YOUL_QTY1 || 0;
          discountData.amount = discount.YOUL_AMT1 || 0;
          discountData.isChecked = !!(discount.YOUL_GUBN || discount.YOUL_QTY1 || discount.YOUL_AMT1);
        }
        
        console.log('✅ 가격 데이터 로드 완료');
      } else {
        console.warn('⚠️ 가격 정보 없음:', result.message);
      }
      
      // 할인구분 옵션 로드
      const discountResponse = await fetch('/api/common-codes/minr?majr_code=CD003');
      const discountResult = await discountResponse.json();
      if (discountResult.success) {
        discountTypeOptions = discountResult.data || [];
      }
      
    } catch (error) {
      console.error('❌ 가격 데이터 로드 실패:', error);
      error = '가격 정보를 불러올 수 없습니다: ' + error.message;
    }
  }
  
  // ESC 키로 모달 닫기
  function handleKeydown(event) {
    if (event.key === 'Escape' && show) {
      closeModal();
    }
  }
  
  // 모달 닫기
  function closeModal() {
    dispatch('close');
  }
  
  // 모달 외부 클릭 시 닫기
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
  
  // 저장하기 (수정된 버전)
  async function handleSave() {
    if (!priceChanged) {
      success = '변경사항이 없습니다.';
      return;
    }
    
    try {
      saveLoading = true;
      error = '';
      success = '';
      
      // 완전한 저장 데이터 구성
      const saveData = {
        basicInfo: {
          code: productCode,
          name: productName,
          externalCode: '',
          qrCode: '',
          description: ''
        },
        priceInfo: { ...priceData },
        discountInfo: { ...discountData },
        companyCode: 'AK',
        registrationCode: 'AK'
      };
      
      console.log('💾 가격 저장 요청:', saveData);
      
      // 가격 전용 API 사용 (간단한 데이터만 전송)
      const response = await fetch('/api/product-management/product-registration/price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productCode,
          priceData: { ...priceData },
          discountData: { ...discountData }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        success = '가격 정보가 저장되었습니다.';
        priceChanged = false;
        
        // 부모 컴포넌트에 저장 완료 알림
        dispatch('save', {
          productCode,
          priceData: { ...priceData },
          discountData: { ...discountData }
        });
        
        // 2초 후 모달 닫기
        setTimeout(() => {
          closeModal();
        }, 2000);
      } else {
        error = '저장 실패: ' + result.message;
      }
      
    } catch (err) {
      console.error('❌ 가격 저장 오류:', err);
      error = '저장 중 오류가 발생했습니다: ' + err.message;
    } finally {
      saveLoading = false;
    }
  }
  
  // 취소하기
  function handleCancel() {
    // 원본 데이터로 복원
    priceData = { ...originalPriceData };
    discountData = { ...originalDiscountData };
    priceChanged = false;
    error = '';
    success = '';
    closeModal();
  }
  
  // 변경사항 감지
  function markAsChanged() {
    priceChanged = true;
    error = '';
    success = '';
  }
  
  // 숫자 입력 검증 함수
  function validateNumberInput(value, allowNegative = false) {
    if (!value) return '';
    
    const regex = allowNegative ? /[^0-9.-]/g : /[^0-9.]/g;
    let cleanValue = value.toString().replace(regex, '');
    
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleanValue;
  }
  
  // 숫자 파싱 함수
  function parseNumber(value) {
    if (!value || value === '') return 0;
    const num = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }
  
  // 숫자 포맷 함수
  function formatNumber(num) {
    if (!num || num === 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // 가격 입력 핸들러들
  function handleBasePriceInput(e) {
    let value = validateNumberInput(e.target.value, false);
    const numValue = parseNumber(value);
    priceData.basePrice = numValue;
    e.target.value = value;
    markAsChanged();
  }
  
  function handleCardPriceInput(e) {
    let value = validateNumberInput(e.target.value, false);
    const numValue = parseNumber(value);
    priceData.cardPrice = numValue;
    e.target.value = value;
    markAsChanged();
  }
  
  function handleCashPriceInput(e) {
    let value = validateNumberInput(e.target.value, false);
    const numValue = parseNumber(value);
    priceData.cashPrice = numValue;
    e.target.value = value;
    markAsChanged();
  }
  
  function handleDeliveryPriceInput(e) {
    let value = validateNumberInput(e.target.value, false);
    const numValue = parseNumber(value);
    priceData.deliveryPrice = numValue;
    e.target.value = value;
    markAsChanged();
  }
  
  // 가격 포맷 핸들러들
  function formatBasePriceOnBlur(e) {
    const formatted = formatNumber(priceData.basePrice);
    e.target.value = formatted;
  }
  
  function formatCardPriceOnBlur(e) {
    const formatted = formatNumber(priceData.cardPrice);
    e.target.value = formatted;
  }
  
  function formatCashPriceOnBlur(e) {
    const formatted = formatNumber(priceData.cashPrice);
    e.target.value = formatted;
  }
  
  function formatDeliveryPriceOnBlur(e) {
    const formatted = formatNumber(priceData.deliveryPrice);
    e.target.value = formatted;
  }
  
  // 할인 입력 핸들러들
  function handleDiscountTypeChange(e) {
    discountData.discountType = e.target.value;
    if (discountData.discountType) {
      discountData.isChecked = true;
    }
    markAsChanged();
  }
  
  function handleDiscountQuantityInput(e) {
    let value = validateNumberInput(e.target.value, false);
    const numValue = parseNumber(value);
    
    discountData.quantity = numValue;
    e.target.value = value;
    
    if (numValue > 0) {
      discountData.isChecked = true;
    }
    markAsChanged();
  }
  
  function handleDiscountAmountInput(e) {
    let value = validateNumberInput(e.target.value, true);
    const numValue = parseNumber(value);
    
    discountData.amount = numValue;
    e.target.value = value;
    
    if (numValue !== 0) {
      discountData.isChecked = true;
    }
    markAsChanged();
  }
  
  function formatDiscountQuantityOnBlur(e) {
    const formatted = formatNumber(discountData.quantity);
    e.target.value = formatted;
  }
  
  function formatDiscountAmountOnBlur(e) {
    const formatted = formatNumber(discountData.amount);
    e.target.value = formatted;
  }
  
  // 컴포넌트 마운트 시 키보드 이벤트 등록
  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
      return () => {
        window.removeEventListener('keydown', handleKeydown);
      };
    }
  });
</script>

  <!-- 모달 오버레이 -->
{#if show}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
    on:click={handleBackdropClick}
    bind:this={modalElement}
  >
    <!-- 모달 컨테이너 -->
    <div 
      class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      on:click|stopPropagation
    >
      <!-- 모달 헤더 -->
      <div class="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-semibold text-gray-800">가격 정보 수정</h2>
          {#if productName}
            <p class="text-sm text-gray-600 mt-1">{productName} ({productCode})</p>
          {:else if productCode}
            <p class="text-sm text-gray-600 mt-1">제품코드: {productCode}</p>
          {/if}
        </div>
        <button 
          on:click={closeModal}
          class="text-gray-400 hover:text-gray-600 transition-colors"
          disabled={saveLoading}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- 모달 내용 (스크롤 가능) -->
      <div class="flex-1 overflow-y-auto">
        <!-- 메시지 영역 -->
        {#if success || error}
          <div class="px-6 pt-4">
            {#if success}
              <div class="text-sm text-green-600 bg-green-50 px-3 py-2 rounded border border-green-200">
                {success}
              </div>
            {/if}
            
            {#if error}
              <div class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
                {error}
              </div>
            {/if}
          </div>
        {/if}

        <!-- 가격 정보 카드 내용 -->
        <div class="p-6">
          <!-- 변경사항 표시 -->
          {#if priceChanged}
            <div class="mb-4 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full inline-block">
              변경됨
            </div>
          {/if}

          <!-- 탭 버튼 -->
          <div class="flex mb-4 border-b border-gray-200">
            <button 
              class="px-2 py-1 text-sm font-medium border-b-2 transition-colors {activePriceTab === 'current' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
              on:click={() => activePriceTab = 'current'}
              disabled={readonly || saveLoading}
            >
              가격
            </button>
            <button 
              class="px-2 py-1 text-sm font-medium border-b-2 transition-colors {activePriceTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
              on:click={() => activePriceTab = 'history'}
              disabled={readonly || saveLoading}
            >
              히스토리
            </button>
          </div>

          {#if activePriceTab === 'current'}
            <!-- 가격 테이블 -->
            <div class="border border-gray-300 rounded overflow-hidden">
              <table class="w-full text-xs">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="border-r border-gray-300 text-center py-1.5 px-1.5 w-10">✓</th>
                    <th class="border-r border-gray-300 text-center py-1.5 px-1.5">기본가</th>
                    <th class="border-r border-gray-300 text-center py-1.5 px-1.5">카드가</th>
                    <th class="border-r border-gray-300 text-center py-1.5 px-1.5">현금가</th>
                    <th class="text-center py-1.5 px-1.5">납품가</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <!-- 체크박스 -->
                    <td class="border-r border-gray-300 text-center py-1.5 px-1.5">
                      <input 
                        type="checkbox" 
                        bind:checked={priceData.priceEnabled}
                        disabled={readonly || saveLoading}
                        on:change={markAsChanged}
                        class="w-3 h-3"
                      />
                    </td>
                    
                    <!-- 기본가 입력 -->
                    <td class="border-r border-gray-300 py-1.5 px-1.5">
                      <input 
                        type="text"
                        value={formatNumber(priceData.basePrice)}
                        on:input={handleBasePriceInput}
                        on:blur={formatBasePriceOnBlur}
                        disabled={readonly || saveLoading}
                        class="w-full border-none text-right bg-transparent focus:outline-none focus:bg-yellow-50 text-xs font-medium p-0.5"
                        placeholder="0"
                      />
                    </td>
                    
                    <!-- 카드가 입력 -->
                    <td class="border-r border-gray-300 py-1.5 px-1.5">
                      <input 
                        type="text"
                        value={formatNumber(priceData.cardPrice)}
                        on:input={handleCardPriceInput}
                        on:blur={formatCardPriceOnBlur}
                        disabled={readonly || saveLoading}
                        class="w-full border-none text-right bg-transparent focus:outline-none focus:bg-yellow-50 text-xs font-medium p-0.5"
                        placeholder="0"
                      />
                    </td>
                    
                    <!-- 현금가 입력 -->
                    <td class="border-r border-gray-300 py-1.5 px-1.5">
                      <input 
                        type="text"
                        value={formatNumber(priceData.cashPrice)}
                        on:input={handleCashPriceInput}
                        on:blur={formatCashPriceOnBlur}
                        disabled={readonly || saveLoading}
                        class="w-full border-none text-right bg-transparent focus:outline-none focus:bg-yellow-50 text-xs font-medium p-0.5"
                        placeholder="0"
                      />
                    </td>
                    
                    <!-- 납품가 입력 -->
                    <td class="text-center py-1.5 px-1.5">
                      <input 
                        type="text"
                        value={formatNumber(priceData.deliveryPrice)}
                        on:input={handleDeliveryPriceInput}
                        on:blur={formatDeliveryPriceOnBlur}
                        disabled={readonly || saveLoading}
                        class="w-full border-none text-right bg-transparent focus:outline-none focus:bg-yellow-50 text-xs font-medium p-0.5"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 수량 할인 테이블 -->
            <div class="mt-4">
              <h4 class="text-gray-700 font-medium mb-2 text-xs">수량 할인</h4>
              <div class="border border-gray-300 rounded overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-gray-100">
                    <tr>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5 w-10">✓</th>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5 w-30">현금</th>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5">할인수량</th>
                      <th class="text-center py-1.5 px-1.5">할인금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <!-- 체크박스 -->
                      <td class="border-r border-gray-300 text-center py-1.5 px-1.5">
                        <input 
                          type="checkbox" 
                          bind:checked={discountData.isChecked}
                          disabled={readonly || saveLoading}
                          on:change={markAsChanged}
                          class="w-3 h-3"
                        />
                      </td>
                      
                      <!-- 할인구분 콤보박스 -->
                      <td class="border-r border-gray-300 py-1.5 px-1.5">
                        <select 
                          bind:value={discountData.discountType}
                          on:change={handleDiscountTypeChange}
                          disabled={readonly || saveLoading}
                          class="w-full border-none bg-transparent focus:outline-none focus:bg-yellow-50 text-xs p-0.5"
                        >
                          <option value="">선택</option>
                          {#each discountTypeOptions as option}
                            <option value={option.MINR_CODE}>{option.MINR_NAME}</option>
                          {/each}
                        </select>
                      </td>
                      
                      <!-- 할인수량 입력 -->
                      <td class="border-r border-gray-300 py-1.5 px-1.5">
                        <input 
                          type="text"
                          value={formatNumber(discountData.quantity)}
                          on:input={handleDiscountQuantityInput}
                          on:blur={formatDiscountQuantityOnBlur}
                          disabled={readonly || saveLoading}
                          class="w-full border-none text-right bg-transparent focus:outline-none focus:bg-yellow-50 text-xs font-medium p-0.5"
                          placeholder="0"
                        />
                      </td>
                      
                      <!-- 할인금액 입력 -->
                      <td class="text-center py-1.5 px-1.5">
                        <input 
                          type="text"
                          value={formatNumber(discountData.amount)}
                          on:input={handleDiscountAmountInput}
                          on:blur={formatDiscountAmountOnBlur}
                          disabled={readonly || saveLoading}
                          class="w-full border-none text-right bg-transparent focus:outline-none focus:bg-yellow-50 text-xs font-medium p-0.5"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          {:else if activePriceTab === 'history'}
            <!-- 가격 히스토리 (제품등록과 동일한 테이블 디자인) -->
            <div class="border border-gray-300 rounded overflow-hidden">
              {#if priceHistory && priceHistory.length > 0}
                <table class="w-full text-xs">
                  <thead class="bg-gray-100">
                    <tr>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5">일자</th>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5">원가</th>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5">카드가</th>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5">현금가</th>
                      <th class="border-r border-gray-300 text-center py-1.5 px-1.5">납품가</th>
                      <th class="text-center py-1.5 px-1.5">등록자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each priceHistory as history}
                      <tr class="hover:bg-gray-50">
                        <td class="border-r border-gray-300 text-center py-1.5 px-1.5 text-blue-600">
                          {history.DPRC_DATE ? `${history.DPRC_DATE.substring(0,4)}-${history.DPRC_DATE.substring(4,6)}-${history.DPRC_DATE.substring(6,8)}` : '-'}
                        </td>
                        <td class="border-r border-gray-300 text-right py-1.5 px-1.5">
                          {history.DPRC_BAPR ? Number(history.DPRC_BAPR).toLocaleString('ko-KR') : '-'}
                        </td>
                        <td class="border-r border-gray-300 text-right py-1.5 px-1.5">
                          {history.DPRC_SOPR ? Number(history.DPRC_SOPR).toLocaleString('ko-KR') : '-'}
                        </td>
                        <td class="border-r border-gray-300 text-right py-1.5 px-1.5">
                          {history.DPRC_DCPR ? Number(history.DPRC_DCPR).toLocaleString('ko-KR') : '-'}
                        </td>
                        <td class="border-r border-gray-300 text-right py-1.5 px-1.5">
                          {history.DPRC_DEPR ? Number(history.DPRC_DEPR).toLocaleString('ko-KR') : '-'}
                        </td>
                        <td class="text-center py-1.5 px-1.5 text-gray-600">
                          {history.DPRC_IUSR || '-'}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {:else}
                <div class="text-center text-gray-600 py-8">
                  가격 히스토리가 없습니다.
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- 모달 푸터 (버튼들) -->
      <div class="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
        <button 
          on:click={handleCancel}
          disabled={saveLoading}
          class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          취소
        </button>
        <button 
          on:click={handleSave}
          disabled={saveLoading || readonly || !priceChanged}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {#if saveLoading}
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          저장
        </button>
      </div>
    </div>
  </div>
{/if}