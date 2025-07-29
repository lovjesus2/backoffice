<!-- src/lib/components/ImageModal.svelte의 수정된 부분만 -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { simpleCache } from '$lib/utils/simpleImageCache';

  const dispatch = createEventDispatcher();

  // Props
  export let show = false;
  export let imageSrc = '';
  export let imageAlt = '';
  export let zIndex = 50;

  // 내부 상태
  let loading = false;
  let error = false;
  let imageElement;

  // 모달이 열릴 때 로딩 상태 초기화
  $: if (show && imageSrc) {
    loading = true;
    error = false;
    
    // 모바일에서 스크롤 방지
    if (browser) {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
    }
  }

  // 모달이 닫힐 때 스크롤 복원
  $: if (!show && browser) {
    document.body.style.overflow = '';
  }

  // 🔧 이미지 캐시 함수 (로그 추가)
  async function cacheImage(event) {
    console.log('🖼️ 모달 이미지 캐시 시작:', event.target.src);
    
    if (browser && simpleCache) {
      try {
        await simpleCache.handleImage(event.target);
        console.log('✅ 모달 이미지 캐시 완료');
      } catch (error) {
        console.error('❌ 모달 이미지 캐시 실패:', error);
      }
    } else {
      console.warn('⚠️ simpleCache를 사용할 수 없습니다.');
    }
  }

  // 🔧 이미지 로드 완료 (로그 추가)
  function handleImageLoad(event) {
    console.log('🎯 모달 이미지 로드 완료:', event.target.src);
    loading = false;
    cacheImage(event);
  }

  // 이미지 로드 실패
  function handleImageError() {
    console.log('❌ 모달 이미지 로드 실패:', imageSrc);
    loading = false;
    error = true;
  }

  // 모달 닫기
  function closeModal() {
    show = false;
    dispatch('close');
  }

  // 다시 시도
  function retryImage() {
    loading = true;
    error = false;
    
    // 캐시 활용을 위해 원본 URL 그대로 재시도
    const tempSrc = imageSrc.split('?')[0]; // 혹시 있을 타임스탬프 제거
    const originalSrc = imageSrc;
    imageSrc = '';
    
    setTimeout(() => {
      imageSrc = originalSrc;
    }, 10);
  }

  // ESC 키 처리
  function handleKeydown(event) {
    if (event.key === 'Escape' && show) {
      closeModal();
    }
  }

  // 외부 클릭 처리
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div 
    class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-{zIndex}" 
    style="touch-action: none;" 
    on:click={handleOverlayClick}
  >
    <div 
      class="relative w-full h-full max-w-4xl max-h-screen p-4 flex items-center justify-center" 
      on:click|stopPropagation
    >
      
      <!-- 로딩 상태 -->
      {#if loading}
        <div class="flex items-center justify-center min-h-64 min-w-64">
          <div class="text-white text-center">
            <div class="text-4xl mb-3 animate-spin">🔄</div>
            <p>이미지 로딩 중...</p>
          </div>
        </div>
      {/if}
      
      <!-- 에러 상태 -->
      {#if error}
        <div class="flex items-center justify-center min-h-64 min-w-64">
          <div class="text-white text-center">
            <div class="text-4xl mb-3">❌</div>
            <p>이미지를 불러올 수 없습니다</p>
            <button 
              class="mt-3 px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors duration-200"
              style="touch-action: manipulation;"
              on:click={retryImage}
            >
              다시 시도
            </button>
          </div>
        </div>
      {/if}
      
      <!-- 확대된 이미지 -->
      {#if imageSrc && !error}
        <div class="relative">
          <!-- 닫기 버튼 - 이미지 위에 배치 -->
          <button 
            class="absolute top-2 right-2 text-white bg-black bg-opacity-70 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-90 transition-all duration-200 z-10"
            style="touch-action: manipulation;"
            on:click={closeModal}
          >
            ✕
          </button>
          
          <img 
            bind:this={imageElement}
            src={imageSrc}
            alt={imageAlt}
            class="max-w-full max-h-full object-contain rounded-lg shadow-2xl {loading ? 'hidden' : ''}"
            on:load={handleImageLoad}
            on:error={handleImageError}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}