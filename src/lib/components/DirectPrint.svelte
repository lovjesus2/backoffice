<!-- DirectPrint.svelte - 통합 프린터 출력 컴포넌트 -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let productData = null;
  export let receiptData = null;
  export let autoPrint = false;
  export let printType = 'barcode'; // 'barcode', 'receipt', 'qr'
  
  let printConfig = {
    showText: true
  };
  
  // 출력 수량은 별도 관리 (항상 1장으로 초기화)
  let printQuantity = 1;
  
  let isPrinting = false;
  let printStatus = '준비됨';
  let showCertError = false;
  let certErrorUrl = '';
  let certErrorType = '';
  
  // 중복 출력 방지를 위한 전역 플래그
  let lastPrintTime = 0;
  
  // 프린터 연결 상태
  let printerConnected = false;
  let printerStatus = '확인 중...';
  
  // 프린터 서버 설정 (컴퓨터명 기준)
  let serverUrl = 'https://LAPTOP-IN37RDJM.local:8443';
  
  // 프린터명들 (서버에 전달할 데이터)
  let barcodePrinterName = 'TSC_TTP-244_Pro';
  let receiptPrinterName = 'POS80';
  let computerName = 'LAPTOP-IN37RDJM';
  
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
  
  onMount(async () => {
    loadConfig();
    await loadPrinterSettings(); // 시스템 설정에서 프린터 정보 로드
    
    // autoPrint가 true면 자동으로 출력 실행
    if (autoPrint) {
      if (printType === 'receipt' && receiptData) {
        printToReceipt();
      } else if (printType === 'barcode' && productData) {
        printToBarcode();
      }
    }
  });
  
  // 시스템 설정에서 프린터 설정 로드
  async function loadPrinterSettings() {
    try {
      const response = await fetch('/api/system');
      const data = await response.json();
      
      if (data.success) {
        const settings = data.data;
        
        // 1. 컴퓨터명으로 서버 URL 구성
        const computerSetting = settings.find(s => s.setting_key === 'output_computer_name');
        if (computerSetting && computerSetting.setting_value) {
          computerName = computerSetting.setting_value.trim();
          let serverHost = computerName;
          if (!serverHost.endsWith('.local')) {
            serverHost += '.local';
          }
          serverUrl = `https://${serverHost}:8443`;
          console.log('🔡 프린터 서버 URL:', serverUrl);
        }
        
        // 2. 바코드 프린터명 저장
        const barcodeSetting = settings.find(s => s.setting_key === 'barcode_printer_name');
        if (barcodeSetting && barcodeSetting.setting_value) {
          barcodePrinterName = barcodeSetting.setting_value.trim();
          console.log('🔡 바코드 프린터명:', barcodePrinterName);
        }
        
        // 3. 영수증 프린터명 저장
        const receiptSetting = settings.find(s => s.setting_key === 'receipt_printer_name');
        if (receiptSetting && receiptSetting.setting_value) {
          receiptPrinterName = receiptSetting.setting_value.trim();
          console.log('🔡 영수증 프린터명:', receiptPrinterName);
        }
      }
    } catch (error) {
      console.warn('프린터 설정 로드 실패, 기본값 사용:', error);
    }
  }
  
  // 프린터 연결 확인 (직접 fetch 방식)
  async function checkPrinterConnection() {
    try {
      console.log('🔍 프린터 연결 확인 시도...', serverUrl);
      
      const response = await fetch(`${serverUrl}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        printerConnected = true;
        printerStatus = `연결됨 (${data.printer || 'Printer'})`;
        console.log('✅ 프린터 연결 확인:', data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      printerConnected = false;
      printerStatus = '연결 불가';
      console.warn('프린터 연결 실패:', error.message);
    }
  }
  
  // 바코드 프린터로 라벨 출력 (직접 fetch 방식)
  async function printToBarcode() {
    if (!productData || isPrinting) return;
    
    const now = Date.now();
    if (now - lastPrintTime < 500) {
      const message = '너무 빠른 연속 출력입니다. 0.5초 후 다시 시도해주세요.';
      if (autoPrint) {
        dispatch('printError', { error: message, product: productData });
      } else {
        console.error(message);
      }
      return;
    }
    
    lastPrintTime = now;
    isPrinting = true;
    printStatus = `바코드 출력 중... (${printQuantity}장)`;
    
    try {
      const printerCommands = generatePrinterCommands({
        productCode: productData.code,
        productName: productData.name,
        proudctPrice: '(' + parseFloat((productData.price / 1000).toFixed(1)) + ')',
        quantity: printQuantity
      });
      
      console.log('📦 바코드 명령어 전송:', printerCommands);
      
      const requestData = {
        commands: printerCommands,
        product: {
          code: productData.code,
          name: productData.name,
          price: productData.price
        },
        quantity: printQuantity,
        // 프린터명과 PC명을 서버에 전달
        printerName: barcodePrinterName,
        printerPC: computerName
      };
      
      // 컴퓨터명.local로 서버에 접속
      const response = await fetch(`${serverUrl}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        const result = await response.json();
        printStatus = `✅ 바코드 출력 완료! (${printQuantity}장)`;
        console.log('✅ 바코드 출력 성공:', result.message);
        
        if (autoPrint) {
          dispatch('printSuccess', { 
            message: `바코드 출력 완료 (${printQuantity}장)`,
            product: productData,
            quantity: printQuantity
          });
        }
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('바코드 출력 오류:', error);
      printStatus = '⌘ 출력 오류';
      
      const errorMessage = error.message.includes('Failed to fetch') 
        ? '프린터 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.'
        : `프린터 오류: ${error.message}`;
      
      // PWA 인증서 오류 처리
      if (error.message.includes('Failed to fetch') || error.message.includes('cert') || error.message.includes('SSL')) {
        showCertificateError(serverUrl, 'barcode');
      }
      
      if (autoPrint) {
        dispatch('printError', { 
          error: errorMessage,
          product: productData 
        });
      } else {
        console.error('바코드 출력 실패:', errorMessage);
      }
    } finally {
      setTimeout(() => {
        isPrinting = false;
        printStatus = '준비됨';
      }, 2000);
    }
  }
  
  // 영수증 프린터로 출력 (직접 fetch 방식)
  async function printToReceipt() {
    if (!receiptData || isPrinting) return;
    
    const now = Date.now();
    if (now - lastPrintTime < 500) {
      const message = '너무 빠른 연속 출력입니다. 0.5초 후 다시 시도해주세요.';
      if (autoPrint) {
        dispatch('printError', { error: message, receiptData: receiptData });
      } else {
        console.error(message);
      }
      return;
    }
    
    lastPrintTime = now;
    isPrinting = true;
    printStatus = '영수증 출력 중...';
    
    try {
      console.log('📦 영수증 데이터 전송:', receiptData);
      
      const requestData = {
        receiptData: {
          images: [],
          layout: generateReceiptLayout(receiptData)
        },
        // 프린터명과 PC명을 서버에 전달
        printerName: receiptPrinterName,
        printerPC: computerName
      };
      
      // 컴퓨터명.local로 서버에 접속
      const response = await fetch(`${serverUrl}/print-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        const result = await response.json();
        printStatus = `✅ 영수증 출력 완료!`;
        console.log('✅ 영수증 출력 성공:', result.message);
        
        if (autoPrint) {
          dispatch('printSuccess', { 
            message: `영수증 출력 완료`,
            receiptData: receiptData
          });
        }
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('영수증 출력 오류:', error);
      printStatus = '⌘ 출력 오류';
      
      const errorMessage = error.message.includes('Failed to fetch') 
        ? '프린터 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.'
        : `프린터 오류: ${error.message}`;
      
      // PWA 인증서 오류 처리
      if (error.message.includes('Failed to fetch') || error.message.includes('cert') || error.message.includes('SSL')) {
        showCertificateError(serverUrl, 'receipt');
      }
      
      if (autoPrint) {
        dispatch('printError', { 
          error: errorMessage,
          receiptData: receiptData 
        });
      } else {
        console.error('영수증 출력 실패:', errorMessage);
      }
    } finally {
      setTimeout(() => {
        isPrinting = false;
        printStatus = '준비됨';
      }, 2000);
    }
  }
  
  // QR 코드 출력용 함수
  async function printQRToTSC(qrCode) {
    if (!qrCode || isPrinting) return;
    
    const now = Date.now();
    if (now - lastPrintTime < 500) {
      console.error('너무 빠른 연속 출력입니다. 0.5초 후 다시 시도해주세요.');
      return;
    }
    
    lastPrintTime = now;
    isPrinting = true;
    printStatus = `QR 출력 중... (${printQuantity}장)`;
    
    try {
      const printerCommands = generateQRCommands({
        QrCode: qrCode,
        quantity: printQuantity
      });
      
      console.log('📦 QR 프린터 명령어 전송:', printerCommands);
      
      const requestData = {
        commands: printerCommands,
        qrCode: qrCode,
        quantity: printQuantity,
        // 프린터명과 PC명을 서버에 전달
        printerName: barcodePrinterName, // QR도 바코드 프린터 사용
        printerPC: computerName
      };
      
      const response = await fetch(`${serverUrl}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        const result = await response.json();
        printStatus = `✅ QR 출력 완료! (${printQuantity}장)`;
        console.log('✅ QR 출력 성공:', result.message);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('QR 출력 오류:', error);
      printStatus = '⌘ QR 출력 오류';
      
      // PWA 인증서 오류 처리
      if (error.message.includes('Failed to fetch') || error.message.includes('cert') || error.message.includes('SSL')) {
        showCertificateError(serverUrl, 'qr');
      }
      
      console.error(`QR 출력 오류: ${error.message}`);
    } finally {
      setTimeout(() => {
        isPrinting = false;
        printStatus = '준비됨';
      }, 2000);
    }
  }
  
  // 영수증 레이아웃 생성 (매출등록과 동일한 로직)
  function generateReceiptLayout(receiptData) {
    // 로고 이미지 처리 (있으면 추가)
    let logoLayoutItem = null;
    if (receiptData.logoImage) {
      logoLayoutItem = {
        type: 'logo',
        path: receiptData.logoImage,
        width: 500,
        align: 'center',
        marginBottom: 20,
        qrData: receiptData.qrUrl || '',
        qrX: receiptData.qrX || 0,
        qrY: receiptData.qrY || 0,
        qrSize: 120,
        qrText: '▲디지털 엽서',
        qrTextSize: 20
      };
    }
    
    // 영수증 레이아웃 정의 (매출등록과 동일)
    const receiptLayout = [
      // 로고 (있으면 추가)
      ...(logoLayoutItem ? [logoLayoutItem] : []),
      
      // 텍스트 로고 (로고 이미지 없을 때만)
      ...(!logoLayoutItem ? [{
        type: 'text',
        content: receiptData.storeName || 'AKOJEJU',
        fontSize: 32,
        bold: true,
        align: 'center',
        marginBottom: 20
      }] : []),
      
      // 일자
      {
        type: 'text',
        content: `일자  ${receiptData.date}`,
        fontSize: 22,
        align: 'left',
        marginBottom: 8
      },
      
      // 번호
      {
        type: 'text',
        content: `번호  ${receiptData.slipNo}`,
        fontSize: 22,
        align: 'left',
        marginBottom: 25
      },

      // 상품 리스트
      ...receiptData.items.map(item => ({
        type: 'product-line',
        name: item.itemName || item.itemCode || '',
        price: item.isCash ? (parseInt(item.cashPrice) || 0) : (parseInt(item.cardPrice) || 0),
        quantity: parseInt(item.quantity) || 0,
        total: parseInt(item.amount) || 0,
        fontSize: 22,
        marginBottom: 10
      })),
      
      // 공백
      {
        type: 'space',
        lines: 1
      },
      
      // 합계 - product-line 형식으로
      {
        type: 'product-line',
        name: '합계',
        price: 0,  // 단가는 표시 안 함
        quantity: receiptData.totalQty,
        total: receiptData.totalAmount,
        fontSize: 22,
        marginBottom: 25
      },
      
      // 웹사이트
      {
        type: 'text',
        content: receiptData.website || 'www.akojeju.com',
        fontSize: 22,
        align: 'center',
        marginBottom: 15
      }
    ];

    return receiptLayout;
  }
  
  // 바코드용 프린터 명령어 생성 (30mm x 10mm 라벨) - TSC 형식
  function generatePrinterCommands({ productCode, productName, proudctPrice, quantity = 1 }) {
    let commands = '';

    // SPEED 인쇄속도( 1.0(TTP-242만) , 1.5 , 2.0 , 3.0(TTP-243만) )
    commands += 'SPEED 3.0\r\n';
    // DENSITY 인쇄농도(0-15)
    commands += 'DENSITY 10\r\n';

    // SET CUTTER 커터사용유무 및 인쇄수량에 따른 커터 ( OFF , BATCH , pieces(0-127) )
    commands += 'SET CUTTER OFF\r\n';

    // SET RIBBON 사용유무( ON,OFF)
    commands += 'SET RIBBON ON\r\n';
  
    // SET PEEL 사용유무 ( ON , OFF )
    commands += 'SET PEEL OFF\r\n';

    // DIRECTION 인쇄방향(0, 1)
    commands += 'DIRECTION 1\r\n';

    // 라벨 크기 설정 (30mm x 10mm)
    commands += 'SIZE 30 mm, 10 mm\r\n';

    // GAP 라벨사이의 거리
    commands += 'GAP 3 mm, 0 mm\r\n';

    commands += 'REFERENCE 0, 0\r\n';   
    // 이미지 버퍼 지움 ( Memory Clear )
    commands += 'CLS\r\n';

    // 카운터(시리얼)설정
    commands += 'SET COUNTER @1 1\r\n';

    // 바코드 출력 (CODE128)
    commands += `BARCODE 20,15,"128",40,1,0,1,2,"${productCode}"\r\n`;
    
    // 제품코드 텍스트
    commands += `TEXT 160,60,"1",0,1,1,"${proudctPrice}"\r\n`;
    
    // 출력 명령
    commands += `PRINT ${quantity},1\r\n`;
    
    return commands;
  }

  // QR 코드용 프린터 명령어 생성
  function generateQRCommands({ QrCode, quantity = 1 }) {
    let commands = '';

    commands += 'SPEED 3.0\r\n';
    commands += 'DENSITY 10\r\n';
    commands += 'SET CUTTER OFF\r\n';
    commands += 'SET RIBBON ON\r\n';
    commands += 'SET PEEL OFF\r\n';
    commands += 'DIRECTION 1\r\n';
    commands += 'SIZE 30 mm, 10 mm\r\n';
    commands += 'GAP 3 mm, 0 mm\r\n';
    commands += 'REFERENCE 0, 0\r\n';   
    commands += 'CLS\r\n';
    commands += 'SET COUNTER @1 1\r\n';

    // QR 코드 출력 (좌우 2개)
    commands += `QRCODE 30,6,L,3,A,0,M2,"${QrCode}"\r\n`;
    commands += `QRCODE 145,6,L,3,A,0,M2,"${QrCode}"\r\n`;
    
    commands += `PRINT ${quantity},1\r\n`;
    
    return commands;
  }
  
  // PWA 인증서 오류 안내 표시
  function showCertificateError(serverUrl, type) {
    certErrorUrl = serverUrl;
    certErrorType = type;
    showCertError = true;
  }
  
  // 인증서 설정 페이지로 이동
  function openCertificatePage() {
    if (certErrorUrl) {
      // 새 창으로 열기 (PWA에서 브라우저로 이동)
      window.open(certErrorUrl, '_blank', 'noopener,noreferrer');
    }
  }
  
  // 안내창 닫기
  function closeCertError() {
    showCertError = false;
    certErrorUrl = '';
    certErrorType = '';
  }
  
  function loadConfig() {
    try {
      const saved = safeGetItem('barcodeConfig');
      if (saved) {
        const savedConfig = JSON.parse(saved);
        printConfig.showText = savedConfig.showText !== undefined ? savedConfig.showText : true;
      }
    } catch (error) {
      console.error('설정 로드 오류:', error);
    }
  }
  
  // 직접 출력 함수들 (외부에서 호출 가능)
  export function directPrintBarcode(productData, quantity = 1) {
    if (productData && !isPrinting) {
      if (quantity !== null) {
        printQuantity = quantity;
      }
      printType = 'barcode';
      printToBarcode();
    }
  }
  
  export function directPrintReceipt(receiptData) {
    if (receiptData && !isPrinting) {
      printType = 'receipt';
      printToReceipt();
    }
  }
  
  export function directPrintQR(qrCode, quantity = 1) {
    if (qrCode && !isPrinting) {
      printQuantity = quantity;
      printType = 'qr';
      printQRToTSC(qrCode);
    }
  }
  
  // 호환성을 위한 기존 함수들 (오버로드 방식)
  export function directPrint(typeOrQuantity = null, data = null, quantity = 1) {
    if (isPrinting) return;
    
    // 기존 방식 호환 (quantity만 전달하는 경우)
    if (typeof typeOrQuantity === 'number' && productData) {
      printQuantity = typeOrQuantity;
      printToBarcode();
      return;
    }
    
    // 새 방식 (타입 지정하는 경우)
    if (typeof typeOrQuantity === 'string') {
      const type = typeOrQuantity;
      switch(type) {
        case 'barcode':
          if (data || productData) {
            if (data) {
              // 임시로 productData 설정
              const originalData = productData;
              productData = data;
              printQuantity = quantity;
              printToBarcode();
              productData = originalData;
            } else {
              printQuantity = quantity;
              printToBarcode();
            }
          }
          break;
          
        case 'receipt':
          if (data || receiptData) {
            if (data) {
              // 임시로 receiptData 설정
              const originalData = receiptData;
              receiptData = data;
              printToReceipt();
              receiptData = originalData;
            } else {
              printToReceipt();
            }
          }
          break;
          
        case 'qr':
          if (data) {
            printQuantity = quantity;
            printQRToTSC(data);
          }
          break;
      }
      return;
    }
    
    // 기본값 (바코드, 기존 방식)
    if (productData) {
      printToBarcode();
    }
  }
  
</script>

<!-- DirectPrint 컴포넌트는 UI 없이 백그라운드에서 동작 -->

<!-- 출력 상태 표시 -->
{#if browser && printStatus !== '준비됨'}
  <div class="fixed bottom-4 right-4 z-50">
    <div class="bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-2 max-w-xs">
      <div class="flex items-center gap-2">
        {#if isPrinting}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        {/if}
        <span class="text-sm text-gray-700">{printStatus}</span>
      </div>
    </div>
  </div>
{/if}

<!-- PWA 인증서 오류 안내 모달 -->
{#if showCertError}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
      <!-- 헤더 -->
      <div class="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-t-xl">
        <div class="flex items-center gap-3">
          <div class="text-2xl">⚠️</div>
          <div>
            <h2 class="text-lg font-bold">인증서 설정 필요</h2>
            <p class="text-sm opacity-90">{certErrorType === 'barcode' ? '바코드' : certErrorType === 'receipt' ? '영수증' : 'QR'} 프린터 연결 실패</p>
          </div>
        </div>
      </div>
      
      <!-- 내용 -->
      <div class="p-6">
        <div class="mb-4">
          <h3 class="font-semibold text-gray-900 mb-2">PWA에서 프린터 사용 설정</h3>
          <p class="text-sm text-gray-600 mb-4">
            PWA에서 프린터를 사용하려면 먼저 브라우저에서 인증서를 승인해야 합니다.
          </p>
        </div>
        
        <!-- 단계별 안내 -->
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 class="font-medium text-gray-900 mb-2">설정 방법:</h4>
          <ol class="text-sm text-gray-700 space-y-1">
            <li><strong>1.</strong> PWA 설치하기 전에 먼저 모바일 브라우저에서</li>
            <li><strong>2.</strong> <code class="bg-gray-200 px-1 rounded text-xs">{certErrorUrl}</code> 접속</li>
            <li><strong>3.</strong> "고급" → "안전하지 않은 사이트로 이동" 클릭</li>
            <li><strong>4.</strong> 인증서 예외 추가 완료</li>
            <li><strong>5.</strong> 그 다음에 PWA 설치</li>
          </ol>
        </div>
        
        <!-- 버튼들 -->
        <div class="flex gap-3">
          <button
            on:click={openCertificatePage}
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <span>🔗</span>
            <span>브라우저에서 열기</span>
          </button>
          
          <button
            on:click={closeCertError}
            class="px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
          >
            닫기
          </button>
        </div>
        
        <!-- 추가 도움말 -->
        <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p class="text-xs text-blue-800">
            💡 <strong>팁:</strong> 인증서 승인 후에는 PWA에서 정상적으로 프린터를 사용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}