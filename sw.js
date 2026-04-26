// 클라우드 버전 서비스 워커 (v2.0.0)
// Firebase 요청 간섭을 피하기 위해 정적 자산만 캐시합니다.
const CACHE_NAME = 'smart-class-cloud-v1.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/auth.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/firebase-config.js',
  '/js/firebase-db.js',
  '/js/seating.js',
  '/js/students.js',
  '/js/attendance.js',
  '/js/behavior.js',
  '/js/timetable.js',
  '/js/export.js',
  '/js/phrases.js',
  '/js/counseling.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 설치: 정적 자산 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 즉시 활성화 (기다리지 않음)
  self.skipWaiting();
});

// 활성화: 구 버전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase 관련 요청은 서비스 워커가 개입하지 않음 (항상 네트워크 우선)
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com')
  ) {
    return; // 기본 fetch 동작으로 통과
  }

  // 정적 자산: 캐시 우선(Cache-First) 전략
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // GET 요청만 캐시
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
