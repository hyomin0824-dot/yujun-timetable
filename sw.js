// 네트워크 우선 서비스워커: 항상 최신 파일을 먼저 받아오고,
// 인터넷이 끊겼을 때만 저장해둔 캐시를 보여줍니다.
// (이전 버전은 캐시를 우선해서, 앱을 새로 고쳐도 옛 화면이 계속 보이는 문제가 있었어요.)
const CACHE = "yujun-timetable-v4";
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
  // 같은 출처(앱 파일)만 처리, 그 외(Firebase 등)는 그대로 통과
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
