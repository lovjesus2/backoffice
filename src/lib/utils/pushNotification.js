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
    console.log('🔥 FCM 토큰 생성 시작...');
    
    // 1. 기본 지원 확인
    if (!('Notification' in window)) {
      console.warn('⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return null;
    }
    
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ 이 브라우저는 Service Worker를 지원하지 않습니다.');
      return null;
    }
    
    // 2. 권한 상태 확인만 (요청하지 않음)
    console.log(`🔥 현재 알림 권한: ${Notification.permission}`);
    
    if (Notification.permission !== 'granted') {
      console.warn('⚠️ 알림 권한이 없습니다. 로그인 페이지에서 먼저 권한을 허용해주세요.');
      return null;
    }
    
    console.log('✅ 알림 권한 확인됨');

    // 3. Service Worker 확인/등록
    console.log('🔥 Service Worker 확인 중...');
    
    let registration;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existingReg = registrations.find(reg => reg.scope.includes('/'));
    
    if (existingReg) {
      console.log(`✅ 기존 서비스워커 사용: ${existingReg.scope}`);
      registration = existingReg;
    } else {
      console.log('🔥 새 SW 등록 시도: /sw.js');
      registration = await navigator.serviceWorker.register('/sw.js');
      console.log(`✅ 서비스워커 등록 성공: ${registration.scope}`);
    }

    // 4. FCM 토큰 생성
    console.log('🔥 FCM 토큰 생성 시도...');
    
    const token = await getToken(messaging, {
      vapidKey: 'BMIBO7eAzHVtz_rEIL0cimdhoAcBJ3Pv4YvSSXy1NAfg6i0mFaKgyKbq7TR6NJ4rYz51QIDDmruy0-UuudDIuQw',
      serviceWorkerRegistration: registration
    });
    
    if (token) {
      console.log(`✅ 토큰 생성 성공! 길이: ${token.length}`);
      return token;
    } else {
      console.warn('⚠️ 토큰이 null입니다');
      return null;
    }
    
  } catch (error) {
    console.error('❌ FCM 토큰 가져오기 실패:', error);
    console.error('❌ 오류 타입:', error.constructor.name);
    console.error('❌ 오류 코드:', error.code);
    console.error('❌ 오류 메시지:', error.message);
    return null;
  }
}

// 포그라운드 메시징 비활성화 - 서비스워커에서만 처리
export function setupForegroundMessaging() {
  
  console.log('✅ 포그라운드 메시징 비활성화');
}