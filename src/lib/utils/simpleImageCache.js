/**
 * IndexedDB 이미지 캐시 (비동기 충돌 해결 + ImageUploader 연동 버전)
 */
class SimpleImageCache {
  constructor() {
    this.dbName = 'SimpleImageCache';
    this.dbVersion = 2; // 버전 업그레이드 (groupKey 인덱스 추가용)
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
          store.createIndex('groupKey', 'groupKey', { unique: false }); // 새로 추가
        } else if (event.oldVersion < 2) {
          // 기존 DB에 groupKey 인덱스 추가
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
      
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');

      console.log('[checkETag]', url, { etag, lastModified, all: [...response.headers] });

      return etag;
    } catch (err) {
      console.warn('[checkETag] 실패', url, err);
      return null;
    }
  }

  // 확실한 비동기 충돌 해결 로직
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

  // 제품 캐시 무효화 (기존 기능 유지)
  async invalidateProductCache(productCode) {
    console.log('제품 캐시 무효화:', productCode);
    
    try {
      await this.init();
      
      // 1. 해당 제품의 이미지 URL들만 삭제
      const patterns = [
        `/proxy-images/${productCode}_1.jpg`,
        `/proxy-images/${productCode}_2.jpg`,
        `/proxy-images/${productCode}_3.jpg`,
        `/proxy-images/${productCode}_4.jpg`,
        `/proxy-images/${productCode}_5.jpg`,
        `/proxy-images/${productCode}_6.jpg`,
        `/proxy-images/${productCode}_7.jpg`,
        `/proxy-images/${productCode}_8.jpg`,
        `/proxy-images/${productCode}_9.jpg`,
        `/proxy-images/${productCode}_10.jpg`
      ];
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      for (const url of patterns) {
        store.delete(url);
        store.delete(`${window.location.origin}${url}`);
        
        // blob URL 정리
        if (this.blobUrls.has(url)) {
          URL.revokeObjectURL(this.blobUrls.get(url));
          this.blobUrls.delete(url);
        }
      }
      
      // 2. 페이지의 해당 이미지들을 새로 로드
      const images = document.querySelectorAll(`img[src*="${productCode}"]`);
      for (const img of images) {
        await this.handleImage(img); // 새로 캐싱
      }
      
      return true;
      
    } catch (error) {
      console.error('제품 캐시 무효화 실패:', error);
      return false;
    }
  }

  // ============= ImageUploader 연동 전용 함수들 =============

  // 그룹별 이미지 가져오기 (ImageUploader용)
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
          // Blob URL 생성 (한번만)
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
        
        // cnt 순으로 정렬
        processedResults.sort((a, b) => a.cnt - b.cnt);
        resolve(processedResults);
      };
      
      request.onerror = () => resolve([]);
    });
  }

  // 서버 저장 후 캐시 업데이트 (ImageUploader용)
  async updateGroupCache(groupKey, savedFiles) {
    if (!savedFiles || savedFiles.length === 0) return;
    
    console.log('그룹 캐시 업데이트:', groupKey, savedFiles.length, '개 파일');
    
    try {
      await this.init();
      
      // 각 파일을 개별적으로 캐시 업데이트
      for (const file of savedFiles) {
        try {
          const imageUrl = file.path.startsWith('/') ? 
            `${file.path}?nocache=${Date.now()}` : 
            `/proxy-images/${file.fileName}?nocache=${Date.now()}`;
            
          // 서버에서 이미지 데이터 가져와서 캐시 저장
          const response = await fetch(imageUrl, { 
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const etag = response.headers.get('etag') || `${Date.now()}-${file.cnt}`;
            
            // groupKey와 함께 저장
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

  // 그룹 캐시에서 특정 이미지만 업데이트 (변경 감지)
  async updateImageIfChanged(url, groupKey) {
    try {
      const cached = await this.getFromCache(url);
      const currentETag = await this.checkETag(url);
      
      // 캐시가 있고 ETag가 같으면 업데이트 불필요
      if (cached && cached.etag === currentETag) {
        return false; // 변경 없음
      }
      
      // 파일이 변경되었거나 캐시가 없으면 새로 저장
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const blob = await response.blob();
        await this.saveToCache(url, blob, currentETag, groupKey);
        console.log('이미지 변경 감지, 캐시 업데이트:', url);
        return true; // 업데이트됨
      }
      
      return false;
    } catch (error) {
      console.warn('이미지 변경 감지 실패:', error);
      return false;
    }
  }

  // URL에서 파일명 추출
  extractFileName(url) {
    try {
      const match = url.match(/\/proxy-images\/([^?]+)/);
      return match ? match[1] : url.split('/').pop().split('?')[0];
    } catch {
      return 'unknown.jpg';
    }
  }

  // URL에서 cnt 번호 추출
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