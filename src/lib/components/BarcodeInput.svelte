<!-- src/lib/components/BarcodeInput.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let value = '';
  export let placeholder = '바코드 스캔...';
  export let showCamera = 'auto';
  export let autoSearch = true;
  export let disabled = false;
  
  // 상태
  let showBarcodeScanner = false;
  let isMobile = false;
  let inputElement;
  let scannerComponent;
  
  // 모바일/태블릿 감지
  function checkMobile() {
    if (!browser) return false;
    return window.innerWidth < 1024;
  }
  
  // 카메라 버튼 표시 여부
  $: showCameraButton = showCamera === true || (showCamera === 'auto' && isMobile);
  
  // 바코드 스캐너 열기
  function openBarcodeScanner() {
    if (disabled) return;
    showBarcodeScanner = true;
    
    if (inputElement) {
      inputElement.blur();
    }
    
    if (browser) {
      document.body.style.overflow = 'hidden';
    }
  }
  
  // 바코드 스캐너 닫기
  function closeBarcodeScanner() {
    showBarcodeScanner = false;
    if (browser) {
      document.body.style.overflow = '';
    }
  }
  
  // ✅ 플래시 토글 개선
  function handleFlashToggle() {
    console.log('🔦 플래시 토글 클릭');
    console.log('📹 스캐너 컴포넌트:', scannerComponent);
    
    if (scannerComponent && typeof scannerComponent.toggleFlash === 'function') {
      scannerComponent.toggleFlash();
    } else {
      console.error('❌ 스캐너 컴포넌트 또는 toggleFlash 함수 없음');
      alert('스캐너가 준비되지 않았습니다.');
    }
  }
  
  // 카메라 스캔 감지 처리
  function handleCameraDetected(event) {
    const { code, format } = event.detail;
    
    value = code;
    
    dispatch('scan', { code, format, source: 'camera' });
    
    if (autoSearch) {
      handleSearch(code, 'camera');
    }
    
    // 스캔 후 input 초기화 (연속 스캔 가능)
    setTimeout(() => {
      value = '';
    }, 100);
  }
  
  // 키보드 입력 처리 (바코드 스캐너 기기)
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      if (value && autoSearch) {
        // 값이 있으면 기존 검색 동작
        handleSearch(value, 'device');
        
        setTimeout(() => {
          value = '';
        }, 100);
      } else {
        // 값이 없으면 검색 버튼 동작 이벤트 발생
        dispatch('emptySearch');
      }
    }
  }
  
  
  // 검색 실행
  function handleSearch(code, source = 'manual') {
    if (!code) return;
    dispatch('search', { code, source });
  }
  
  // ESC 키로 스캐너 닫기
  function handleWindowKeydown(event) {
    if (event.key === 'Escape' && showBarcodeScanner) {
      closeBarcodeScanner();
    }
  }
  
  // 초기화
  onMount(() => {
    if (!browser) return;
    
    isMobile = checkMobile();
    
    const handleResize = () => {
      isMobile = checkMobile();
      if (!isMobile && showBarcodeScanner) {
        closeBarcodeScanner();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (browser) {
        document.body.style.overflow = '';
      }
    };
  });
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="inline-block">
  <div class="relative inline-flex items-center">
    <!-- 컴팩트 입력 필드 (키보드 입력 가능) -->
    <input
      bind:this={inputElement}
      type="text"
      bind:value
      {placeholder}
      {disabled}
      on:keydown={handleKeydown}
      on:input
      on:focus
      on:blur
      class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 uppercase transition-colors bg-white"
      class:pr-8={showCameraButton}
      class:bg-gray-100={disabled}
      class:cursor-not-allowed={disabled}
      style="padding: 4px 8px; font-size: 0.75rem; width: 150px; ime-mode: disabled;"
      inputmode="latin"
      autocomplete="off"
      lang="en"
    />
    
    <!-- 카메라 아이콘 버튼 -->
    {#if showCameraButton && !disabled}
      <button
        type="button"
        on:click={openBarcodeScanner}
        class="absolute right-0.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-all active:scale-95"
        aria-label="바코드 스캔"
        title="바코드 스캔"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>
    {/if}
  </div>
</div>

<!-- 바코드 스캐너 컴팩트 UI (화면의 30%) -->
{#if showBarcodeScanner && showCameraButton}
  <!-- 배경 딤 처리 -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
    on:click={closeBarcodeScanner}
  ></div>
  
  <!-- 스캐너 바텀시트 (컴팩트) -->
  <div
    class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-lg shadow-2xl transition-transform duration-300 ease-out"
    style="height: 35vh; padding-bottom: env(safe-area-inset-bottom);"
  >
    <!-- 드래그 핸들 (작게) -->
    <div class="flex justify-center pt-1.5 pb-1">
      <div class="w-8 h-0.5 bg-gray-300 rounded-full"></div>
    </div>
    
    <!-- 헤더 (작게) -->
    <div class="flex items-center justify-between px-3 py-1 border-b border-gray-200">
      <h3 class="text-xs font-semibold text-gray-900">바코드 스캔</h3>
      <div class="flex items-center gap-1">
        <!-- ✅ 플래시 버튼 개선 -->
        <button
          type="button"
          on:click={handleFlashToggle}
          class="p-1 rounded transition-all"
          class:text-yellow-500={scannerComponent?.flashEnabled}
          class:bg-yellow-100={scannerComponent?.flashEnabled}
          class:text-gray-400={!scannerComponent?.flashEnabled}
          class:hover:text-yellow-600={true}
          class:hover:bg-gray-100={true}
          disabled={!scannerComponent}
          aria-label="플래시"
          title="플래시"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </button>
        
        <!-- 닫기 버튼 -->
        <button
          type="button"
          on:click={closeBarcodeScanner}
          class="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
          aria-label="닫기"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- 스캐너 컨텐츠 (컴팩트) -->
    <div class="overflow-hidden h-full">
      <div class="p-1.5 h-full">
        <div class="h-full flex items-center justify-center" style="max-height: calc(30vh - 40px);">
          <!-- ✅ BarcodeScanner에 bind:this 연결 -->
          <BarcodeScanner
            bind:this={scannerComponent}
            autoStart={true}
            continuous={false}
            debounceTime={1500}
            cameraFacing="environment"
            showManualInput={false}
            compactMode={true}
            on:detected={handleCameraDetected}
            on:error={(e) => {
              console.error('스캐너 오류:', e.detail);
              dispatch('error', e.detail);
            }}
          />
        </div>
      </div>
    </div>
  </div>
{/if}