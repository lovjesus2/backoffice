<!-- BarcodeModal.svelte - 중복 출력 문제 해결 버전 -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  export let isOpen = false;
  export let productData = null;
  
  let printConfig = {
    showText: true
  };
  
  let isPrinting = false;
  let printStatus = '준비됨';
  let barcodeCanvas;
  let JsBarcode = null;
  
  // 🔥 중복 출력 방지를 위한 전역 플래그
  let printWindowOpened = false;
  let lastPrintTime = 0;
  
  // localStorage 안전 접근
  function safeGetItem(key, defaultValue = null) {
    try {
      if (browser && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key) || defaultValue;
      }
    } catch (error) {
      console.warn('localStorage 접근 실패:', error);
    }
    return defaultValue;
  }
  
  function safeSetItem(key, value) {
    try {
      if (browser && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('localStorage 저장 실패:', error);
    }
  }
  
  onMount(() => {
    loadConfig();
    loadBarcodeLibrary();
  });
  
  // JsBarcode 라이브러리 로드
  async function loadBarcodeLibrary() {
    if (typeof window.JsBarcode !== 'undefined') {
      JsBarcode = window.JsBarcode;
      console.log('✅ JsBarcode 로드됨');
      return;
    }
    
    try {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
      script.onload = () => {
        JsBarcode = window.JsBarcode;
        console.log('✅ JsBarcode CDN 로드 성공');
        generateBarcode();
      };
      script.onerror = () => {
        console.warn('❌ JsBarcode 로드 실패');
        printStatus = '바코드 라이브러리 로드 실패 - 텍스트 라벨로 출력됩니다';
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('JsBarcode 로드 오류:', error);
    }
  }
  
  function loadConfig() {
    try {
      const saved = safeGetItem('barcodeConfig');
      if (saved) {
        printConfig = { ...printConfig, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('설정 로드 오류:', error);
    }
  }
  
  // 바코드 생성 (30mm x 20mm 라벨 전용)
  function generateBarcode() {
    if (!productData || !JsBarcode || !barcodeCanvas) return;
    
    try {
      // 30mm x 20mm 라벨에 맞는 바코드 크기 (픽셀 변환: 1mm ≈ 3.78px)
      barcodeCanvas.width = 113;   // 30mm = 113px
      barcodeCanvas.height = 76;   // 20mm = 76px
      
      JsBarcode(barcodeCanvas, productData.code, {
        format: 'CODE128',
        width: 1,              // 바 너비 최소
        height: 35,            // 바코드 높이 35px (라벨에 맞게)
        displayValue: printConfig.showText,
        fontSize: 8,           // 폰트 크기 작게
        margin: 2,             // 여백 최소
        background: '#ffffff',
        lineColor: '#000000'
      });
      
      console.log('✅ 30x20mm 라벨용 바코드 생성 완료');
    } catch (error) {
      console.error('바코드 생성 실패:', error);
    }
  }
  
  // 🔥 최대한 빠르게 바로 출력 (미리보기 최소화)
  async function printBarcode() {
    if (!productData || isPrinting) return;
    
    const now = Date.now();
    if (now - lastPrintTime < 2000) {
      alert('너무 빠른 연속 출력입니다. 2초 후 다시 시도해주세요.');
      return;
    }
    
    if (printWindowOpened) return;
    
    lastPrintTime = now;
    isPrinting = true;
    printWindowOpened = true;
    printStatus = '출력 중...';
    
    try {
      if (!JsBarcode) {
        alert('바코드 라이브러리가 로드되지 않았습니다.');
        return;
      }
      
      generateBarcode();
      const barcodeImage = barcodeCanvas.toDataURL('image/png');
      
      // 🔥 iframe으로 숨겨서 처리 (더 빠름)
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin:0!important; padding:0!important; }
            body { width:30mm!important; height:20mm!important; }
            img { 
              width:30mm!important; 
              height:20mm!important; 
              object-fit:contain!important; 
            }
            @page { 
              size:30mm 20mm!important; 
              margin:0!important; 
            }
          </style>
        </head>
        <body>
          <img src="${barcodeImage}" alt="barcode" />
        </body>
        </html>
      `);
      doc.close();
      
      // 🔥 iframe 로드되면 바로 출력
      setTimeout(() => {
        iframe.contentWindow.print();
        
        // 출력 후 정리
        setTimeout(() => {
          document.body.removeChild(iframe);
          printWindowOpened = false;
        }, 1000);
      }, 100);
      
      printStatus = '출력 완료!';
      
      // 모달 자동 닫기
      setTimeout(() => {
        if (isOpen) closeModal();
      }, 1500);
      
    } catch (error) {
      console.error('출력 오류:', error);
      printStatus = '출력 실패';
      alert('출력 실패: ' + error.message);
      printWindowOpened = false;
    } finally {
      setTimeout(() => {
        isPrinting = false;
        printStatus = '준비됨';
      }, 2000);
    }
  }
  
  function closeModal() {
    isOpen = false;
    // 🔥 모달 닫을 때 플래그 초기화
    printWindowOpened = false;
  }
  
  function saveConfig() {
    safeSetItem('barcodeConfig', JSON.stringify(printConfig));
  }
  
  // 반응형 바코드 생성
  $: if (isOpen && productData && JsBarcode && barcodeCanvas) {
    generateBarcode();
  }
</script>

{#if isOpen}
<!-- 모달 오버레이 -->
<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
  
  <!-- 모달 컨테이너 -->
  <div class="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
    
    <!-- 헤더 -->
    <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-xl flex justify-between items-center">
      <div class="flex items-center gap-2">
        <span class="text-2xl">🏷️</span>
        <h2 class="text-lg font-bold">바코드 1장 출력</h2>
      </div>
      <button on:click={closeModal} class="text-white hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center">
        ×
      </button>
    </div>
    
    {#if productData}
    <div class="p-6">
      
      <!-- 프린터 상태 -->
      <div class="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-green-500"></div>
          <span class="text-sm font-medium text-green-700">{printStatus}</span>
        </div>
        <div class="text-xs text-green-600 mt-1">🔥 중복 출력 방지 적용됨</div>
      </div>
      
      <!-- 제품 정보 -->
      <div class="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">제품코드</span>
            <span class="font-mono font-bold text-lg">{productData.code}</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-sm text-gray-600">제품명</span>
            <span class="font-medium text-right text-sm max-w-[60%]" title={productData.name}>
              {productData.name}
            </span>
          </div>
          {#if productData.price}
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">가격</span>
            <span class="font-bold text-blue-600">{productData.price.toLocaleString()}원</span>
          </div>
          {/if}
        </div>
      </div>
      
      <!-- 바코드 미리보기 -->
      <div class="bg-white border rounded-lg p-4 mb-4 text-center">
        <h3 class="text-sm font-medium text-gray-700 mb-3">바코드 미리보기</h3>
        {#if JsBarcode}
          <canvas 
            bind:this={barcodeCanvas}
            class="border border-gray-200 max-w-full"
          ></canvas>
        {:else}
          <div class="border border-gray-200 p-8 bg-gray-50 rounded">
            <div class="text-4xl text-gray-400 mb-2">🏷️</div>
            <div class="text-sm text-gray-500">바코드 라이브러리 로드 중...</div>
          </div>
        {/if}
      </div>
      
      <!-- 출력 설정 -->
      <div class="space-y-4 mb-6">
        
        <!-- 텍스트 표시 -->
        <div class="flex justify-between items-center">
          <label class="text-sm font-medium text-gray-700">바코드 텍스트 표시</label>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              bind:checked={printConfig.showText}
              on:change={saveConfig}
              disabled={isPrinting}
              class="sr-only peer"
            >
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
      </div>
      
      <!-- 출력 버튼 -->
      <div class="space-y-3">
        <button 
          on:click={printBarcode}
          disabled={isPrinting || printWindowOpened}
          class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
        >
          {#if isPrinting}
            <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
            출력 준비 중...
          {:else if printWindowOpened}
            🔒 출력 창 열림 (수동 출력)
          {:else}
            🏷️ 바코드 1장 출력
          {/if}
        </button>
        
        <button 
          on:click={closeModal}
          disabled={isPrinting}
          class="w-full bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors"
        >
          취소
        </button>
      </div>
      
      <!-- 안내 -->
      <div class="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
        🔥 중복 출력 방지: 새 창에서 수동으로 출력 버튼을 눌러주세요
      </div>
      
    </div>
    
    {:else}
    <div class="p-8 text-center text-gray-500">
      <div class="text-4xl mb-4">📦</div>
      <p>제품 정보가 없습니다.</p>
    </div>
    {/if}
    
  </div>
</div>
{/if}