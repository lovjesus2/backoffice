<!-- BarcodeModal.svelte - TSC 프린터 연동 버전 -->
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
  
  // 중복 출력 방지를 위한 전역 플래그
  let printWindowOpened = false;
  let lastPrintTime = 0;
  
  // TSC 프린터 연결 상태
  let tscConnected = false;
  let tscStatus = '확인 중...';
  
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
    checkTSCConnection();
  });
  
  // TSC 프린터 연결 확인 (iframe 방식 - Base64)
  async function checkTSCConnection() {
    try {
      console.log('🔍 TSC 연결 확인 시도... (iframe 방식)');
      
      const result = await accessTSCViaIframe('https://localhost:8443/status', 'GET');
      
      if (result.success) {
        const data = result.data;
        tscConnected = true;
        tscStatus = `연결됨 (${data.printer || 'TSC'})`;
        console.log('✅ TSC 프린터 연결 확인:', data);
      } else {
        tscConnected = false;
        tscStatus = result.error || '연결 실패';
      }
    } catch (error) {
      tscConnected = false;
      tscStatus = '연결 불가';
      console.error('TSC 연결 실패:', error.message);
    }
  }
  
  // iframe을 통한 TSC 접근 (단순화 버전) - 문자열 생성 방식 변경
  function accessTSCViaIframe(url, method = 'GET', body = null) {
    return new Promise((resolve) => {
      if (!browser) {
        resolve({ success: false, error: '브라우저 환경이 아님' });
        return;
      }
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden;';
      document.body.appendChild(iframe);
      
      const cleanup = () => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };
      
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ success: false, error: '타임아웃' });
      }, 5000);
      
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          cleanup();
          resolve({ success: false, error: 'iframe 문서 접근 불가' });
          return;
        }
        
        const messageHandler = (event) => {
          if (event.data && event.data.type === 'tsc_success') {
            clearTimeout(timeout);
            window.removeEventListener('message', messageHandler);
            cleanup();
            resolve({ success: true, data: event.data.data });
          } else if (event.data && event.data.type === 'tsc_error') {
            clearTimeout(timeout);
            window.removeEventListener('message', messageHandler);
            cleanup();
            resolve({ success: false, error: event.data.error });
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // iframe의 전역 객체에 데이터 설정
        const iframeWindow = iframe.contentWindow;
        iframeWindow.tscUrl = url;
        iframeWindow.tscMethod = method;
        iframeWindow.tscBody = body;
        
        // script 요소를 직접 생성하여 주입하는 방식으로 변경
        const scriptEl = doc.createElement('script');
        scriptEl.textContent = 'var opts = {method: window.tscMethod}; if (window.tscMethod === "POST" && window.tscBody) { opts.headers = {"Content-Type": "application/json"}; opts.body = JSON.stringify(window.tscBody); } fetch(window.tscUrl, opts).then(function(r) { return r.json(); }).then(function(d) { parent.postMessage({type: "tsc_success", data: d}, "*"); }).catch(function(e) { parent.postMessage({type: "tsc_error", error: e.message}, "*"); });';
        
        doc.head.appendChild(scriptEl);
        
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        resolve({ success: false, error: error.message });
      }
    });
  }
  
  // TSC 프린터로 라벨 출력 (iframe 방식)
  async function printToTSC() {
    if (!productData || isPrinting) return;
    
    const now = Date.now();
    if (now - lastPrintTime < 2000) {
      alert('너무 빠른 연속 출력입니다. 2초 후 다시 시도해주세요.');
      return;
    }
    
    lastPrintTime = now;
    isPrinting = true;
    printStatus = 'TSC 출력 중...';
    
    try {
      const tscCommands = generateTSCCommands({
        productCode: productData.code,
        productName: productData.name,
        showText: printConfig.showText
      });
      
      console.log('📦 TSC 명령어 전송:', tscCommands);
      
      const requestData = {
        commands: tscCommands,
        product: {
          code: productData.code,
          name: productData.name,
          price: productData.price
        }
      };
      
      const result = await accessTSCViaIframe('https://localhost:8443/print', 'POST', requestData);
      
      if (result.success) {
        printStatus = '✅ TSC 출력 완료!';
        console.log('✅ TSC 출력 성공:', result.data?.message);
        
        setTimeout(() => {
          if (isOpen) closeModal();
        }, 1500);
      } else {
        printStatus = '❌ TSC 출력 실패';
        alert('TSC 출력 실패: ' + result.error);
      }
      
    } catch (error) {
      console.error('TSC 출력 오류:', error);
      printStatus = '❌ 출력 오류';
      alert('TSC 프린터 오류: ' + error.message);
    } finally {
      setTimeout(() => {
        isPrinting = false;
        printStatus = '준비됨';
      }, 2000);
    }
  }
  
  // TSC 명령어 생성 (30mm x 20mm 라벨)
  function generateTSCCommands({ productCode, productName, showText }) {
    let commands = '';
    
    // 라벨 크기 설정 (30mm x 20mm)
    commands += 'SIZE 30 mm, 20 mm\r\n';
    commands += 'CLS\r\n';
    
    // 바코드 출력 (CODE128)
    // 위치: x=20, y=30 (라벨 중앙 상단)
    // 높이: 40도트, 폭: 2도트
    commands += `BARCODE 20,30,"128",40,1,0,2,2,"${productCode}"\r\n`;
    
    // 텍스트 출력 (제품명)
    if (showText && productName) {
      // 제품명이 길면 잘라서 출력
      const shortName = productName.length > 15 ? productName.substring(0, 15) + '...' : productName;
      // 위치: x=20, y=80 (바코드 아래)
      commands += `TEXT 20,80,"1",0,1,1,"${shortName}"\r\n`;
    }
    
    // 제품코드 텍스트 (항상 출력)
    // 위치: x=20, y=100 (하단)
    commands += `TEXT 20,100,"1",0,1,1,"${productCode}"\r\n`;
    
    // 출력 명령 (1장)
    commands += 'PRINT 1,1\r\n';
    
    return commands;
  }
  
  // JsBarcode 라이브러리 로드 (미리보기용)
  async function loadBarcodeLibrary() {
    if (!browser) return;
    
    if (typeof window !== 'undefined' && window.JsBarcode) {
      JsBarcode = window.JsBarcode;
      console.log('✅ JsBarcode 로드됨');
      return;
    }
    
    try {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
      script.onload = () => {
        if (typeof window !== 'undefined') {
          JsBarcode = window.JsBarcode;
          console.log('✅ JsBarcode CDN 로드 성공');
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
    } catch (error) {
      console.error('설정 로드 오류:', error);
    }
  }
  
  // 바코드 생성 (미리보기용 - 30mm x 20mm 라벨 전용)
  function generateBarcode() {
    if (!productData || !JsBarcode || !barcodeCanvas || !browser) return;
    
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
  
  function closeModal() {
    isOpen = false;
    // 모달 닫을 때 플래그 초기화
    printWindowOpened = false;
  }
  
  function saveConfig() {
    safeSetItem('barcodeConfig', JSON.stringify(printConfig));
  }
  
  // 반응형 바코드 생성
  $: if (isOpen && productData && JsBarcode && barcodeCanvas) {
    generateBarcode();
  }
  
  // 모달이 열릴 때마다 TSC 연결 상태 확인
  $: if (isOpen) {
    checkTSCConnection();
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
        <span class="text-2xl">🖨️</span>
        <h2 class="text-lg font-bold">TSC 바코드 출력</h2>
      </div>
      <button on:click={closeModal} class="text-white hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center">
        ×
      </button>
    </div>
    
    {#if productData}
    <div class="p-6">
      
      <!-- TSC 프린터 상태 -->
      <div class="mb-4 p-3 rounded-lg border {tscConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full {tscConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
          <span class="text-sm font-medium {tscConnected ? 'text-green-700' : 'text-red-700'}">
            TSC 프린터: {tscStatus}
          </span>
          <button 
            on:click={checkTSCConnection}
            class="ml-auto text-xs px-2 py-1 rounded {tscConnected ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}"
          >
            새로고침
          </button>
        </div>
        <div class="text-xs {tscConnected ? 'text-green-600' : 'text-red-600'} mt-1">
          {tscConnected ? '🔥 TSC TTP-244 Pro 연결됨' : '⚠️ TSC 에이전트 실행 필요'}
        </div>
      </div>
      
      <!-- 출력 상태 -->
      <div class="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-blue-500"></div>
          <span class="text-sm font-medium text-blue-700">{printStatus}</span>
        </div>
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
        <h3 class="text-sm font-medium text-gray-700 mb-3">바코드 미리보기 (30×20mm)</h3>
        {#if JsBarcode}
          <canvas 
            bind:this={barcodeCanvas}
            class="border border-gray-200 max-w-full"
          ></canvas>
          <div class="text-xs text-gray-500 mt-2">실제 TSC 출력과 다를 수 있음</div>
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
          <label class="text-sm font-medium text-gray-700">제품명 텍스트 출력</label>
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
          on:click={printToTSC}
          disabled={isPrinting}
          class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
        >
          {#if isPrinting}
            <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
            TSC 출력 중...
          {:else}
            🖨️ TSC 바코드 출력
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
        🖨️ TSC TTP-244 Pro 전용 30×20mm 라벨 출력<br>
        🔧 iframe 방식으로 CSP 우회 접근<br>
        {tscConnected ? '✅ 연결 상태: 정상' : '⚠️ TSC 에이전트를 먼저 실행하세요'}
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