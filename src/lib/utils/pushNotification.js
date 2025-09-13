// src/lib/utils/pushNotification.js (포그라운드 중복 방지)
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCrZQO0K4I3rxXF1uHU0X3iJenAYARSz3w",
  authDomain: "backoffice-31d48.firebaseapp.com",
  projectId: "backoffice-31d48",
  storageBucket: "backoffice-31d48.firebasestorage.app",
  messagingSenderId: "550267566582",
  appId: "1:550267566582:web:df3990e8d73923976e6fd7"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 🚫 포그라운드 중복 방지 저장소
const foregroundMessages = new Set();
const FOREGROUND_DUPLICATE_WINDOW = 3000; // 3초

export async function getFCMToken() {
  try {
    console.log('🔥 FCM 토큰 요청 시작...');
    
    const permission = await Notification.requestPermission();
    console.log('🔥 알림 권한:', permission);
    
    if (permission !== 'granted') {
      console.warn('🔥 알림 권한이 거부되었습니다.');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: 'BMIBO7eAzHVtz_rEIL0cimdhoAcBJ3Pv4YvSSXy1NAfg6i0mFaKgyKbq7TR6NJ4rYz51QIDDmruy0-UuudDIuQw'
    });
    
    console.log('🔥 FCM 토큰 생성 성공:', token ? '토큰 있음' : '토큰 없음');
    return token;
  } catch (error) {
    console.error('❌ FCM 토큰 가져오기 실패:', error);
    return null;
  }
}

export function setupForegroundMessaging() {
  console.log('🔥 포그라운드 메시징 설정');
  
  onMessage(messaging, (payload) => {
    console.log('🔥 [포그라운드] 메시지 수신:', payload);
    
    const title = payload.notification?.title || '새 알림';
    const body = payload.notification?.body || '새로운 알림이 도착했습니다.';
    const messageId = payload.data?.messageId || `${title}-${body}`;
    
    // 🚫 포그라운드 중복 체크
    if (foregroundMessages.has(messageId)) {
      console.log('🚫 [포그라운드] 중복 메시지 차단:', messageId);
      return;
    }
    
    // 메시지 기록
    foregroundMessages.add(messageId);
    setTimeout(() => {
      foregroundMessages.delete(messageId);
    }, FOREGROUND_DUPLICATE_WINDOW);
    
    // 🎨 페이지가 보이는 상태에서만 커스텀 토스트 표시
    if (document.visibilityState === 'visible') {
      showCustomNotificationToast(title, body, payload.data);
    }
  });
}

// 🎨 커스텀 알림 토스트 (브라우저 기본 알림 대신)
function showCustomNotificationToast(title, body, data = {}) {
  console.log('🎨 커스텀 토스트 표시:', title);
  
  // 기존 토스트 제거
  const existingToasts = document.querySelectorAll('.firebase-notification-toast');
  existingToasts.forEach(toast => toast.remove());
  
  // 토스트 엘리먼트 생성
  const toast = document.createElement('div');
  toast.className = 'firebase-notification-toast';
  
  const toastId = `toast-${Date.now()}`;
  toast.id = toastId;
  
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">🔔</div>
      <div class="toast-text">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-body">${escapeHtml(body)}</div>
      </div>
      <button class="toast-close" onclick="document.getElementById('${toastId}').remove()">×</button>
    </div>
  `;
  
  // 스타일 추가
  addToastStyles();
  
  document.body.appendChild(toast);
  
  // 애니메이션 시작
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 5초 후 자동 제거
  setTimeout(() => {
    if (document.getElementById(toastId)) {
      toast.classList.add('hide');
      setTimeout(() => {
        if (document.getElementById(toastId)) {
          toast.remove();
        }
      }, 300);
    }
  }, 5000);
  
  // 클릭 시 앱으로 포커스
  toast.addEventListener('click', (e) => {
    if (!e.target.classList.contains('toast-close')) {
      window.focus();
      toast.remove();
    }
  });
}

// HTML 이스케이프 함수
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 토스트 스타일 추가 (한번만)
function addToastStyles() {
  if (document.getElementById('firebase-toast-styles')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'firebase-toast-styles';
  style.textContent = `
    .firebase-notification-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      max-width: 350px;
      min-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease-out;
      cursor: pointer;
    }
    
    .firebase-notification-toast.show {
      transform: translateX(0);
      opacity: 1;
    }
    
    .firebase-notification-toast.hide {
      transform: translateX(100%);
      opacity: 0;
    }
    
    .toast-content {
      display: flex;
      align-items: flex-start;
      padding: 16px;
      gap: 12px;
    }
    
    .toast-icon {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .toast-text {
      flex: 1;
      min-width: 0;
    }
    
    .toast-title {
      font-weight: 600;
      font-size: 14px;
      color: #111827;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    
    .toast-body {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.4;
      word-wrap: break-word;
    }
    
    .toast-close {
      background: none;
      border: none;
      font-size: 18px;
      color: #9ca3af;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    
    .toast-close:hover {
      background: #f3f4f6;
      color: #374151;
    }
    
    .firebase-notification-toast:hover {
      box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
    }
    
    @media (max-width: 480px) {
      .firebase-notification-toast {
        right: 10px;
        left: 10px;
        max-width: none;
        min-width: 0;
      }
    }
  `;
  
  document.head.appendChild(style);
}