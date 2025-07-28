<script>
  import { onMount } from 'svelte';
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
  
  function openImageModal(imagePath) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    const modalContent = `
      <div class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" onclick="this.closest('.image-modal').remove()">×</button>
          <img src="${getImageSrc(imagePath)}" alt="확대 이미지" class="modal-image" />
          <div class="modal-actions">
            <button onclick="downloadImage('${imagePath}')" class="modal-btn">다운로드</button>
            <button onclick="shareImage('${imagePath}')" class="modal-btn">공유</button>
            <button onclick="toggleFavorite('${imagePath}')" class="modal-btn">
              ${isFavorite(imagePath) ? '즐겨찾기 해제' : '즐겨찾기'}
            </button>
          </div>
        </div>
      </div>
    `;
    
    modal.innerHTML = modalContent;
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2000;
    `;
    
    // 전역 함수로 임시 등록
    window.downloadImage = downloadImage;
    window.shareImage = shareImage;
    window.toggleFavorite = toggleFavorite;
    
    document.body.appendChild(modal);
  }
  
  $: filteredImages = showFavoritesOnly 
    ? imagePaths.filter(path => isFavorite(path))
    : imagePaths;
    
  $: gridClass = `grid-cols-${gridSize}`;
</script>

<div class="pwa-gallery">
  <!-- 상단 컨트롤 바 -->
  <div class="gallery-header">
    <h2 class="gallery-title">
      {title}
      {#if offlineMode}
        <span class="offline-badge">오프라인</span>
      {/if}
      <span class="image-count">({filteredImages.length}장)</span>
    </h2>
    
    <div class="gallery-controls">
      <!-- 새로고침 버튼 -->
      <button 
        class="control-btn" 
        on:click={refreshGallery}
        title="새로고침"
      >
        🔄
      </button>
      
      <!-- 즐겨찾기 필터 -->
      <button 
        class="control-btn {showFavoritesOnly ? 'active' : ''}" 
        on:click={toggleFavoritesFilter}
        title="즐겨찾기만 보기"
      >
        ⭐
      </button>
      
      <!-- 그리드 크기 조절 -->
      <div class="grid-size-controls">
        {#each [2, 3, 4, 5] as size}
          <button 
            class="grid-btn {gridSize === size ? 'active' : ''}"
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
  <div class="image-grid {gridClass}">
    {#each filteredImages as imagePath, index}
      {@const src = getImageSrc(imagePath)}
      {@const cached = cachedImages.has(imagePath)}
      {@const favorite = isFavorite(imagePath)}
      
      <div class="image-item" on:click={() => openImageModal(imagePath)}>
        {#if src}
          <img 
            {src}
            alt="갤러리 이미지 {index + 1}"
            class="gallery-image"
            loading="lazy"
          />
        {:else}
          <div class="image-placeholder">
            <div class="placeholder-content">
              <span class="placeholder-icon">📷</span>
              <span class="placeholder-text">오프라인</span>
              <span class="placeholder-filename">{imagePath.split('/').pop()}</span>
            </div>
          </div>
        {/if}
        
        <!-- 이미지 오버레이 -->
        <div class="image-overlay">
          <div class="image-actions">
            <button 
              class="action-btn favorite-btn {favorite ? 'active' : ''}"
              on:click|stopPropagation={() => toggleFavorite(imagePath)}
              title={favorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
            >
              {favorite ? '⭐' : '☆'}
            </button>
            
            <button 
              class="action-btn download-btn"
              on:click|stopPropagation={() => downloadImage(imagePath)}
              title="다운로드"
            >
              📥
            </button>
            
            <button 
              class="action-btn share-btn"
              on:click|stopPropagation={() => shareImage(imagePath)}
              title="공유"
            >
              📤
            </button>
            
            {#if cached}
              <span class="cache-indicator" title="캐시됨">💾</span>
            {/if}
          </div>
          
          <div class="image-info">
            <span class="image-filename">{imagePath.split('/').pop()}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>
  
  <!-- 빈 상태 -->
  {#if filteredImages.length === 0}
    <div class="empty-state">
      {#if showFavoritesOnly}
        <div class="empty-icon">⭐</div>
        <h3>즐겨찾기가 비어있습니다</h3>
        <p>이미지를 클릭하고 ⭐ 버튼을 눌러 즐겨찾기에 추가하세요.</p>
        <button class="secondary-btn" on:click={toggleFavoritesFilter}>
          모든 이미지 보기
        </button>
      {:else if offlineMode}
        <div class="empty-icon">📵</div>
        <h3>오프라인 상태</h3>
        <p>인터넷 연결을 확인하고 다시 시도하거나, 캐시된 이미지를 확인하세요.</p>
        <button class="secondary-btn" on:click={refreshGallery}>
          다시 시도
        </button>
      {:else}
        <div class="empty-icon">📷</div>
        <h3>이미지가 없습니다</h3>
        <p>표시할 이미지가 없습니다.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pwa-gallery {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .gallery-title {
    font-size: 1.5rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .offline-badge {
    background: #ff4444;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }
  
  .image-count {
    background: #e9ecef;
    color: #495057;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .gallery-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .control-btn {
    background: #f5f5f5;
    border: 1px solid #ddd;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 40px;
  }
  
  .control-btn:hover {
    background: #e9e9e9;
  }
  
  .control-btn.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
  
  .grid-size-controls {
    display: flex;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
  }
  
  .grid-btn {
    background: white;
    border: none;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    border-right: 1px solid #ddd;
    transition: all 0.2s;
  }
  
  .grid-btn:last-child {
    border-right: none;
  }
  
  .grid-btn:hover {
    background: #f5f5f5;
  }
  
  .grid-btn.active {
    background: #007bff;
    color: white;
  }
  
  .image-grid {
    display: grid;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-cols-5 { grid-template-columns: repeat(5, 1fr); }
  
  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
    cursor: pointer;
    transition: transform 0.2s ease;
  }
  
  .image-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  .gallery-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  
  .image-item:hover .gallery-image {
    transform: scale(1.05);
  }
  
  .image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
                linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  }
  
  .placeholder-content {
    text-align: center;
    color: #999;
    padding: 1rem;
  }
  
  .placeholder-icon {
    display: block;
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .placeholder-text {
    display: block;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
  }
  
  .placeholder-filename {
    display: block;
    font-size: 0.75rem;
    opacity: 0.8;
    word-break: break-all;
  }
  
  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, 
      rgba(0,0,0,0.7) 0%, 
      transparent 30%, 
      transparent 70%, 
      rgba(0,0,0,0.7) 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.5rem;
  }
  
  .image-item:hover .image-overlay {
    opacity: 1;
  }
  
  .image-actions {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .image-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  
  .image-filename {
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .action-btn {
    background: rgba(255, 255, 255, 0.9);
    border: none;
    padding: 0.5rem;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .action-btn:hover {
    background: white;
    transform: scale(1.1);
  }
  
  .favorite-btn.active {
    background: #ffd700;
  }
  
  .cache-indicator {
    background: rgba(0, 123, 255, 0.9);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    margin-left: auto;
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #666;
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .empty-state h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #333;
  }
  
  .empty-state p {
    margin-bottom: 2rem;
    line-height: 1.6;
  }
  
  .secondary-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .secondary-btn:hover {
    background: #545b62;
  }
  
  /* 모달 스타일 */
  :global(.image-modal .modal-overlay) {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  
  :global(.image-modal .modal-content) {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  :global(.image-modal .modal-close) {
    position: absolute;
    top: -3rem;
    right: 0;
    background: rgba(255,255,255,0.9);
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    z-index: 10;
  }
  
  :global(.image-modal .modal-image) {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
  }
  
  :global(.image-modal .modal-actions) {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  :global(.image-modal .modal-btn) {
    background: rgba(255,255,255,0.9);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  :global(.image-modal .modal-btn:hover) {
    background: white;
    transform: translateY(-2px);
  }
  
  @media (max-width: 768px) {
    .gallery-header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .gallery-controls {
      justify-content: center;
    }
    
    .grid-cols-4,
    .grid-cols-5 {
      grid-template-columns: repeat(3, 1fr);
    }
    
    .image-overlay {
      opacity: 1;
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent 50%);
    }
    
    .image-actions {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      flex-direction: column;
    }
    
    :global(.image-modal .modal-actions) {
      flex-direction: column;
      width: 100%;
    }
    
    :global(.image-modal .modal-btn) {
      width: 100%;
    }
  }
  
  @media (max-width: 480px) {
    .grid-cols-3,
    .grid-cols-4,
    .grid-cols-5 {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .pwa-gallery {
      padding: 0.5rem;
    }
    
    .image-grid {
      gap: 0.5rem;
    }
  }
</style>