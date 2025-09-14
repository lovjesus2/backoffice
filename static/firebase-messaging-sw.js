// static/firebase-messaging-sw.js (중복 방지 버전)

// =================== 캐싱 기능 ===================
const CACHE_NAME = 'stock-pwa-v2';
const IMAGE_CACHE_NAME = 'images-v1';

const STATIC_FILES = [
  '/',
  '/manifest.json'
];

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('🔥 [firebase-messaging-sw.js] Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('🔥 [firebase-messaging-sw.js] Service Worker 활성화됨');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// 네트워크 요청 캐싱
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 브라우저 확장 프로그램 URL 필터링
  if (request.url.startsWith('chrome-extension://') || 
      request.url.startsWith('moz-extension://') || 
      request.url.startsWith('safari-extension://') ||
      request.url.startsWith('ms-browser-extension://')) {
    return;
  }
  
  // 특수 스키마 URL 필터링
  if (request.url.startsWith('data:') || 
      request.url.startsWith('blob:') || 
      request.url.startsWith('about:')) {
    return;
  }
  
  // 허용된 도메인만 처리
  const allowedHosts = [
    self.location.origin,
    'https://cdnjs.cloudflare.com',
    'https://image.kungkungne.synology.me'
  ];
  
  const isAllowedHost = allowedHosts.some(host => 
    request.url.startsWith(host)
  );
  
  if (!isAllowedHost) {
    return;
  }
  
  // SvelteKit 페이지는 건드리지 않음
  if (request.destination === 'document') {
    return;
  }
  
  // 이미지 캐싱
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(cache => {
        return cache.match(request).then(response => {
          if (response) {
            return response;
          }
          
          return fetch(request).then(fetchResponse => {
            if (fetchResponse && fetchResponse.ok) {
              try {
                cache.put(request, fetchResponse.clone());
              } catch (error) {
                console.warn('🔥 캐시 저장 실패:', error);
              }
            }
            return fetchResponse;
          });
        });
      })
    );
    return;
  }
  
  // 정적 파일 캐싱
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request);
      })
    );
  } else {
    event.respondWith(fetch(request));
  }
});

// ================== Firebase 메시징 기능 ==================

// Firebase 스크립트 로드
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Firebase 설정
firebase.initializeApp({
  apiKey: "AIzaSyCrZQO0K4I3rxXF1uHU0X3iJenAYARSz3w",
  authDomain: "backoffice-31d48.firebaseapp.com",
  projectId: "backoffice-31d48",
  storageBucket: "backoffice-31d48.firebasestorage.app",
  messagingSenderId: "550267566582",
  appId: "1:550267566582:web:df3990e8d73923976e6fd7"
});

// Firebase Messaging 인스턴스
const messaging = firebase.messaging();

// 🔥 중복 알림 방지를 위한 맵
const shownNotifications = new Map();

// 백그라운드 메시지 핸들러 (중복 방지 로직 추가)
messaging.onBackgroundMessage((payload) => {
  console.log('🔥 [firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);
  
  const notificationTitle = payload.notification?.title || '새 알림';
  const notificationBody = payload.notification?.body || '새로운 알림이 도착했습니다.';
  
  // 🚫 중복 방지: 같은 제목+내용의 알림이 5초 이내에 있었다면 무시
  const notificationKey = `${notificationTitle}-${notificationBody}`;
  const now = Date.now();
  
  if (shownNotifications.has(notificationKey)) {
    const lastShown = shownNotifications.get(notificationKey);
    if (now - lastShown < 5000) { // 5초 이내 중복 무시
      console.log('🚫 [firebase-messaging-sw.js] 중복 알림 무시:', notificationKey);
      return;
    }
  }
  
  // 알림 표시 기록
  shownNotifications.set(notificationKey, now);
  
  // 5초 후 기록 삭제 (메모리 정리)
  setTimeout(() => {
    shownNotifications.delete(notificationKey);
  }, 5000);
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'backoffice-notification', // 🔥 같은 tag로 중복 방지
    requireInteraction: false,
    data: payload.data || {},
    // 🔥 silent: false로 소리 한번만
    silent: false,
    renotify: false // 🔥 같은 tag 알림 재표시 안함
  };

  console.log('✅ [firebase-messaging-sw.js] 백그라운드 알림 표시:', notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [firebase-messaging-sw.js] 알림 클릭됨:', event.notification.title);
  
  event.notification.close();
  
  // 앱 창 열기
  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('🔥 [firebase-messaging-sw.js] 통합 Service Worker 로드 완료');