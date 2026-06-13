// 아주 단순한 서비스워커: 앱 셸을 캐시해서 오프라인에서도 화면이 열리게 합니다.
// 일정/할일/댓글 데이터는 Firestore에서 실시간으로 받아오므로 캐시하지 않습니다.
const CACHE = "yujun-timetable-v2";
const ASSETS = ["./", "./index.html", "./app.jsx", "./firebase-config.js", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // 같은 출처(앱 파일)만 캐시 우선, 그 외(Firebase 등)는 항상 네트워크
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copy));
          return res;
        }).catch(() => cached)
    )
  );
});
