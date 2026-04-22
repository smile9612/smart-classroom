const CACHE_NAME = 'smart-class-cache-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/seating.js',
  '/js/students.js',
  '/js/attendance.js',
  '/js/behavior.js',
  '/js/timetable.js',
  '/js/export.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900&display=swap'
];

self.addEventListener('install', event => {
  // 캐시 생성 및 파일 저장
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // 네트워크 요청 우선 (Network-First) 전략
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 네트워크 요청 성공 시 캐시 업데이트 후 반환
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 확인
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  // 이전 버전 캐시 삭제
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
