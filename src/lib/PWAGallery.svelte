<script>
  import { onMount } from 'svelte';
  import { openImageModal } from '$lib/utils/imageModalUtils'; // 🔧 모달 함수 임포트
  import { 
    getCachedImage, 
    addToFavorites, 
    removeFromFavorites, 
    getFavorites,
    getSetting,
    saveSetting 
  } from './pwa.js';
  
  // 원본 이미지 경로들을 받아서 프록시 경로로 변환
  export let imagePaths = []; // ['folder/image1.jpg', 'folder/image2.jpg'] 형태
  export let title = '갤러리';
  
  let favorites = [];
  let offlineMode = false;
  let gridSize = 3;
  let showFavoritesOnly = false;
  let loading = false;
  let cachedImages = new Map();
  
  // 프록시 경로로 변환하는 함수
  function getProxyUrl(imagePath) {
    return `/proxy-images/${imagePath}`;
  }
  
  // 원본 이미지 URL 생성 (즐겨찾기 등에서 사용)
  function getOriginalUrl(imagePath) {
    return `https://image.kungkungne.synology.me/${imagePath}`;
  }
  
  onMount(async () => {
    // 즐겨찾기 목록 로드
    favorites = await getFavorites();
    
    // 설정 로드
    gridSize = await getSetting('gridSize', 3);
    showFavoritesOnly = await getSetting('showFavoritesOnly', false);
    
    // 네트워크 상태 감지
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // 캐시된 이미지 미리 로드
    preloadCachedImages();
  });
  
  function updateNetworkStatus() {
    offlineMode = !navigator.onLine;
  }
  
  async function preloadCachedImages() {
    for (const imagePath of imagePaths) {
      const proxyUrl = getProxyUrl(imagePath);
      const cached = await getCachedImage(proxyUrl);
      if (cached) {
        cachedImages.set(imagePath, URL.createObjectURL(cached.blob));
      }
    }
    cachedImages = cachedImages; // 반응성 트리거
  }
  
  async function toggleFavorite(imagePath) {
    const originalUrl = getOriginalUrl(imagePath);
    const isFavorite = favorites.some(fav => fav.url === originalUrl);
    
    if (isFavorite) {
      await removeFromFavorites(originalUrl);
      favorites = favorites.filter(fav => fav.url !== originalUrl);
      window.showToast('즐겨찾기에서 제거됨', 'info');
    } else {
      await addToFavorites(originalUrl, { 
        title, 
        imagePath,
        proxyUrl: getProxyUrl(imagePath)
      });
      favorites = [...favorites, { url: originalUrl, timestamp: Date.now() }];
      window.showToast('즐겨찾기에 추가됨', 'success');
    }
  }
  
  function isFavorite(imagePath) {
    const originalUrl = getOriginalUrl(imagePath);
    return favorites.some(fav => fav.url === originalUrl);
  }
  
  async function changeGridSize(size) {
    gridSize = size;
    await saveSetting('gridSize', size);
  }
  
  async function toggleFavoritesFilter() {
    showFavoritesOnly = !showFavoritesOnly;
    await saveSetting('showFavoritesOnly', showFavoritesOnly);
  }
  
  function getImageSrc(imagePath) {
    // 캐시된 이미지가 있으면 우선 사용
    if (cachedImages.has(imagePath)) {
      return cachedImages.get(imagePath);
    }
    
    // 오프라인 모드에서는 캐시된 이미지만 표시
    if (offlineMode) {
      return null;
    }
    
    return getProxyUrl(imagePath);
  }
  
  function refreshGallery() {
    window.location.reload();
  }
  
  function shareImage(imagePath) {
    const originalUrl = getOriginalUrl(imagePath);
    
    if (navigator.share) {
      navigator.share({
        title: '이미지 공유',
        text: '멋진 이미지를 공유합니다',
        url: originalUrl
      });
    } else {
      // 폴백: 클립보드에 복사
      navigator.clipboard.writeText(originalUrl);
      window.showToast('링크가 클립보드에 복사됨', 'info');
    }
  }
  
  function downloadImage(imagePath) {
    const link = document.createElement('a');
    link.href = getProxyUrl(imagePath);
    link.download = imagePath.split('/').pop() || 'image.jpg';
    link.click();
  }
  
  // 🔧 모달 열기 (imageModalUtils 함수 사용)
  function handleImageClick(imagePath) {
    console.log('🎯 PWAGallery 이미지 클릭:', imagePath);
    
    const imageSrc = getImageSrc(imagePath); // blob URL 또는 proxy URL
    const imageAlt = `갤러리 이미지 - ${imagePath.split('/').pop()}`;
    
    // imageModalUtils 함수 호출
    openImageModal(imageSrc, imageAlt, imagePath);
  }
  
  $: filteredImages = showFavoritesOnly 
    ? imagePaths.filter(path => isFavorite(path))
    : imagePaths;
    
  // 그리드 클래스 계산
  $: gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3', 
    4: 'grid-cols-4 md:grid-cols-4',
    5: 'grid-cols-4 md:grid-cols-5'
  }[gridSize] || 'grid-cols-3';
</script>

<div class="max-w-7xl mx-auto p-4">
  <!-- 상단 컨트롤 바 -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <div class="flex items-center gap-3">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        {title}
        {#if offlineMode}
          <span class="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
            오프라인
          </span>
        {/if}
      </h2>
      <span class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-sm">
        ({filteredImages.length}장)
      </span>
    </div>
    
    <div class="flex items-center gap-2 flex-wrap">
      <!-- 새로고침 버튼 -->
      <button 
        class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 min-w-[40px] flex items-center justify-center"
        on:click={refreshGallery}
        title="새로고침"
      >
        🔄
      </button>
      
      <!-- 즐겨찾기 필터 -->
      <button 
        class="p-2 rounded-lg transition-colors duration-200 min-w-[40px] flex items-center justify-center {showFavoritesOnly 
          ? 'bg-blue-500 text-white hover:bg-blue-600' 
          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
        }"
        on:click={toggleFavoritesFilter}
        title="즐겨찾기만 보기"
      >
        ⭐
      </button>
      
      <!-- 그리드 크기 조절 -->
      <div class="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        {#each [2, 3, 4, 5] as size}
          <button 
            class="px-3 py-2 text-sm transition-colors duration-200 {gridSize === size 
              ? 'bg-blue-500 text-white' 
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            } {size !== 5 ? 'border-r border-gray-200 dark:border-gray-600' : ''}"
            on:click={() => changeGridSize(size)}
            title="{size}열"
          >
            {size}
          </button>
        {/each}
      </div>
    </div>
  </div>
  
  <!-- 이미지 그리드 -->
  <div class="grid {gridCols} gap-4 mb-8">
    {#each filteredImages as imagePath, index}
      {@const src = getImageSrc(imagePath)}
      {@const cached = cachedImages.has(imagePath)}
      {@const favorite = isFavorite(imagePath)}
      
      <div 
        class="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl group"
        on:click={() => handleImageClick(imagePath)}
      >
        {#if src}
          <img 
            {src}
            alt="갤러리 이미지 {index + 1}"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
            <div class="text-center text-gray-500 dark:text-gray-400 p-4">
              <div class="text-4xl mb-2">📷</div>
              <p class="text-sm mb-1">오프라인</p>
              <p class="text-xs opacity-80 break-all">{imagePath.split('/').pop()}</p>
            </div>
          </div>
        {/if}
        
        <!-- 이미지 오버레이 -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/70 opacity-0 group-hover:opacity-100 md:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
          <!-- 상단 액션 버튼들 -->
          <div class="flex gap-2 justify-end">
            <button 
              class="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all duration-200 hover:scale-110 {favorite ? 'text-yellow-500' : 'text-gray-600'}"
              on:click|stopPropagation={() => toggleFavorite(imagePath)}
              title={favorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
            >
              {favorite ? '⭐' : '☆'}
            </button>
            
            <button 
              class="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-600 flex items-center justify-center transition-all duration-200 hover:scale-110"
              on:click|stopPropagation={() => downloadImage(imagePath)}
              title="다운로드"
            >
              📥
            </button>
            
            <button 
              class="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-600 flex items-center justify-center transition-all duration-200 hover:scale-110"
              on:click|stopPropagation={() => shareImage(imagePath)}
              title="공유"
            >
              📤
            </button>
          </div>
          
          <!-- 하단 정보 -->
          <div class="flex justify-between items-end">
            <div class="bg-black/70 text-white px-2 py-1 rounded text-xs max-w-full truncate">
              {imagePath.split('/').pop()}
            </div>
            
            {#if cached}
              <div class="bg-blue-500/90 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                💾
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
  
  <!-- 빈 상태 -->
  {#if filteredImages.length === 0}
    <div class="text-center py-16 px-4">
      {#if showFavoritesOnly}
        <div class="text-6xl mb-4 opacity-50">⭐</div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">즐겨찾기가 비어있습니다</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          이미지를 클릭하고 ⭐ 버튼을 눌러 즐겨찾기에 추가하세요.
        </p>
        <button 
          class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
          on:click={toggleFavoritesFilter}
        >
          모든 이미지 보기
        </button>
      {:else if offlineMode}
        <div class="text-6xl mb-4 opacity-50">📵</div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">오프라인 상태</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          인터넷 연결을 확인하고 다시 시도하거나, 캐시된 이미지를 확인하세요.
        </p>
        <button 
          class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
          on:click={refreshGallery}
        >
          다시 시도
        </button>
      {:else}
        <div class="text-6xl mb-4 opacity-50">📷</div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">이미지가 없습니다</h3>
        <p class="text-gray-600 dark:text-gray-400">표시할 이미지가 없습니다.</p>
      {/if}
    </div>
  {/if}
</div>

<!-- 🔧 전역 ImageModal 컴포넌트 (store 기반) -->
<ImageModal />