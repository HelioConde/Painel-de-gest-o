// Cache apenas do app; nunca de dados Supabase nem da verificacao de versao.
const CACHE_NAME = 'primor-gestao-static-v2'
const CACHE_PREFIX = 'primor-gestao-'
const MAX_STATIC_ASSETS = 70

function inScope(url) {
  return url.origin === self.location.origin &&
    url.pathname.startsWith(new URL(self.registration.scope).pathname)
}

function isStaticAsset(url) {
  return /\/assets\/[^/]+\.(?:js|css|png|jpe?g|webp|svg|gif|woff2?|otf|ttf)$/i.test(url.pathname) ||
    url.pathname.endsWith('/primor-icon.png') ||
    url.pathname.endsWith('/manifest.webmanifest')
}

async function storeStatic(request, response) {
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response)
  const assets = (await cache.keys()).filter((entry) =>
    new URL(entry.url).pathname.includes('/assets/'))
  for (const old of assets.slice(0, Math.max(0, assets.length - MAX_STATIC_ASSETS))) {
    await cache.delete(old)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['./', './primor-icon.png', './manifest.webmanifest']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (!inScope(url)) return
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          event.waitUntil(caches.open(CACHE_NAME)
            .then((cache) => cache.put('./', response.clone()))
            .catch(() => undefined))
        }
        return response
      }).catch(async () => {
        const cached = await caches.match('./')
        if (cached) return cached
        throw new Error('offline')
      })
    )
    return
  }

  if (!isStaticAsset(url)) return

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        event.waitUntil(storeStatic(request, response.clone()).catch(() => undefined))
      }
      return response
    })
  )
})
