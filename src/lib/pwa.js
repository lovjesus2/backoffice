// SSR 안전한 PWA 유틸리티

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { goto } from '$app/navigation';

// ✅ 서버에서도 안전한 스토어 초기화
export const userStore = writable(null);
export const isAuthenticated = writable(false);

// ✅ 서버에서는 실행되지 않도록 조건부 import
let simpleCache;
if (browser) {
  import('./utils/simpleImageCache.js').then(module => {
    simpleCache = module.simpleCache;
  });
}

let deferredPrompt;

// Service Worker 등록 (브라우저에서만)
export async function registerServiceWorker() {
  if (!browser || !('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker 등록 성공:', registration);
    
    // 업데이트 확인
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
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

// 🆕 인증 상태 확인 (브라우저에서만)
export async function checkAuth() {
  if (!browser) return false;
  
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        userStore.set(data.user);
        isAuthenticated.set(true);
        return true;
      }
    }
    
    userStore.set(null);
    isAuthenticated.set(false);
    return false;
    
  } catch (error) {
    console.error('인증 확인 실패:', error);
    userStore.set(null);
    isAuthenticated.set(false);
    return false;
  }
}

// PWA 로그아웃 (브라우저에서만)
export async function pwaLogout() {
  if (!browser) return;
  
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('로그아웃 오류:', error);
  } finally {
    userStore.set(null);
    isAuthenticated.set(false);
    goto('/', { replaceState: true });
  }
}

// 앱 설치 프롬프트 처리 (브라우저에서만)
export function setupInstallPrompt() {
  if (!browser || !window) return;
  
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

// 설치 버튼 표시 (브라우저에서만)
function showInstallButton() {
  if (!browser || !document) return;
  
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.style.display = 'block';
    installBtn.onclick = installApp;
  }
}

// 설치 버튼 숨기기 (브라우저에서만)
function hideInstallButton() {
  if (!browser || !document) return;
  
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
}

// 앱 설치 (브라우저에서만)
export async function installApp() {
  if (!browser || !deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('사용자가 설치를 승인했습니다');
  }
  
  deferredPrompt = null;
  hideInstallButton();
}

// 업데이트 알림 표시 (브라우저에서만)
function showUpdateNotification() {
  if (!browser || !document) return;
  
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
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
}

// 전역 함수들 (브라우저에서만)
if (browser && window) {
  window.refreshApp = () => {
    window.location.reload();
  };

  window.dismissUpdate = (button) => {
    const notification = button.closest('.update-notification');
    if (notification && notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  };
}

// 토스트 메시지 (브라우저에서만)
export function showToast(message, type = 'info', duration = 3000) {
  if (!browser || !document) return;
  
  const toast = document.createElement('div');
  toast.textContent = message;
  
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
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// 캐시 관련 함수들 (브라우저에서만, 비동기)
export async function getCacheStats() {
  if (!browser || !simpleCache) {
    return { count: 0, sizeMB: '0' };
  }
  
  try {
    return await simpleCache.getStats();
  } catch (error) {
    console.error('캐시 통계 가져오기 실패:', error);
    return { count: 0, sizeMB: '0' };
  }
}

export async function cleanupImageCache() {
  if (!browser || !simpleCache) return false;
  
  try {
    await simpleCache.clearCache();
    return true;
  } catch (error) {
    console.error('캐시 정리 실패:', error);
    return false;
  }
}

// 이미지 캐시 적용 (브라우저에서만)
export async function applyImageCache() {
  if (!browser || !document || !simpleCache) return;
  
  const images = document.querySelectorAll('img[src*="/proxy-images/"]');
  
  for (const img of images) {
    try {
      setupImageObserver(img);
      await simpleCache.handleImage(img);
    } catch (error) {
      console.log('이미지 캐시 적용 실패:', img.src, error);
    }
  }
}

// 이미지 옵저버 설정 (브라우저에서만)
function setupImageObserver(imgElement) {
  if (!browser || !window || !simpleCache) return;
  
  if (imgElement._srcObserver) {
    imgElement._srcObserver.disconnect();
  }
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        if (simpleCache.pendingRequests.has(imgElement)) {
          const requests = simpleCache.pendingRequests.get(imgElement);
          if (Array.isArray(requests)) {
            requests.forEach(req => req.cancelled = true);
          } else {
            requests.cancelled = true;
          }
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

// PWA 초기화 (브라우저에서만)
export async function initPWA() {
  if (!browser) {
    console.log('서버에서 PWA 초기화 건너뛰기');
    return;
  }
  
  try {
    await registerServiceWorker();
    setupInstallPrompt();
    

   // PWA 초기화 함수에서 iPhone PWA 새로고침 버튼 부분을 이렇게 수정

   // PWA 초기화 함수에서 iPhone PWA 새로고침 버튼 부분을 이렇게 수정

    // ✅ iPhone PWA 새로고침 버튼 추가 (백오피스 헤더 오른쪽 끝에 고정)
    if (window.navigator.standalone && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
      const refreshBtn = document.createElement('button');
      refreshBtn.innerHTML = '↻';
      refreshBtn.style.cssText = `
        position: fixed;
        top: calc(env(safe-area-inset-top, 0px) + 17px);
        right: 15px;
        width: 36px;
        height: 36px;
        color: #17a2b8;
        background: rgba(23, 162, 184, 0.1);
        border: 1px solid rgba(23, 162, 184, 0.3);
        border-radius: 50%;
        font-size: 16px;
        font-weight: bold;
        z-index: 101;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        transition: all 0.2s ease;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      `;
      
      refreshBtn.onclick = () => {
        refreshBtn.innerHTML = '⟳';
        refreshBtn.style.background = 'rgba(23, 162, 184, 0.9)';
        refreshBtn.style.color = 'white';
        refreshBtn.style.transform = 'scale(0.95)';
        setTimeout(() => window.location.reload(), 200);
      };
      
      // 호버 효과
      refreshBtn.addEventListener('mouseenter', () => {
        if (!refreshBtn.innerHTML.includes('⟳')) {
          refreshBtn.style.background = 'rgba(23, 162, 184, 0.15)';
          refreshBtn.style.borderColor = 'rgba(23, 162, 184, 0.5)';
          refreshBtn.style.transform = 'scale(1.05)';
        }
      });
      
      refreshBtn.addEventListener('mouseleave', () => {
        if (!refreshBtn.innerHTML.includes('⟳')) {
          refreshBtn.style.background = 'rgba(23, 162, 184, 0.1)';
          refreshBtn.style.borderColor = 'rgba(23, 162, 184, 0.3)';
          refreshBtn.style.transform = 'scale(1)';
        }
      });
      
      // 터치 효과
      refreshBtn.addEventListener('touchstart', () => {
        if (!refreshBtn.innerHTML.includes('⟳')) {
          refreshBtn.style.transform = 'scale(0.95)';
        }
      });
      
      refreshBtn.addEventListener('touchend', () => {
        if (!refreshBtn.innerHTML.includes('⟳')) {
          refreshBtn.style.transform = 'scale(1)';
        }
      });
      
      // 모바일에서 크기 및 위치 조정
      if (window.innerWidth <= 480) {
        refreshBtn.style.width = '32px';
        refreshBtn.style.height = '32px';
        refreshBtn.style.fontSize = '14px';
        refreshBtn.style.right = '12px';
      }
      
      // Safe Area 지원
      if (window.innerWidth <= 480) {
        refreshBtn.style.top = 'calc(env(safe-area-inset-top, 0px) + 19px)';
      }
      
      document.body.appendChild(refreshBtn);
      console.log('iPhone PWA 새로고침 버튼 추가됨 - 헤더 오른쪽');
    }

    // 인증 상태 확인
    await checkAuth();
    
    // 브라우저 이벤트 리스너
    if (window) {
      window.addEventListener('focus', checkAuth);
      
      // 주기적 인증 확인 (5분마다)
      setInterval(checkAuth, 5 * 60 * 1000);
      
      // 앱 가시성 변경 시 처리
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          checkAuth();
        }
      });
    }
    
    // 이미지 캐시 적용 (DOM 로드 후)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyImageCache);
    } else {
      applyImageCache();
    }
    
    // 동적 이미지 감지
    if (document && window.MutationObserver) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && simpleCache) {
              const images = node.querySelectorAll ? node.querySelectorAll('img[src*="/proxy-images/"]') : [];
              images.forEach(img => {
                setupImageObserver(img);
                simpleCache.handleImage(img);
              });
              
              if (node.tagName === 'IMG' && node.src && node.src.includes('/proxy-images/')) {
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
    }
    
    // 전역 함수 노출
    if (window) {
      window.showToast = showToast;
      window.getCacheStats = getCacheStats;
      window.cleanupImageCache = cleanupImageCache;
      window.simpleCache = simpleCache;
    }
    
    console.log('PWA 초기화 완료');
  } catch (error) {
    console.error('PWA 초기화 실패:', error);
  }
}