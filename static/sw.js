// static/sw.js (Firebase 백그라운드 메시징 통합)
console.log('🔥 [통합SW] Service Worker 시작');

// ⭐ Firebase 스크립트 및 초기화를 최상위로
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCrZQO0K4I3rxXF1uHU0X3iJenAYARSz3w",
  authDomain: "backoffice-31d48.firebaseapp.com",
  projectId: "backoffice-31d48",
  storageBucket: "backoffice-31d48.firebasestorage.app",
  messagingSenderId: "550267566582",
  appId: "1:550267566582:web:df3990e8d73923976e6fd7"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 메시지 핸들러 설정
messaging.onBackgroundMessage((payload) => {
  console.log('백그라운드 메시지 수신:', payload);
  
  // payload.data에서 읽기
  const title = payload.data?.title || '새 알림';
  const body = payload.data?.body || '새로운 알림이 도착했습니다.';
  
  const notificationOptions = {
    body: body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'backoffice-notification',
    requireInteraction: false,
    data: payload.data || {},
    silent: false
  };

  console.log('알림 표시:', title, body);
  return self.registration.showNotification(title, notificationOptions);
});
console.log('✅ [통합SW] Firebase 초기화 완료');

// =================== 캐싱 기능 ===================
const CACHE_NAME = 'stock-pwa-v3';
const IMAGE_CACHE_NAME = 'images-v1';

const STATIC_FILES = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('🔥 [통합SW] Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🔥 [통합SW] Service Worker 활성화됨');
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
  
  // ⭐ SvelteKit _app 파일들은 절대 건드리지 않음 (핵심!)
  if (request.url.includes('/_app/')) {
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
                console.warn('🔥 [통합SW] 캐시 저장 실패:', error);
              }
            }
            return fetchResponse;
          });
        });
      })
    );
    return;
  }
  
  // 정적 파일 캐싱 (script, style만)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request);
      })
    );
    return; // ⭐ return 추가해서 else 부분 실행 안 되도록
  }
  
  // ⭐ 원래 문제였던 else 부분 제거!
  // else {
  //   event.respondWith(fetch(request)); // 이게 SvelteKit 파일들을 차단
  // }
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [통합SW] 알림 클릭됨:', event.notification.title);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('🔥 [통합SW] 통합 Service Worker 로드 완료');