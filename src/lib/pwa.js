// 온라인 전용 PWA 유틸리티 (기존 IndexedDB 활용)

import { simpleCache } from './utils/simpleImageCache.js';

let deferredPrompt;

// Service Worker 등록
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker 등록 성공:', registration);
      
      // 업데이트 확인
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 새 버전 사용 가능 알림
              showUpdateNotification();
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker 등록 실패:', error);
    }
  }
}

// 앱 설치 프롬프트 처리
export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });
  
  window.addEventListener('appinstalled', () => {
    console.log('PWA 설치됨');
    hideInstallButton();
    deferredPrompt = null;
  });
}

// 설치 버튼 표시
function showInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.style.display = 'block';
    installBtn.onclick = installApp;
  }
}

// 설치 버튼 숨기기
function hideInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
}

// 앱 설치
export async function installApp() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('사용자가 설치를 승인했습니다');
  } else {
    console.log('사용자가 설치를 거부했습니다');
  }
  
  deferredPrompt = null;
  hideInstallButton();
}

// 업데이트 알림 표시
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-content">
      <span>새 버전이 사용 가능합니다!</span>
      <button onclick="refreshApp()">업데이트</button>
      <button onclick="dismissUpdate(this)">나중에</button>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 300px;
  `;
  
  document.body.appendChild(notification);
  
  // 자동 제거 (10초 후)
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
}

// 앱 새로고침
window.refreshApp = () => {
  window.location.reload();
};

// 업데이트 알림 제거
window.dismissUpdate = (button) => {
  const notification = button.closest('.update-notification');
  if (notification && notification.parentNode) {
    notification.parentNode.removeChild(notification);
  }
};

// 간단한 토스트 메시지
export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `pwa-toast ${type}`;
  toast.textContent = message;
  
  // 타입별 스타일링
  const colors = {
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8'
  };
  
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // 자동 제거
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// 캐시 통계 가져오기 (simpleImageCache 사용)
export async function getCacheStats() {
  try {
    return await simpleCache.getStats();
  } catch (error) {
    console.error('캐시 통계 가져오기 실패:', error);
    return { count: 0, sizeMB: '0' };
  }
}

// 캐시 정리 (simpleImageCache 사용)
export async function cleanupImageCache() {
  try {
    await simpleCache.clearCache();
    return true;
  } catch (error) {
    console.error('캐시 정리 실패:', error);
    return false;
  }
}

// 이미지 요소에 캐시 적용 (DOM 요소별 관리)
export async function applyImageCache() {
  const images = document.querySelectorAll('img[src*="/proxy-images/"]');
  
  for (const img of images) {
    try {
      // 이미지 src 변경 감지 및 이전 요청 취소
      setupImageObserver(img);
      await simpleCache.handleImage(img);
    } catch (error) {
      console.log('이미지 캐시 적용 실패:', img.src, error);
    }
  }
}

// 이미지 src 변경 감지하여 이전 요청 취소
function setupImageObserver(imgElement) {
  // 이전 observer 제거
  if (imgElement._srcObserver) {
    imgElement._srcObserver.disconnect();
  }
  
  // src 변경 감지용 MutationObserver
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        // src가 변경되면 이전 요청 취소
        if (simpleCache.pendingRequests.has(imgElement)) {
          const requests = simpleCache.pendingRequests.get(imgElement);
          if (Array.isArray(requests)) {
            requests.forEach(req => req.cancelled = true);
          } else {
            requests.cancelled = true;
          }
          console.log('이전 이미지 요청 취소:', mutation.oldValue);
        }
      }
    });
  });
  
  observer.observe(imgElement, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['src']
  });
  
  imgElement._srcObserver = observer;
}

// PWA 초기화 (기존 IndexedDB 건드리지 않고 이미지 캐싱만)
export async function initPWA() {
  try {
    await registerServiceWorker();
    setupInstallPrompt();
    
    // simpleCache는 자체 IndexedDB 사용 (기존 것과 별개)
    // 초기화는 simpleCache가 알아서 함 (기존 IndexedDB 건드리지 않음)
    
    // 페이지 로드 후 이미지 캐시 적용
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyImageCache);
    } else {
      applyImageCache();
    }
    
    // 동적으로 추가된 이미지에도 캐시 적용
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const images = node.querySelectorAll ? node.querySelectorAll('img[src*="/proxy-images/"]') : [];
            images.forEach(img => {
              setupImageObserver(img);
              simpleCache.handleImage(img);
            });
            
            if (node.tagName === 'IMG' && node.src.includes('/proxy-images/')) {
              setupImageObserver(node);
              simpleCache.handleImage(node);
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // 전역 함수로 노출
    window.showToast = showToast;
    window.getCacheStats = getCacheStats;
    window.cleanupImageCache = cleanupImageCache;
    window.simpleCache = simpleCache;
    
    console.log('PWA 초기화 완료 - ETag 기반 이미지 캐싱 활성화');
  } catch (error) {
    console.error('PWA 초기화 실패:', error);
  }
}