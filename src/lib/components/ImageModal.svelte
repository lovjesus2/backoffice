<!-- src/lib/components/ImageModal.svelte - simpleImageCache 적용 버전 -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { imageModalStore, closeImageModal } from '$lib/utils/imageModalUtils';
  import { simpleCache } from '$lib/utils/simpleImageCache.js';

  // store 구독
  $: ({ show, imageSrc, imagePath, imageAlt, zIndex } = $imageModalStore);

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
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <!-- 모달 컨테이너 -->
  <div 
    class="fixed bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-200 z-{zIndex} p-4"
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
      class="relative flex flex-col items-center max-w-6xl max-h-full" 
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
            class="absolute -top-2 -right-2 w-10 h-10 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 z-20 backdrop-blur-sm"
            style="touch-action: manipulation;"
            on:click={closeImageModal}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <img 
            bind:this={imgElement}
            src={actualSrc}
            alt={imageAlt}
            class="rounded-lg shadow-2xl transition-all duration-300 {loading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}"
            style="width: 300px; height: 300px; object-fit: cover;"
            on:load={handleImageLoad}
            on:error={handleImageError}
          />
          
          <!-- 이미지 로딩 오버레이 -->
          {#if loading}
            <div class="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg backdrop-blur-sm">
              <div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- 품목명 (이미지 바로 아래) -->
      {#if actualSrc && !error && !loading && imageAlt}
        <div class="mt-4 text-center">
          <div class="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium inline-block max-w-full">
            {imageAlt}
            <span class="ml-2 text-xs opacity-75">📦</span>
          </div>
        </div>
      {/if}
      
    </div>
  </div>
{/if}

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