// PWA 상태 관리 유틸리티
class StateManager {
  constructor() {
    this.dbName = 'PWAStateDB';
    this.dbVersion = 1;
    this.storeName = 'userStates';
  }

  // IndexedDB 초기화
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // localStorage에 상태 저장
  saveToLocal(path) {
    try {
      const state = {
        path,
        timestamp: Date.now(),
        type: 'localStorage'
      };
      localStorage.setItem('pwa:state', JSON.stringify(state));
      console.log('localStorage 저장:', path);
    } catch (error) {
      console.error('localStorage 저장 실패:', error);
    }
  }

  // IndexedDB에 상태 저장
  async saveToIndexedDB(path) {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const state = {
        id: 'userState', // 고정 키 (한 사용자당 하나)
        path,
        timestamp: Date.now(),
        type: 'IndexedDB'
      };
      
      await store.put(state);
      console.log('IndexedDB 저장:', path);
    } catch (error) {
      console.error('IndexedDB 저장 실패:', error);
    }
  }

  // localStorage에서 상태 복원
  getFromLocal() {
    try {
      const stored = localStorage.getItem('pwa:state');
      if (!stored) return null;
      
      const state = JSON.parse(stored);
      const elapsed = Date.now() - state.timestamp;
      
      // 6시간 이내만 유효
      if (elapsed < 6 * 60 * 60 * 1000) {
        console.log('localStorage 복원:', state.path);
        return state;
      } else {
        localStorage.removeItem('pwa:state');
        console.log('localStorage 만료됨');
        return null;
      }
    } catch (error) {
      console.error('localStorage 복원 실패:', error);
      return null;
    }
  }

  // IndexedDB에서 상태 복원
  async getFromIndexedDB() {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get('userState');
        
        request.onsuccess = () => {
          const state = request.result;
          if (!state) {
            resolve(null);
            return;
          }
          
          const elapsed = Date.now() - state.timestamp;
          
          // 24시간 이내만 유효
          if (elapsed < 24 * 60 * 60 * 1000) {
            console.log('IndexedDB 복원:', state.path);
            resolve(state);
          } else {
            console.log('IndexedDB 만료됨');
            this.clearIndexedDB();
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('IndexedDB 복원 실패:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('IndexedDB 접근 실패:', error);
      return null;
    }
  }

  // 통합 저장 (localStorage + IndexedDB 동시)
  async saveState(path) {
    if (!path || path === '/') return;
    
    // 동시에 두 곳에 저장
    this.saveToLocal(path);
    await this.saveToIndexedDB(path);
  }

  // 우선순위별 복원
  async restoreState() {
    // 1순위: localStorage (빠르고 최근)
    const localState = this.getFromLocal();
    if (localState) return localState.path;
    
    // 2순위: IndexedDB (오래 유지됨)
    const indexedState = await this.getFromIndexedDB();
    if (indexedState) return indexedState.path;
    
    console.log('복원할 상태 없음');
    return null;
  }

  // 저장소 정리
  async clearAll() {
    localStorage.removeItem('pwa:state');
    await this.clearIndexedDB();
  }

  async clearIndexedDB() {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.clear();
    } catch (error) {
      console.error('IndexedDB 정리 실패:', error);
    }
  }

  // 저장소 상태 확인 (디버깅용)
  async getStorageInfo() {
    const local = this.getFromLocal();
    const indexed = await this.getFromIndexedDB();
    
    return {
      localStorage: local ? `${local.path} (${new Date(local.timestamp).toLocaleTimeString()})` : 'None',
      IndexedDB: indexed ? `${indexed.path} (${new Date(indexed.timestamp).toLocaleTimeString()})` : 'None'
    };
  }
}

// 싱글톤 인스턴스 생성
export const stateManager = new StateManager();