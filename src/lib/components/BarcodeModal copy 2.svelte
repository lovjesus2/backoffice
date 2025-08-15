<!-- BarcodeModal.svelte - 수정된 버전 -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  export let isOpen = false;
  export let productData = null;
  
  let printConfig = {
    showText: true,
    configured: false,
    printCount: 0
  };
  
  let isPrinting = false;
  let printStatus = '준비됨';
  let barcodeCanvas;
  let JsBarcode = null;
  
  // 중복 출력 방지를 위한 전역 플래그
  let printWindowOpened = false;
  let lastPrintTime = 0;
  
  // PWA 모드 체크
  let isPWA = false;
  let isFirstPrint = false;
  
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
    checkPWA();
    loadConfig();
    loadBarcodeLibrary();
  });
  
  function checkPWA() {
    if (browser) {
      isPWA = window.matchMedia('(display-mode: standalone)').matches;
    }
  }
  
  // JsBarcode 라이브러리 로드
  async function loadBarcodeLibrary() {
    if (typeof window.JsBarcode !== 'undefined') {
      JsBarcode = window.JsBarcode;
      console.log('✅ JsBarcode 로드됨');
      return;
    }
    
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
      script.onload = () => {
        JsBarcode = window.JsBarcode;
        console.log('✅ JsBarcode CDN 로드 성공');
        if (isOpen && productData) {
          generateBarcode();
        }
      };
      script.onerror = () => {
        console.warn('❌ JsBarcode 로드 실패');
        printStatus = '바코드 라이브러리 로드 실패';
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
      isFirstPrint = !printConfig.configured;
    } catch (error) {
      console.error('설정 로드 오류:', error);
    }
  }
  
  // 바코드 생성 - 선명한 출력을 위한 설정
  function generateBarcode() {
    if (!productData || !JsBarcode || !barcodeCanvas) {
      console.log('바코드 생성 조건 미충족:', {productData, JsBarcode: !!JsBarcode, canvas: !!barcodeCanvas});
      return;
    }
    
    try {
      // 30mm x 20mm 실제 크기
      barcodeCanvas.width = 113;   // 30mm
      barcodeCanvas.height = 76;   // 20mm
      
      JsBarcode(barcodeCanvas, productData.code, {
        format: 'CODE128',
        width: 1,              // 바 너비 정수로 (선명도)
        height: 40,            // 바코드 높이 증가
        displayValue: printConfig.showText,
        fontSize: 12,          // 글씨 크기 증가
        fontOptions: 'bold',   // 굵은 글씨
        margin: 3,             // 적절한 여백
        background: '#ffffff',
        lineColor: '#000000',
        textMargin: 3,         // 텍스트 여백
        font: 'monospace'      // 고정폭 글꼴
      });
      
      console.log('✅ 바코드 생성 완료:', productData.code);
    } catch (error) {
      console.error('바코드 생성 실패:', error);
    }
  }
  
  // 바로 출력 - 미리보기 없이
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
      
      // 바코드 생성 확인
      generateBarcode();
      const barcodeImage = barcodeCanvas.toDataURL('image/png');
      
      // iframe으로 숨겨서 바로 출력
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: 30mm 20mm;
              margin: 0;
            }
            @media print {
              * {
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html {
                width: 30mm !important;
                height: 20mm !important;
                overflow: hidden !important;
              }
              body {
                width: 30mm !important;
                height: 20mm !important;
                max-height: 20mm !important;
                overflow: hidden !important;
                position: relative !important;
                page-break-after: avoid !important;
              }
              .label-container {
                position: absolute !important;
                top: 2mm !important;  /* 상단 여백 */
                left: 1mm !important;  /* 좌측 여백 */
                width: 28mm !important;
                height: 16mm !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
              }
              img {
                max-width: 28mm !important;
                max-height: 16mm !important;
                width: auto !important;
                height: auto !important;
                object-fit: contain !important;
              }
              /* 절대 두 번째 페이지 생성 금지 */
              body::after {
                display: none !important;
              }
            }
            /* 화면에서 보기 위한 스타일 */
            @media screen {
              body {
                padding: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f0f0f0;
              }
              .label-container {
                width: 30mm;
                height: 20mm;
                border: 1px solid #ccc;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <img src="${barcodeImage}" alt="barcode" />
          </div>
        </body>
        </html>
      `);
      doc.close();
      
      // 바로 출력 실행
      setTimeout(() => {
        iframe.contentWindow.print();
        
        // 출력 후 정리
        setTimeout(() => {
          document.body.removeChild(iframe);
          printWindowOpened = false;
          
          // 첫 출력 완료 처리
          if (isFirstPrint) {
            printConfig.configured = true;
            printConfig.printCount++;
            safeSetItem('barcodeConfig', JSON.stringify(printConfig));
            isFirstPrint = false;
            printStatus = '✅ 설정 저장 완료';
          }
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
        <h2 class="text-lg font-bold">
          바코드 출력
          {#if isPWA}
            <span class="text-xs bg-white/20 px-2 py-0.5 rounded ml-2">PWA</span>
          {/if}
        </h2>
      </div>
      <button on:click={closeModal} class="text-white hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center">
        ×
      </button>
    </div>
    
    {#if productData}
    <div class="p-6">
      
      <!-- 프린터 상태 -->
      <div class="mb-4 p-3 rounded-lg {printConfig.configured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full {printConfig.configured ? 'bg-green-500' : 'bg-yellow-500'}"></div>
          <span class="text-sm font-medium {printConfig.configured ? 'text-green-700' : 'text-yellow-700'}">{printStatus}</span>
        </div>
        {#if printConfig.configured}
          <div class="text-xs text-green-600 mt-1">✅ 설정 저장됨 (출력 {printConfig.printCount}회)</div>
        {:else}
          <div class="text-xs text-yellow-600 mt-1">⚠️ 첫 출력시 용지 설정 필요</div>
        {/if}
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
      
      <!-- 바코드 미리보기 (화면용 - 확대) -->
      <div class="bg-white border rounded-lg p-4 mb-4 text-center">
        <h3 class="text-sm font-medium text-gray-700 mb-3">바코드 미리보기 (실제 크기의 2배)</h3>
        {#if JsBarcode}
          <div class="flex justify-center" style="padding: 20px 0;">
            <canvas 
              bind:this={barcodeCanvas}
              class="border border-gray-200"
              style="transform: scale(2); transform-origin: center;"
            ></canvas>
          </div>
        {:else}
          <div class="border border-gray-200 p-8 bg-gray-50 rounded">
            <div class="text-4xl text-gray-400 mb-2">🏷️</div>
            <div class="text-sm text-gray-500">바코드 라이브러리 로드 중...</div>
          </div>
        {/if}
      </div>
      
      <!-- 출력 설정 -->
      <div class="space-y-4 mb-6">
        <div class="flex justify-between items-center">
          <label class="text-sm font-medium text-gray-700">바코드 텍스트 표시</label>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              bind:checked={printConfig.showText}
              on:change={() => {
                saveConfig();
                generateBarcode();
              }}
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
            출력 중...
          {:else if printWindowOpened}
            🔒 출력 대화상자 열림
          {:else}
            🏷️ 바로 출력
            {#if printConfig.configured}
              (Enter만 누르세요)
            {:else}
              (첫 설정 필요)
            {/if}
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
      <div class="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        {#if !printConfig.configured}
          🔥 첫 출력시 프린터 대화상자에서:<br>
          1. 프린터: TSC 선택<br>
          2. 용지 크기: 30x20mm<br>
          3. 여백: 없음<br>
          4. 배율: 100%<br>
          <span class="text-green-600">→ 이 설정은 자동 저장됩니다</span>
        {:else}
          ✅ 설정이 저장되었습니다.<br>
          출력 버튼 클릭 → Enter만 누르면 바로 출력됩니다.
        {/if}
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