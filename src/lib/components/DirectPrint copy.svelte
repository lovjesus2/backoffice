<!-- DirectPrint.svelte - 직접 TSC 바코드 출력 (iframe 제거) -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let isOpen = false;
  export let productData = null;
  export let autoPrint = false;
  
  let printConfig = {
    showText: true
  };
  
  // 출력 수량은 별도 관리 (항상 1장으로 초기화)
  let printQuantity = 1;
  
  let isPrinting = false;
  let printStatus = '준비됨';
  
  // 중복 출력 방지를 위한 전역 플래그
  let lastPrintTime = 0;
  
  // 프린터 서버 설정 (시스템 설정에서 가져올 수 있음)
  let printerServerUrl = '';
  
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
    // checkPrinterConnection(); // 필요시 연결 확인
    
    // autoPrint가 true면 자동으로 출력 실행
    if (autoPrint && productData) {
      printToTSC();
    }
  });
  
  // 시스템 설정에서 프린터 설정 로드
  async function loadPrinterSettings() {
    try {
      const response = await fetch('/api/system');
      const data = await response.json();
      
      if (data.success) {
        const settings = data.data;
        const computerSetting = settings.find(s => s.setting_key === 'output_computer_name');
        
        if (computerSetting && computerSetting.setting_value) {
          let computerName = computerSetting.setting_value.trim();
          
          // .local이 없으면 자동으로 추가
          if (!computerName.endsWith('.local')) {
            computerName += '.local';
          }
          
          printerServerUrl = `https://${computerName}:8443`;
          console.log('📡 프린터 서버 URL 설정:', printerServerUrl);
        }
      }
    } catch (error) {
      console.warn('프린터 설정 로드 실패, 기본값 사용:', error);
    }
  }
  
  // 프린터로 라벨 출력 (직접 fetch 방식)
  async function printToTSC() {
    if (!productData || isPrinting) return;
    
    const now = Date.now();
    if (now - lastPrintTime < 500) {
      const message = '너무 빠른 연속 출력입니다. 0.5초 후 다시 시도해주세요.';
      if (autoPrint) {
        dispatch('printError', { error: message, product: productData });
      } else {
        alert(message);
      }
      return;
    }
    
    lastPrintTime = now;
    isPrinting = true;
    printStatus = `라벨 출력 중... (${printQuantity}장)`;
    
    try {
      const printerCommands = generatePrinterCommands({
        productCode: productData.code,
        productName: productData.name,
        proudctPrice: '(' + (productData.price * 0.001) + ')',
        quantity: printQuantity
      });
      
      console.log('📦 프린터 명령어 전송:', printerCommands);
      
      const requestData = {
        commands: printerCommands,
        product: {
          code: productData.code,
          name: productData.name,
          price: productData.price
        },
        quantity: printQuantity
      };
      
      // 직접 fetch로 프린터 서버에 요청
      const response = await fetch(`${printerServerUrl}/print`, {
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
        
        // 자동 출력 모드일 때는 성공 이벤트 발생
        if (autoPrint) {
          dispatch('printSuccess', { 
            message: `바코드 출력 완료 (${printQuantity}장)`,
            product: productData,
            quantity: printQuantity
          });
        }
        
        setTimeout(() => {
          if (isOpen) closeModal();
        }, 1500);
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('프린터 출력 오류:', error);
      printStatus = '❌ 출력 오류';
      
      const errorMessage = error.message.includes('Failed to fetch') 
        ? '프린터 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.'
        : `프린터 오류: ${error.message}`;
      
      if (autoPrint) {
        dispatch('printError', { 
          error: errorMessage,
          product: productData 
        });
      } else {
        alert(errorMessage);
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
      alert('너무 빠른 연속 출력입니다. 0.5초 후 다시 시도해주세요.');
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
        quantity: printQuantity
      };
      
      const response = await fetch(`${printerServerUrl}/print`, {
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
      printStatus = '❌ QR 출력 오류';
      alert(`QR 출력 오류: ${error.message}`);
    } finally {
      setTimeout(() => {
        isPrinting = false;
        printStatus = '준비됨';
      }, 2000);
    }
  }
  
  // 프린터 명령어 생성 (30mm x 10mm 라벨) - TSC 형식
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
  
  function closeModal() {
    isOpen = false;
    printQuantity = 1; // 수량 초기화
  }
  
  // 직접 출력 함수 (외부에서 호출 가능)
  export function directPrint(quantity = null) {
    if (productData && !isPrinting) {
      if (quantity !== null) {
        printQuantity = quantity;
      }
      printToTSC();
    }
  }
  
  // QR 출력 함수 (외부에서 호출 가능)
  export function directPrintQR(qrCode, quantity = 1) {
    if (qrCode && !isPrinting) {
      printQuantity = quantity;
      printQRToTSC(qrCode);
    }
  }
  
</script>
