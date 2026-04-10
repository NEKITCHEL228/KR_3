/**
 * Service Worker для учебного PWA-проекта.
 *
 * В текущей версии реализована базовая стратегия Cache First:
 * 1. На install кэшируются основные статические ресурсы.
 * 2. На activate удаляются старые версии кэша.
 * 3. На fetch сначала ищем ответ в кэше, затем в сети.
 *
 * Такой вариант подходит для учебного шаблона.
 * Более продвинутые стратегии специально оставлены студентам как TODO.
 */

const CACHE_NAME = 'practice-13-14-cache-v5';

/**
 * Набор ресурсов, которые кладём в кэш сразу при установке Service Worker.
 * Пути должны совпадать с фактической структурой проекта.
 */
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './assets/hero.png',
  './assets/icons/favicon.ico',
  './assets/icons/favicon-16x16.png',
  './assets/icons/favicon-32x32.png',
  './assets/icons/favicon-48x48.png',
  './assets/icons/favicon-64x64.png',
  './assets/icons/favicon-128x128.png',
  './assets/icons/favicon-256x256.png',
  './assets/icons/favicon-512x512.png',
  './assets/icons/apple-touch-icon-57x57.png',
  './assets/icons/apple-touch-icon-114x114.png',
  './assets/icons/apple-touch-icon-120x120.png',
  './assets/icons/apple-touch-icon.png'
];

// Страница, которую отдаем при отсутствии кэша и сети
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Нет соединения</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #020617; color: #e5e7eb; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .box { text-align: center; padding: 32px; max-width: 380px; }
    h1   { font-size: 28px; margin-bottom: 12px; }
    p    { color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="box">
    <h1>📡 Нет соединения</h1>
    <p>Страница недоступна офлайн.<br>
       Проверьте подключение к интернету и попробуйте снова.</p>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────
// Вспомогательная функция: определяем стратегию
// ─────────────────────────────────────────────

/**
 * Определяет, какую стратегию применить к запросу.
 *
 * @param {Request} request
 * @returns {'network-first' | 'stale-while-revalidate' | 'cache-first'}
 */
function getStrategy(request) {
  const url = new URL(request.url);
  const ext = url.pathname.split('.').pop().toLowerCase();

  // Навигационные запросы - всегда Network First.
  if (request.mode === 'navigate') {
    return 'network-first';
  }

  // Изображения, иконки, CSS, JS и манифест меняются при деплое, но не критично показать старую версию на сек
  if (['css', 'js', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'].includes(ext)) {
    return 'stale-while-revalidate';
  }

  // Для всего остального используем Network First как более безопасный вариант.
  return 'network-first';
}

// ─────────────────────────────────────────────
// Стратегии кэширования
// ─────────────────────────────────────────────

/**
 * Network First — сначала сеть, при неудаче кэш.
 * Используется для: HTML-страниц и навигационных запросов.
 *
 * @param {FetchEvent} event
 */
function networkFirst(event) {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Сеть ответила — сохраняем свежую версию в кэш и отдаём её.
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Сеть недоступна — пробуем отдать из кэша.
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // Кэша тоже нет — возвращаем офлайн-страницу для навигации
          // или минимальный 503 для остальных запросов.
          if (event.request.mode === 'navigate') {
            return new Response(OFFLINE_PAGE, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }

          return new Response('Офлайн: ресурс недоступен.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
  );
}

/**
 * Stale While Revalidate — сразу кэш, в фоне обновление из сети.
 * Используется для: CSS, JS, manifest.json.
 * 
 * @param {FetchEvent} event
 */
function staleWhileRevalidate(event) {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {

        // Параллельно запускаем обновление кэша в фоне.
        const networkFetch = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => {
          // Сеть недоступна
        });

        return cachedResponse || networkFetch;
      });
    })
  );
}

/**
 * install:
 * предварительное кэширование основных ресурсов.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );

  self.skipWaiting();
});

/**
 * activate:
 * удаляем устаревшие версии кэша.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheKeys) => {
      return Promise.all(
        cacheKeys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      );
    })
  );

  self.clients.claim();
});

/**
 * fetch:
 * базовая стратегия разные стратегии для разных файлов.
 *
 */
self.addEventListener('fetch', (event) => {
  // Обрабатываем только GET запросы
  if (event.request.method !== 'GET') {
    return;
  }

  // Получаем стратегию и в зависимости от нее обрабатываем запрос
  const strategy = getStrategy(event.request);

  if (strategy === 'network-first') {
    networkFirst(event);
  } else if (strategy === 'stale-while-revalidate') {
    staleWhileRevalidate(event);
  } else if (strategy === 'cache-first') {
    cacheFirst(event);
  };
});
