const CACHE_NAME = "internal-toolkit-shell-v3";
const APP_SHELL_ROUTES = [
  "/",
  "/home",
  "/chat",
  "/assistant",
  "/settings",
  "/login",
  "/manifest.json",
];
const READ_API_PREFIXES = ["/v1/ai/models", "/v1/ai/usage", "/v1/shortcuts"];
const READ_PAGE_PREFIXES = ["/chat", "/assistant", "/settings", "/home"];

function shouldCacheGetRequest(url) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  const pathname = url.pathname;
  if (READ_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return READ_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ROUTES))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .catch(() => undefined),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET") {
    event.respondWith(
      fetch(request).catch(() =>
        Response.json(
          {
            ok: false,
            error: "offline_mutations_blocked",
            message:
              "You are offline. Mutating actions are disabled until connection returns.",
          },
          { status: 503 },
        ),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(CACHE_NAME);
          void cache.put(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }

          const fallback = await caches.match("/chat");
          return fallback ?? Response.error();
        }),
    );
    return;
  }

  if (!shouldCacheGetRequest(requestUrl)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            void cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        void networkPromise;
        return cached;
      }

      const network = await networkPromise;
      return network ?? Response.error();
    }),
  );
});
