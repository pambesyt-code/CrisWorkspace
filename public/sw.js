/*
 * Service worker de CrisWorkspace: permite abrir la app sin conexión.
 *
 * - Páginas: primero la red (para recibir actualizaciones); si no hay red, la
 *   última copia guardada.
 * - Archivos estáticos de Next (/_next/static, con nombre único por versión),
 *   iconos y fuentes: primero la caché.
 * Los datos del usuario no pasan por aquí: viven en IndexedDB.
 *
 * Funciona en la raíz (local) y en una subcarpeta (GitHub Pages): todas las
 * rutas se calculan a partir del ámbito con el que se registró.
 */
const VERSION = "v1";
const CACHE = `crisworkspace-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname; // "/" o "/crisworkspace/"
const HOME = BASE;
const PRECACHE = [HOME, `${BASE}manifest.webmanifest`, `${BASE}iconos/icono-192.png`, `${BASE}iconos/icono-512.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("crisworkspace-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith(`${BASE}_next/static/`) ||
    url.pathname.startsWith(`${BASE}iconos/`) ||
    /\.(?:png|svg|ico|woff2?|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(HOME, copy));
          }
          return response;
        })
        .catch(() => caches.match(HOME).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
