<!-- src/lib/components/BarcodeInput.svelte -->
<script>
  import { onMount, createEventDispatcher, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { afterNavigate } from '$app/navigation';
  import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
  import Hangul from 'hangul-js';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let value = '';
  export let placeholder = '바코드 스캔...';
  export let showCamera = 'auto';
  export let autoSearch = true;
  export let disabled = false;
  export let autoFocus = false; // ✅ 자동 포커스 옵션 (기본: 꺼짐)
  
  // 상태
  let showBarcodeScanner = false;
  let isMobile = false;
  let inputElement;
  let scannerComponent;

  // 한글→영문 매핑
  const korToEng = {
    'ㅂ': 'Q', 'ㅈ': 'W', 'ㄷ': 'E', 'ㄱ': 'R', 'ㅅ': 'T',
    'ㅛ': 'Y', 'ㅕ': 'U', 'ㅑ': 'I', 'ㅐ': 'O', 'ㅔ': 'P',
    'ㅁ': 'A', 'ㄴ': 'S', 'ㅇ': 'D', 'ㄹ': 'F', 'ㅎ': 'G',
    'ㅗ': 'H', 'ㅓ': 'J', 'ㅏ': 'K', 'ㅣ': 'L',
    'ㅋ': 'Z', 'ㅌ': 'X', 'ㅊ': 'C', 'ㅍ': 'V', 'ㅠ': 'B',
    'ㅜ': 'N', 'ㅡ': 'M',
    'ㄲ': 'R', 'ㄸ': 'E', 'ㅃ': 'Q', 'ㅆ': 'T', 'ㅉ': 'W',
    'ㅒ': 'O', 'ㅖ': 'P'
  };

  function convertToEnglish(text) {
    if (!text) return '';
    const disassembled = Hangul.disassemble(text);
    return disassembled.map(char => korToEng[char] || char).join('');
  }
  
  function checkMobile() {
    if (!browser) return false;
    return window.innerWidth < 1024;
  }
  
  $: showCameraButton = showCamera === true || (showCamera === 'auto' && isMobile);

  // ✅ 외부에서 호출할 수 있는 focus 함수
  export function focus() {
    if (!disabled && inputElement) {
      inputElement.focus();
    }
  }

  // ✅ blur 이벤트 - 그냥 이벤트만 전달 (강제 복구 안함)
  function handleBlur(event) {
    dispatch('blur', event);
  }

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
  
  function closeBarcodeScanner() {
    showBarcodeScanner = false;
    if (browser) {
      document.body.style.overflow = '';
    }
    // ✅ 스캐너 닫은 후에만 포커스 복구
    setTimeout(() => {
      if (autoFocus && inputElement) {
        inputElement.focus();
      }
    }, 100);
  }
  
  function handleFlashToggle() {
    if (scannerComponent && typeof scannerComponent.toggleFlash === 'function') {
      scannerComponent.toggleFlash();
    }
  }
  
  function handleCameraDetected(event) {
    const { code, format } = event.detail;
    
    value = code;
    dispatch('scan', { code, format, source: 'camera' });
    
    if (autoSearch) {
      handleSearch(code, 'camera');
    }
    
    setTimeout(() => {
      value = '';
    }, 100);
  }
  
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      value = convertToEnglish(value);
      
      if (value && autoSearch) {
        handleSearch(value, 'device');
        value = '';
      } else {
        dispatch('emptySearch');
      }
    }
  }
  
  function handleSearch(code, source = 'manual') {
    if (!code) return;
    dispatch('search', { code, source });
  }
  
  function handleWindowKeydown(event) {
    if (event.key === 'Escape' && showBarcodeScanner) {
      closeBarcodeScanner();
    }
  }
  
  // ✅ 페이지 이동 후 - autoFocus 옵션일 때만
  afterNavigate(() => {
    if (browser && autoFocus) {
      setTimeout(() => {
        inputElement?.focus();
      }, 200);
    }
  });
  
  onMount(async () => {
    if (!browser) return;
    
    isMobile = checkMobile();
    
    // ✅ autoFocus 옵션일 때만 초기 포커스
    if (autoFocus) {
      await tick();
      setTimeout(() => {
        inputElement?.focus();
      }, 200);
    }
    
    // ✅ setInterval 제거함
    
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
    <input
      bind:this={inputElement}
      type="text"
      bind:value
      {placeholder}
      {disabled}
      on:keydown={handleKeydown}
      on:input
      on:focus
      on:blur={handleBlur}
      class="border border-gray-300 rounded focus:outline-none focus:border-blue-500 transition-colors bg-white"
      class:pr-8={showCameraButton}
      class:bg-gray-100={disabled}
      class:cursor-not-allowed={disabled}
      style="padding: 4px 8px; font-size: 0.75rem; width: 150px;"
      inputmode="latin"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      lang="en"
    />
    
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

{#if showBarcodeScanner && showCameraButton}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
    on:click={closeBarcodeScanner}
  ></div>
  
  <div
    class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-lg shadow-2xl transition-transform duration-300 ease-out"
    style="height: 35vh; padding-bottom: env(safe-area-inset-bottom);"
  >
    <div class="flex justify-center pt-1.5 pb-1">
      <div class="w-8 h-0.5 bg-gray-300 rounded-full"></div>
    </div>
    
    <div class="flex items-center justify-between px-3 py-1 border-b border-gray-200">
      <h3 class="text-xs font-semibold text-gray-900">바코드 스캔</h3>
      <div class="flex items-center gap-1">
        <button
          type="button"
          on:click={() => scannerComponent?.toggleZoom()}
          class="p-1 rounded transition-all text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          disabled={!scannerComponent}
          aria-label="줌"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
            <path d="M11 8v6M8 11h6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        
        <button
          type="button"
          on:click={handleFlashToggle}
          class="p-1 rounded transition-all"
          class:text-yellow-500={scannerComponent?.flashEnabled}
          class:bg-yellow-100={scannerComponent?.flashEnabled}
          class:text-gray-400={!scannerComponent?.flashEnabled}
          disabled={!scannerComponent}
          aria-label="플래시"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </button>
        
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
    
    <div class="overflow-hidden h-full">
      <div class="p-1.5 h-full">
        <div class="h-full flex items-center justify-center" style="max-height: calc(30vh - 40px);">
          <BarcodeScanner
            bind:this={scannerComponent}
            autoStart={true}
            continuous={false}
            debounceTime={1500}
            cameraFacing="environment"
            showManualInput={false}
            compactMode={true}
            on:detected={handleCameraDetected}
            on:error={(e) => dispatch('error', e.detail)}
          />
        </div>
      </div>
    </div>
  </div>
{/if}