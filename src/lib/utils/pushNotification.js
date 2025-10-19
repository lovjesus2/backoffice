// src/lib/utils/pushNotification.js (기존 서비스워커 사용)
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

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

export async function getFCMToken() {
  try {
    console.log('🔥 FCM 토큰 요청 시작...');
    
    const permission = await Notification.requestPermission();
    console.log('🔥 알림 권한:', permission);
    
    if (permission !== 'granted') {
      console.warn('🔥 알림 권한이 거부되었습니다.');
      return null;
    }

    // 🔑 기존 서비스워커를 Firebase에 등록
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ 서비스워커 등록 성공:', registration.scope);

    // serviceWorkerRegistration 옵션으로 기존 SW 사용
    const token = await getToken(messaging, {
      vapidKey: 'BMIBO7eAzHVtz_rEIL0cimdhoAcBJ3Pv4YvSSXy1NAfg6i0mFaKgyKbq7TR6NJ4rYz51QIDDmruy0-UuudDIuQw',
      serviceWorkerRegistration: registration
    });
    
    console.log('🔥 FCM 토큰 생성 성공:', token ? '토큰 있음' : '토큰 없음');
    return token;
  } catch (error) {
    console.error('❌ FCM 토큰 가져오기 실패:', error);
    return null;
  }
}

// 포그라운드 메시징 비활성화 - 서비스워커에서만 처리
export function setupForegroundMessaging() {
  console.log('🚫 포그라운드 메시징 비활성화됨 - 서비스워커에서만 알림 처리');
}