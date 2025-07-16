/**
 * IndexedDB 이미지 캐시 (비동기 충돌 해결 버전)
 */
class SimpleImageCache {
  constructor() {
    this.dbName = 'SimpleImageCache';
    this.dbVersion = 1;
    this.storeName = 'images';
    this.db = null;
    this.blobUrls = new Map(); // blob URL 관리
    this.pendingRequests = new Map(); // 진행 중인 요청 관리
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

  async saveToCache(url, blob, etag) {
    await this.init();
    const data = { url, blob, etag, savedAt: Date.now() };
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
      const response = await fetch(url, { method: 'HEAD' });
      return response.headers.get('etag');
    } catch {
      return null;
    }
  }

  // 🎯 확실한 비동기 충돌 해결 로직
  async handleImage(imgElement) {
    const originalUrl = imgElement.src;
    if (!originalUrl || originalUrl.startsWith('blob:')) return;

    // 현재 시점의 src를 기록 (나중에 검증용)
    const currentSrc = originalUrl;
    
    // 이전 요청들 모두 취소
    if (this.pendingRequests.has(imgElement)) {
      this.pendingRequests.get(imgElement).forEach(req => req.cancelled = true);
    }
    
    // 새 요청 배열 생성
    if (!this.pendingRequests.has(imgElement)) {
      this.pendingRequests.set(imgElement, []);
    }

    // 고유 요청 ID 생성
    const requestId = Date.now() + Math.random();
    const requestInfo = { cancelled: false, id: requestId, url: currentSrc };
    
    // 요청 배열에 추가
    this.pendingRequests.get(imgElement).push(requestInfo);

    try {
      // 1. 먼저 캐시 확인
      const cached = await this.getFromCache(originalUrl);
      
      // src가 바뀌었는지 확인
      if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
        return;
      }
      
      if (cached) {
        // 2. 캐시가 있으면 ETag 확인
        const currentETag = await this.checkETag(originalUrl);
        
        // 다시 확인
        if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
          return;
        }
        
        if (cached.etag === currentETag) {
          // 3. ETag 같으면 즉시 캐시 이미지 사용
          if (this.setImageSafely(imgElement, originalUrl, cached.blob, requestInfo, currentSrc)) {
            console.log('캐시 사용:', originalUrl);
          }
          return;
        }
      }

      // 4. 캐시 없거나 ETag 다르면 새로 다운로드
      const response = await fetch(originalUrl);
      
      // 다시 확인
      if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
        return;
      }
      
      if (response.ok) {
        const blob = await response.blob();
        const etag = response.headers.get('etag');
        
        // 마지막 확인
        if (this.isRequestInvalid(imgElement, requestInfo, currentSrc)) {
          return;
        }
        
        // 5. 캐시 저장
        await this.saveToCache(originalUrl, blob, etag);
        
        // 6. 이미지 교체 (최종 확인 후)
        if (this.setImageSafely(imgElement, originalUrl, blob, requestInfo, currentSrc)) {
          console.log('새 이미지 캐시됨:', originalUrl);
        }
      }
      
    } catch (error) {
      console.log('캐싱 실패:', originalUrl, error);
    } finally {
      // 요청 완료 후 정리
      this.cleanupRequest(imgElement, requestInfo);
    }
  }

  // 요청이 여전히 유효한지 확인
  isRequestInvalid(imgElement, requestInfo, originalSrc) {
    return requestInfo.cancelled || 
           imgElement.src !== originalSrc || 
           !document.contains(imgElement);
  }

  // 안전한 이미지 설정
  setImageSafely(imgElement, originalUrl, blob, requestInfo, originalSrc) {
    // 최종 검증
    if (this.isRequestInvalid(imgElement, requestInfo, originalSrc)) {
      console.log('이미지 설정 취소됨:', originalUrl);
      return false;
    }
    
    // 이전 blob URL 정리
    if (this.blobUrls.has(originalUrl)) {
      URL.revokeObjectURL(this.blobUrls.get(originalUrl));
    }
    
    // 새 blob URL 생성 및 저장
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrls.set(originalUrl, blobUrl);
    
    // DOM 요소의 src와 한 번 더 확인
    if (imgElement.src === originalSrc) {
      imgElement.src = blobUrl;
      return true;
    }
    
    return false;
  }

  // 요청 정리
  cleanupRequest(imgElement, requestInfo) {
    if (this.pendingRequests.has(imgElement)) {
      const requests = this.pendingRequests.get(imgElement);
      const index = requests.findIndex(req => req.id === requestInfo.id);
      if (index > -1) {
        requests.splice(index, 1);
      }
      
      // 배열이 비면 맵에서 제거
      if (requests.length === 0) {
        this.pendingRequests.delete(imgElement);
      }
    }
  }

  async clearCache() {
    await this.init();
    
    // 진행 중인 모든 요청 취소
    this.pendingRequests.forEach(request => {
      request.cancelled = true;
    });
    this.pendingRequests.clear();
    
    // blob URL들 정리
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
}

export const simpleCache = new SimpleImageCache();

if (typeof window !== 'undefined') {
  simpleCache.init().catch(console.error);
}