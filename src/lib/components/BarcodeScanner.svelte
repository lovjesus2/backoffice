<!-- src/lib/components/BarcodeScanner.svelte - 순수 스캔 엔진 -->
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let autoStart = true;
  export let continuous = true;
  export let debounceTime = 1500;
  export let cameraFacing = 'environment';
  export let barcodeFormats = ['code_128_reader'];
  export let compactMode = false;
  
  // 상태
  let isScanning = false;
  let scannerStatus = 'QuaggaJS 준비 중...';
  let lastScannedCode = null;
  let lastScannedTime = 0;
  let videoElement;
  let currentStream = null; // ✅ 스트림 참조 추가
  let videoTrack = null;
  let Quagga = null;
  let flashEnabled = false;
  
  // QuaggaJS 라이브러리 로드
  async function loadQuaggaJS() {
    if (typeof window !== 'undefined' && window.Quagga) {
      Quagga = window.Quagga;
      console.log('✅ QuaggaJS 이미 로드됨');
      return true;
    }
    
    try {
      const script = document.createElement('script');
      script.src = '/quagga.min.js';
      
      return new Promise((resolve, reject) => {
        script.onload = () => {
          if (typeof window !== 'undefined' && window.Quagga) {
            Quagga = window.Quagga;
            console.log('✅ QuaggaJS 로드 성공');
            resolve(true);
          } else {
            reject(new Error('QuaggaJS 로드 실패'));
          }
        };
        script.onerror = () => reject(new Error('QuaggaJS 스크립트 로드 실패'));
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('QuaggaJS 로드 오류:', error);
      return false;
    }
  }
  
  // 카메라 초기화 및 스캔 시작
  async function startScanning() {
    if (!Quagga || isScanning) return;
    
    scannerStatus = '카메라 시작 중...';
    
    try {
      await Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoElement,
          constraints: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            facingMode: cameraFacing,
            aspectRatio: { min: 1, max: 2 }
          }
        },
        locator: {
          patchSize: "large",
          halfSample: true
        },
        numOfWorkers: 4,
        multiple: false,
        frequency:5,
        decoder: {
          readers: barcodeFormats
        },
        locate: true
      }, (err) => {
        if (err) {
          console.error('❌ QuaggaJS 초기화 오류:', err);
          scannerStatus = '카메라 오류: ' + err.message;
          dispatch('error', { message: err.message, type: 'init' });
          return;
        }
        
        console.log('✅ QuaggaJS 초기화 완료');
        
        Quagga.start();
        isScanning = true;
        scannerStatus = '스캔 중...';
        
        // ✅ 스트림 참조 가져오기
        getCurrentStream();
        
        dispatch('started');
      });
      
      Quagga.onDetected(onBarcodeDetected);
      
    } catch (error) {
      console.error('❌ 스캔 시작 오류:', error);
      scannerStatus = '스캔 시작 실패: ' + error.message;
      dispatch('error', { message: error.message, type: 'start' });
    }
  }
  
  // ✅ 스트림 가져오기 함수 추가
  function getCurrentStream() {
    try {
      const video = videoElement?.querySelector('video');
      if (video && video.srcObject) {
        currentStream = video.srcObject;
        videoTrack = currentStream.getVideoTracks()[0];
        
        console.log('✅ 비디오 스트림 참조 저장 완료');
        console.log('📹 Track capabilities:', videoTrack.getCapabilities());
      } else {
        console.warn('⚠️ 비디오 요소나 스트림을 찾을 수 없음');
      }
    } catch (error) {
      console.error('❌ 스트림 가져오기 실패:', error);
    }
  }
  
  // 바코드 감지 핸들러
  function onBarcodeDetected(result) {
    if (!result || !result.codeResult) return;
    
    const code = result.codeResult.code;
    const format = result.codeResult.format;
    const currentTime = Date.now();
    
    if (code === lastScannedCode && (currentTime - lastScannedTime) < debounceTime) {
      return;
    }
    
    lastScannedCode = code;
    lastScannedTime = currentTime;
    
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    playBeep();
    
    scannerStatus = `✅ 인식: ${code}`;
    
    dispatch('detected', { code, format });
    
    setTimeout(() => {
      if (isScanning) {
        scannerStatus = '스캔 중...';
      }
    }, 1500);
  }
  
  // 비프음 재생
  function playBeep() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('비프음 재생 실패:', error);
    }
  }
  
  // 스캔 중지
  function stopScanning() {
    if (!Quagga || !isScanning) return;
    
    try {
      Quagga.stop();
      isScanning = false;
      scannerStatus = '스캔 중지됨';
      
      // ✅ 스트림 정리
      if (videoTrack) {
        videoTrack.stop();
        videoTrack = null;
      }
      currentStream = null;
      
      dispatch('stopped');
      console.log('✅ 스캔 중지');
    } catch (error) {
      console.error('스캔 중지 오류:', error);
    }
  }

  // ✅ 개선된 플래시 토글
  async function toggleFlash() {
    if (!videoTrack) {
      console.error('❌ videoTrack 없음');
      alert('카메라가 준비되지 않았습니다.');
      return;
    }
    
    try {
      const capabilities = videoTrack.getCapabilities();
      console.log('📹 카메라 capabilities:', capabilities);
      
      // 플래시 지원 여부 확인
      if (!capabilities.torch && !capabilities.fillLightMode) {
        console.warn('⚠️ 플래시 미지원');
        alert('이 디바이스는 플래시를 지원하지 않습니다.');
        return;
      }
      
      // ✅ 현재 상태 확인 후 반전
      const settings = videoTrack.getSettings();
      const newTorchState = !settings.torch;
      
      console.log('🔦 현재 플래시 상태:', settings.torch);
      console.log('🔦 새로운 플래시 상태:', newTorchState);
      
      // 플래시 적용
      if (capabilities.torch) {
        await videoTrack.applyConstraints({
          advanced: [{ torch: newTorchState }]
        });
      } else if (capabilities.fillLightMode) {
        await videoTrack.applyConstraints({
          advanced: [{ fillLightMode: newTorchState ? 'flash' : 'off' }]
        });
      }
      
      // ✅ 상태 업데이트
      flashEnabled = newTorchState;
      console.log('✅ 플래시 상태 변경 성공:', flashEnabled);
      
    } catch (error) {
      console.error('❌ 플래시 토글 실패:', error);
      alert('플래시 제어 실패: ' + error.message);
    }
  }
  
  onMount(async () => {
    if (!browser) return;
    
    scannerStatus = 'QuaggaJS 로딩 중...';
    
    const loaded = await loadQuaggaJS();
    if (!loaded) {
      scannerStatus = '라이브러리 로드 실패';
      return;
    }
    
    scannerStatus = 'QuaggaJS 준비 완료';
    
    if (autoStart) {
      setTimeout(() => startScanning(), 300);
    }
  });
  
  onDestroy(() => {
    if (browser && Quagga && isScanning) {
      stopScanning();
    }
  });
  
  export { startScanning, stopScanning, toggleFlash, flashEnabled };
</script>

<div class="w-full h-full">
  <div 
    class="relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
    bind:this={videoElement}
  >
    {#if !isScanning}
      <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 z-10">
        <svg class="{compactMode ? 'w-10 h-10' : 'w-16 h-16'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <p class="mt-2 {compactMode ? 'text-xs' : 'text-sm'}">카메라 대기 중</p>
      </div>
    {/if}
    
    {#if isScanning}
      <div 
        class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 border-2 border-green-500 rounded-lg pointer-events-none z-20"
        class:h-20={compactMode}
        class:max-w-xs={compactMode}
        class:h-36={!compactMode}
        class:max-w-md={!compactMode}
      >
        <div class="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"></div>
      </div>
    {/if}
    
    <div 
      class="absolute bottom-0 left-0 right-0 text-center text-white font-medium z-10"
      class:px-2={compactMode}
      class:py-1={compactMode}
      class:text-xs={compactMode}
      class:px-4={!compactMode}
      class:py-2={!compactMode}
      class:text-sm={!compactMode}
      style="background-color: rgba(0, 0, 0, 0.7);"
    >
      <span>{scannerStatus}</span>
    </div>
  </div>
</div>

<style>
  @keyframes scan {
    0%, 100% { top: 0; }
    50% { top: calc(100% - 2px); }
  }
  
  .animate-scan {
    animation: scan 2s linear infinite;
  }
  
  /* 비디오 전체 화면 채우기 */
  :global(video) {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }
</style>