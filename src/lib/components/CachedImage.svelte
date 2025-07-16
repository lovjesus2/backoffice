<!-- src/lib/components/CachedImage.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { imageCache } from '$lib/utils/imageCache.js';

  // Props
  export let src = '';
  export let alt = '';
  export let fallbackSrc = '';
  export let width = '';
  export let height = '';
  export let className = '';
  export let placeholder = '/images/placeholder.png';
  export let lazy = true;
  export let quality = 'medium'; // low, medium, high

  // 내부 상태
  let imageUrl = '';
  let loading = true;
  let error = false;
  let retryCount = 0;
  let observer;
  let imageElement;
  let isVisible = !lazy;

  const dispatch = createEventDispatcher();
  const maxRetries = 3;

  // 이미지 로딩 함수
  async function loadImage() {
    if (!src || !isVisible) return;

    loading = true;
    error = false;
    
    try {
      // 캐시에서 이미지 가져오기
      const cachedUrl = await imageCache.getImage(src);
      imageUrl = cachedUrl;
      loading = false;
      
      dispatch('load', { src, cached: true });
      
    } catch (err) {
      console.error('이미지 로딩 실패:', src, err);
      
      // 재시도
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(() => loadImage(), 1000 * retryCount);
        return;
      }
      
      // 최종 실패 시 대체 이미지 사용
      if (fallbackSrc) {
        try {
          const fallbackUrl = await imageCache.getImage(fallbackSrc);
          imageUrl = fallbackUrl;
          loading = false;
          dispatch('fallback', { src, fallbackSrc });
        } catch (fallbackErr) {
          handleError();
        }
      } else {
        handleError();
      }
    }
  }

  function handleError() {
    loading = false;
    error = true;
    imageUrl = placeholder;
    dispatch('error', { src });
  }

  // Intersection Observer 설정 (지연 로딩)
  function setupIntersectionObserver() {
    if (!lazy || typeof window === 'undefined') return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            isVisible = true;
            loadImage();
            observer?.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    if (imageElement) {
      observer.observe(imageElement);
    }
  }

  onMount(() => {
    if (lazy) {
      setupIntersectionObserver();
    } else {
      loadImage();
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      
      // Blob URL 정리
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  });

  // src 변경 시 다시 로딩
  $: if (src && isVisible) {
    loadImage();
  }

  // 이미지 크기 계산
  $: imageStyle = [
    width ? `width: ${width}` : '',
    height ? `height: ${height}` : '',
  ].filter(Boolean).join('; ');

  // CSS 클래스 조합
  $: imageClasses = [
    'cached-image',
    className,
    loading ? 'loading' : '',
    error ? 'error' : '',
    quality ? `quality-${quality}` : ''
  ].filter(Boolean).join(' ');
</script>

<div 
  class="cached-image-container {imageClasses}"
  bind:this={imageElement}
  style={imageStyle}
>
  <!-- 로딩 스피너 -->
  {#if loading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <span class="loading-text">이미지 로딩중...</span>
    </div>
  {/if}

  <!-- 이미지 -->
  {#if imageUrl && !loading}
    <img
      src={imageUrl}
      {alt}
      class="cached-image-element"
      on:load={() => dispatch('loaded')}
      on:error={handleError}
    />
  {/if}

  <!-- 에러 상태 -->
  {#if error}
    <div class="error-overlay">
      <div class="error-icon">📷</div>
      <span class="error-text">이미지를 불러올 수 없습니다</span>
      <button 
        class="retry-button"
        on:click={() => {
          retryCount = 0;
          loadImage();
        }}
      >
        다시 시도
      </button>
    </div>
  {/if}
</div>

<style>
  .cached-image-container {
    position: relative;
    display: inline-block;
    overflow: hidden;
    background-color: #f5f5f5;
    border-radius: 8px;
    transition: all 0.3s ease;
  }

  .cached-image-element {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s ease;
  }

  /* 로딩 오버레이 */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.9);
    z-index: 1;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #e0e0e0;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 8px;
  }

  .loading-text {
    font-size: 12px;
    color: #666;
    text-align: center;
  }

  /* 에러 오버레이 */
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(248, 249, 250, 0.95);
    z-index: 1;
    padding: 16px;
  }

  .error-icon {
    font-size: 24px;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .error-text {
    font-size: 12px;
    color: #999;
    text-align: center;
    margin-bottom: 12px;
  }

  .retry-button {
    padding: 6px 12px;
    font-size: 11px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .retry-button:hover {
    background-color: #2980b9;
  }

  /* 품질별 스타일 */
  .quality-low {
    image-rendering: pixelated;
  }

  .quality-medium {
    image-rendering: auto;
  }

  .quality-high {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }

  /* 애니메이션 */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 반응형 스타일 */
  @media (max-width: 768px) {
    .cached-image-container {
      border-radius: 6px;
    }

    .loading-text,
    .error-text {
      font-size: 11px;
    }

    .spinner {
      width: 20px;
      height: 20px;
    }
  }

  /* 로딩 상태 스타일 */
  .cached-image-container.loading {
    min-height: 100px;
    min-width: 100px;
  }

  /* 에러 상태 스타일 */
  .cached-image-container.error {
    border: 1px dashed #ddd;
    background-color: #fafafa;
  }

  /* 호버 효과 */
  .cached-image-container:hover:not(.loading):not(.error) {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
</style>