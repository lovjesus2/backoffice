// static/firebase-messaging-sw.js (메시지 중복 방지)

// =================== 캐싱 기능 ===================
const CACHE_NAME = 'stock-pwa-v2';
const IMAGE_CACHE_NAME = 'images-v1';

const STATIC_FILES = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('🔥 [firebase-messaging-sw.js] Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (request.url.startsWith('chrome-extension://') || 
      request.url.startsWith('moz-extension://') || 
      request.url.startsWith('safari-extension://') ||
      request.url.startsWith('ms-browser-extension://')) {
    return;
  }
  
  if (request.url.startsWith('data:') || 
      request.url.startsWith('blob:') || 
      request.url.startsWith('about:')) {
    return;
  }
  
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
  
  if (request.destination === 'document') {
    return;
  }
  
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

importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCrZQO0K4I3rxXF1uHU0X3iJenAYARSz3w",
  authDomain: "backoffice-31d48.firebaseapp.com",
  projectId: "backoffice-31d48",
  storageBucket: "backoffice-31d48.firebasestorage.app",
  messagingSenderId: "550267566582",
  appId: "1:550267566582:web:df3990e8d73923976e6fd7"
});

const messaging = firebase.messaging();

// 🚫 메시지 중복 방지 저장소
const messageHistory = new Map();
const DUPLICATE_WINDOW = 5000; // 5초 내 중복 차단

// 🔥 백그라운드 메시지 핸들러 (중복 차단)
messaging.onBackgroundMessage((payload) => {
  console.log('🔥 [SW] 백그라운드 메시지 수신:', payload);
  
  const title = payload.notification?.title || '새 알림';
  const body = payload.notification?.body || '새로운 알림이 도착했습니다.';
  const messageId = payload.data?.messageId || `${title}-${body}-${Date.now()}`;
  
  // 🚫 중복 메시지 체크
  const now = Date.now();
  if (messageHistory.has(messageId)) {
    const lastTime = messageHistory.get(messageId);
    if (now - lastTime < DUPLICATE_WINDOW) {
      console.log('🚫 [SW] 중복 메시지 차단:', messageId);
      return; // 중복 메시지 무시
    }
  }
  
  // 메시지 기록 저장
  messageHistory.set(messageId, now);
  
  // 오래된 기록 정리 (메모리 절약)
  for (const [id, time] of messageHistory.entries()) {
    if (now - time > DUPLICATE_WINDOW) {
      messageHistory.delete(id);
    }
  }
  
  const notificationOptions = {
    body: body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'backoffice-push', // 🔥 같은 tag로 기존 알림 대체
    requireInteraction: false,
    renotify: false, // 🔥 같은 tag 재알림 방지
    silent: false,
    data: {
      ...payload.data,
      messageId: messageId,
      timestamp: now
    }
  };

  console.log('✅ [SW] 백그라운드 알림 표시:', title);
  return self.registration.showNotification(title, notificationOptions);
});

// 🔔 알림 클릭 이벤트
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] 알림 클릭:', event.notification.title);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열린 창이 있으면 포커스
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

console.log('🔥 [SW] Firebase Messaging Service Worker 로드 완료');