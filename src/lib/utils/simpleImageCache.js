/**
 * IndexedDB 이미지 캐시 (DOM 독립적 + groupKey 자동 추출 버전)
 */
class SimpleImageCache {
  constructor() {
    this.dbName = 'SimpleImageCache';
    this.dbVersion = 2;
    this.storeName = 'images';
    this.db = null;
    this.blobUrls = new Map();
    this.pendingRequests = new Map();
  }

  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'url' });
          store.createIndex('etag', 'etag', { unique: false });
          store.createIndex('groupKey', 'groupKey', { unique: false });
        } else if (event.oldVersion < 2) {
          const transaction = event.target.transaction;
          const store = transaction.objectStore(this.storeName);
          if (!store.indexNames.contains('groupKey')) {
            store.createIndex('groupKey', 'groupKey', { unique: false });
          }
        }
      };
    });
  }

  async getFromCache(url) {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async saveToCache(url, blob, etag, groupKey = null) {
    await this.init();
    const data = { url, blob, etag, groupKey, savedAt: Date.now() };
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async checkETag(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return response.headers.get('etag');
    } catch (err) {
      console.warn('[checkETag] 실패', url, err);
      return null;
    }
  }

  // URL에서 제품코드 추출
  extractProductCode(url) {
    try {
      const fileName = this.extractFileName(url);
      const match = fileName.match(/^(.+)_\d+\.\w+$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // 🔥 기존 handleImage에 groupKey 자동 추출 추가
  async handleImage(imgElement) {
    const originalUrl = imgElement.src;
    if (!originalUrl || originalUrl.startsWith('blob:')) return;

    const currentSrc = originalUrl;
    
    if (this.pendingRequests.has(imgElement)) {
      this.pendingRequests.get(imgElement).forEach(req => req.cancelled = true);
    }
    
    if (!this.pendingRequests.has(imgElement)) {
      this.pendingRequests.set(imgElement, []);
    }

    const requestId = Date.now() + Math.random();
    const requestInfo = { cancelled: false, id: requestId, url: currentSrc };
    
    this.pendingRequests.get(imgElement).push(requestInfo);

    try {
      const cached = await this.getFromCache(originalUrl);
      
      if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
        return;
      }
      
      if (cached) {
        const currentETag = await this.checkETag(originalUrl);
        
        if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
          return;
        }
        
        if (cached.etag === currentETag) {
          if (this.setImageSafely(imgElement, originalUrl, cached.blob, requestInfo, currentSrc)) {
            console.log('캐시 사용:', originalUrl);
          }
          return;
        }
      }

      const response = await fetch(originalUrl);
      
      if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
        return;
      }
      
      if (response.ok) {
        const blob = await response.blob();
        const etag = response.headers.get('etag');
        
        if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
          return;
        }
        
        // 🔥 groupKey 자동 추출 후 저장
        const groupKey = this.extractProductCode(originalUrl);
        await this.saveToCache(originalUrl, blob, etag, groupKey);
        
        if (this.setImageSafely(imgElement, originalUrl, blob, requestInfo, currentSrc)) {
          console.log('새 이미지 캐시됨:', originalUrl, 'groupKey:', groupKey);
        }
      }
      
    } catch (error) {
      console.log('캐싱 실패:', originalUrl, error);
    } finally {
      this.cleanupRequest(imgElement, requestInfo);
    }
  }

  isRequestInvalid(imgElement, requestInfo, originalSrc) {
    return requestInfo.cancelled || 
           imgElement.src !== originalSrc || 
           !document.contains(imgElement);
  }

  setImageSafely(imgElement, originalUrl, blob, requestInfo, originalSrc) {
    if (this.isRequestInvalid(imgElement, requestInfo, originalSrc)) {
      console.log('이미지 설정 취소됨:', originalUrl);
      return false;
    }
    
    if (this.blobUrls.has(originalUrl)) {
      URL.revokeObjectURL(this.blobUrls.get(originalUrl));
    }
    
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrls.set(originalUrl, blobUrl);
    
    if (imgElement.src === originalSrc) {
      imgElement.src = blobUrl;
      return true;
    }
    
    return false;
  }

  cleanupRequest(imgElement, requestInfo) {
    if (this.pendingRequests.has(imgElement)) {
      const requests = this.pendingRequests.get(imgElement);
      const index = requests.findIndex(req => req.id === requestInfo.id);
      if (index > -1) {
        requests.splice(index, 1);
      }
      
      if (requests.length === 0) {
        this.pendingRequests.delete(imgElement);
      }
    }
  }

  // ============= 🔥 DOM 독립적 이미지 캐싱 (새로 추가) =============
  
  // 핵심 함수: 제품코드로 모든 이미지 조회/캐싱
  async getOrCacheImages(productCode, imagGub1 = 'PROD', imagGub2 = 'IMG') {
    if (!productCode) return [];
    
    console.log(`🔍 이미지 조회/캐싱: ${productCode}`);
    
    try {
      // 1. 캐시에서 먼저 확인
      const cachedImages = await this.getImagesByGroup(productCode);
      
      if (cachedImages.length > 0) {
        console.log(`✅ 캐시에서 발견: ${cachedImages.length}개`);
        return cachedImages;
      }
      
      // 2. 캐시에 없으면 서버에서 가져와서 캐싱
      console.log(`📡 서버에서 이미지 조회: ${productCode}`);
      const serverImages = await this.fetchImagesFromServer(productCode, imagGub1, imagGub2);
      
      if (serverImages.length > 0) {
        // 3. 각 이미지 다운로드해서 캐시에 저장
        await this.cacheImageList(serverImages, productCode);
        
        // 4. 캐시에서 다시 조회해서 반환
        return await this.getImagesByGroup(productCode);
      }
      
      return [];
      
    } catch (error) {
      console.error(`❌ 이미지 조회/캐싱 실패: ${productCode}`, error);
      return [];
    }
  }

  // 서버에서 이미지 리스트 조회
  async fetchImagesFromServer(productCode, imagGub1, imagGub2) {
    try {
      const response = await fetch('/api/images/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagGub1: imagGub1,
          imagGub2: imagGub2,
          imagCode: productCode
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.images) {
        return data.images.filter(img => img.exists !== false);
      }
      
      return [];
      
    } catch (error) {
      console.error('서버 이미지 조회 실패:', error);
      return [];
    }
  }

  // 이미지 리스트를 캐시에 저장
  async cacheImageList(imageList, productCode) {
    if (!imageList || imageList.length === 0) return;
    
    console.log(`💾 이미지 캐싱 시작: ${productCode} (${imageList.length}개)`);
    
    const cachePromises = imageList.map(async (img, index) => {
      try {
        const imageUrl = `/proxy-images/${img.name}`;
        
        const response = await fetch(imageUrl, { cache: 'no-store' });
        
        if (response.ok) {
          const blob = await response.blob();
          const etag = response.headers.get('ETag') || `${Date.now()}-${index}`;
          
          // groupKey와 함께 캐시에 저장
          await this.saveToCache(imageUrl, blob, etag, productCode);
          console.log(`✅ 캐시 완료: ${img.name}`);
        }
        
      } catch (err) {
        console.error(`❌ 개별 캐싱 실패: ${img.name}`, err);
      }
    });
    
    await Promise.allSettled(cachePromises);
    console.log(`🎉 캐싱 완료: ${productCode}`);
  }

  // 빠른 캐시 확인
  async hasImagesInCache(productCode) {
    try {
      const cachedImages = await this.getImagesByGroup(productCode);
      return cachedImages.length > 0;
    } catch {
      return false;
    }
  }

  // 강제 새로고침
  async refreshImages(productCode, imagGub1 = 'PROD', imagGub2 = 'IMG') {
    try {
      await this.invalidateProductCache(productCode);
      return await this.getOrCacheImages(productCode, imagGub1, imagGub2);
    } catch (error) {
      console.error('이미지 새로고침 실패:', error);
      return [];
    }
  }

  // ============= 기존 함수들 =============

  async clearCache() {
    await this.init();
    
    this.pendingRequests.forEach(request => {
      request.cancelled = true;
    });
    this.pendingRequests.clear();
    
    this.blobUrls.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
    this.blobUrls.clear();
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async getStats() {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result || [];
        const totalSize = items.reduce((sum, item) => sum + (item.blob?.size || 0), 0);
        resolve({
          count: items.length,
          sizeMB: (totalSize / 1024 / 1024).toFixed(1)
        });
      };
      request.onerror = () => resolve({ count: 0, sizeMB: '0' });
    });
  }

  async invalidateProductCache(productCode) {
    console.log('제품 캐시 무효화:', productCode);
    
    try {
      await this.init();
      
      // groupKey로 해당 제품의 모든 이미지 삭제
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('groupKey');
      const request = index.getAll(productCode);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const items = request.result || [];
          
          // 각 이미지 삭제
          items.forEach(item => {
            store.delete(item.url);
            
            // blob URL 정리
            if (this.blobUrls.has(item.url)) {
              URL.revokeObjectURL(this.blobUrls.get(item.url));
              this.blobUrls.delete(item.url);
            }
          });
          
          console.log(`캐시 무효화 완료: ${productCode} (${items.length}개)`);
          resolve(true);
        };
        
        request.onerror = () => resolve(false);
      });
      
    } catch (error) {
      console.error('제품 캐시 무효화 실패:', error);
      return false;
    }
  }

  // ============= ImageUploader 연동 함수들 =============

  async getImagesByGroup(groupKey) {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('groupKey');
      const request = index.getAll(groupKey);
      
      request.onsuccess = () => {
        const results = request.result || [];
        const processedResults = results.map(item => {
          if (item.blob && !this.blobUrls.has(item.url)) {
            const blobUrl = URL.createObjectURL(item.blob);
            this.blobUrls.set(item.url, blobUrl);
          }
          
          return {
            ...item,
            url: this.blobUrls.get(item.url) || item.url,
            fileName: this.extractFileName(item.url),
            cnt: this.extractCnt(item.url),
            width: item.width || null,
            height: item.height || null
          };
        });
        
        processedResults.sort((a, b) => a.cnt - b.cnt);
        resolve(processedResults);
      };
      
      request.onerror = () => resolve([]);
    });
  }

  async updateGroupCache(groupKey, savedFiles) {
    if (!savedFiles || savedFiles.length === 0) return;
    
    console.log('그룹 캐시 업데이트:', groupKey, savedFiles.length, '개 파일');
    
    try {
      await this.init();
      
      for (const file of savedFiles) {
        try {
          const imageUrl = file.path.startsWith('/') ? 
            `${file.path}?nocache=${Date.now()}` : 
            `/proxy-images/${file.fileName}?nocache=${Date.now()}`;
            
          const response = await fetch(imageUrl, { 
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const etag = response.headers.get('etag') || `${Date.now()}-${file.cnt}`;
            
            await this.saveToCache(imageUrl, blob, etag, groupKey);
            console.log('캐시 업데이트 완료:', file.fileName);
          }
        } catch (fileError) {
          console.warn('개별 파일 캐시 실패:', file.fileName, fileError);
        }
      }
      
      console.log('그룹 캐시 업데이트 완료:', groupKey);
      
    } catch (error) {
      console.error('그룹 캐시 업데이트 실패:', error);
    }
  }

  async updateImageIfChanged(url, groupKey) {
    try {
      const cached = await this.getFromCache(url);
      const currentETag = await this.checkETag(url);
      
      // 🔥 null 체크 수정 (기존 버그 해결)
      if (cached && cached.etag && cached.etag === currentETag) {
        return false;
      }
      
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const blob = await response.blob();
        await this.saveToCache(url, blob, currentETag, groupKey);
        console.log('이미지 변경 감지, 캐시 업데이트:', url);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('이미지 변경 감지 실패:', error);
      return false;
    }
  }

  extractFileName(url) {
    try {
      const match = url.match(/\/proxy-images\/([^?]+)/);
      return match ? match[1] : url.split('/').pop().split('?')[0];
    } catch {
      return 'unknown.jpg';
    }
  }

  extractCnt(url) {
    try {
      const fileName = this.extractFileName(url);
      const match = fileName.match(/_(\d+)\.jpg$/);
      return match ? parseInt(match[1], 10) : 0;
    } catch {
      return 0;
    }
  }
}

export const simpleCache = new SimpleImageCache();

if (typeof window !== 'undefined') {
  simpleCache.init().catch(console.error);
}