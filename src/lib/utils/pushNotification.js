// src/lib/utils/pushNotification.js (중복 방지 버전)
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

// 🔥 중복 방지를 위한 마지막 알림 기록
let lastNotificationTime = 0;
let lastNotificationContent = '';

export async function getFCMToken() {
  try {
    console.log('🔥 FCM 토큰 요청 시작...');
    
    const permission = await Notification.requestPermission();
    console.log('🔥 알림 권한:', permission);
    
    if (permission !== 'granted') {
      console.warn('🔥 알림 권한이 거부되었습니다.');
      return null;
    }

    // Firebase가 자동으로 /firebase-messaging-sw.js를 찾음
    const token = await getToken(messaging, {
      vapidKey: 'BMIBO7eAzHVtz_rEIL0cimdhoAcBJ3Pv4YvSSXy1NAfg6i0mFaKgyKbq7TR6NJ4rYz51QIDDmruy0-UuudDIuQw'
    });
    
    console.log('🔥 FCM 토큰 생성 성공:', token ? '토큰 있음' : '토큰 없음');
    return token;
  } catch (error) {
    console.error('❌ FCM 토큰 가져오기 실패:', error);
    
    // 구체적인 오류 메시지 로깅
    if (error.code === 'messaging/failed-serviceworker-registration') {
      console.error('❌ firebase-messaging-sw.js 파일을 찾을 수 없습니다.');
      console.error('❌ static/firebase-messaging-sw.js 파일이 존재하는지 확인하세요.');
    }
    
    return null;
  }
}

export function setupForegroundMessaging() {
  console.log('🔥 포그라운드 메시징 설정 시작');
  
  onMessage(messaging, (payload) => {
    console.log('🔥 포그라운드 메시지 수신:', payload);
    
    // 🚫 중복 방지 로직
    const currentTime = Date.now();
    const currentContent = `${payload.notification?.title}-${payload.notification?.body}`;
    
    if (currentContent === lastNotificationContent && (currentTime - lastNotificationTime) < 3000) {
      console.log('🚫 중복 포그라운드 알림 무시');
      return;
    }
    
    lastNotificationTime = currentTime;
    lastNotificationContent = currentContent;
    
    // 🔥 포그라운드에서는 커스텀 알림만 표시 (브라우저 기본 알림 X)
    if (Notification.permission === 'granted' && document.visibilityState === 'visible') {
      // 🎨 페이지 내 커스텀 알림 토스트 표시 (브라우저 알림 대신)
      showCustomToast(
        payload.notification?.title || '새 알림',
        payload.notification?.body || '새로운 알림이 도착했습니다.'
      );
      
      // 🔔 소리만 재생 (선택사항)
      playNotificationSound();
    }
  });
}

// 🎨 커스텀 토스트 알림 (브라우저 기본 알림 대신)
function showCustomToast(title, body) {
  console.log('🎨 커스텀 토스트 표시:', title);
  
  // 기존 토스트 제거
  const existingToast = document.querySelector('.custom-notification-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.className = 'custom-notification-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f2937;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 14px; opacity: 0.9;">${body}</div>
      <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; opacity: 0.7;" onclick="this.parentElement.parentElement.remove()">×</div>
    </div>
  `;
  
  // CSS 애니메이션 추가
  if (!document.querySelector('#notification-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // 5초 후 자동 제거
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// 🔔 알림 소리 재생 (선택사항)
function playNotificationSound() {
  try {
    // 간단한 알림음 (브라우저 기본)
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+L');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // 자동 재생 제한으로 실패할 수 있음 (정상)
    });
  } catch (error) {
    // 소리 재생 실패는 무시
  }
}