const CACHE_NAME = 'stock-pwa-v2';
const IMAGE_CACHE_NAME = 'images-v1'; // 이미지 전용 캐시

const STATIC_FILES = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화됨');
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
  const url = new URL(request.url);
  
  // ✅ chrome-extension, moz-extension 등 브라우저 확장 프로그램 URL 필터링
  if (request.url.startsWith('chrome-extension://') || 
      request.url.startsWith('moz-extension://') || 
      request.url.startsWith('safari-extension://') ||
      request.url.startsWith('ms-browser-extension://')) {
    console.log('🚫 브라우저 확장 프로그램 URL 무시:', request.url);
    return; // 확장 프로그램 요청은 처리하지 않음
  }
  
  // ✅ data:, blob:, about: 등 특수 스키마 URL 필터링
  if (request.url.startsWith('data:') || 
      request.url.startsWith('blob:') || 
      request.url.startsWith('about:')) {
    console.log('🚫 특수 스키마 URL 무시:', request.url);
    return;
  }
  
  // ✅ 허용된 도메인만 처리
  const allowedHosts = [
    self.location.origin,
    'https://cdnjs.cloudflare.com',
    'https://image.kungkungne.synology.me'
  ];
  
  const isAllowedHost = allowedHosts.some(host => 
    request.url.startsWith(host)
  );
  
  if (!isAllowedHost) {
    console.log('🚫 허용되지 않은 호스트:', request.url);
    return; // 허용되지 않은 도메인은 무시
  }
  
  // SvelteKit 페이지는 건드리지 않음
  if (request.destination === 'document') {
    return;
  }
  
  // 🖼️ 이미지 캐싱 강화 
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(cache => {
        return cache.match(request).then(response => {
          if (response) {
            console.log('🖼️ 이미지 캐시에서 제공:', url.pathname);
            return response;
          }
          
          return fetch(request).then(fetchResponse => {
            // 이미지 요청 성공 시에만 캐시 저장
            if (fetchResponse && fetchResponse.ok) {
              console.log('🖼️ 새 이미지 캐시 저장:', url.pathname);
              // ✅ try-catch로 캐시 저장 실패 방지
              try {
                cache.put(request, fetchResponse.clone());
              } catch (error) {
                console.warn('🚫 이미지 캐시 저장 실패:', error);
              }
            }
            return fetchResponse;
          }).catch(error => {
            console.warn('🚫 이미지 fetch 실패:', error);
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }
  
  // 기존 정적 파일 캐싱 (에러 처리 강화)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response;
        }
        
        return fetch(request).then(fetchResponse => {
          // ✅ 정적 파일도 try-catch로 캐시 저장 실패 방지
          if (fetchResponse && fetchResponse.ok) {
            try {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, fetchResponse.clone());
              });
            } catch (error) {
              console.warn('🚫 정적 파일 캐시 저장 실패:', error);
            }
          }
          return fetchResponse;
        }).catch(error => {
          console.warn('🚫 정적 파일 fetch 실패:', error);
          return new Response('', { status: 404 });
        });
      })
    );
  } else {
    // 기타 요청은 캐시 없이 바로 fetch
    event.respondWith(
      fetch(request).catch(error => {
        console.warn('🚫 기타 요청 실패:', error);
        return new Response('', { status: 404 });
      })
    );
  }
});