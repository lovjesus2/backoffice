const CACHE_NAME = 'stock-pwa-v1';

// 캐시할 정적 파일들 (최소한만)
const STATIC_FILES = [
  '/',
  '/manifest.json'
];

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치 중...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES);
    })
  );
  
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화됨');
  
  event.waitUntil(
    Promise.all([
      // 오래된 캐시 정리
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 클라이언트 제어권 획득
      self.clients.claim()
    ])
  );
});

// 네트워크 요청 처리 (온라인 전용)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 정적 파일은 캐시 우선, API는 네트워크 우선
  if (request.destination === 'document' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request);
      })
    );
  } else {
    // API 요청과 이미지는 항상 네트워크에서 최신 데이터 가져오기
    event.respondWith(fetch(request));
  }
});

// PWA 기본 설정 완료