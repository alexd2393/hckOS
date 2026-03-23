/**
 * service-worker.js — AleXim Mobile PWA
 * Cachea todos los archivos del juego para funcionar offline
 */

const CACHE_NAME = 'alexim-mobile-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/game-systems.css',
  '/manifest.json',
  '/js/main.js',
  '/js/mainMenu.js',
  '/js/gameState.js',
  '/js/audio.js',
  '/js/ui.js',
  '/js/terminal.js',
  '/js/balanceConfig.js',
  '/js/ledgerSystem.js',
  '/js/reputationSystem.js',
  '/js/inventorySystem.js',
  '/js/localSystem.js',
  '/js/darkMarketSystem.js',
  '/js/economySystem.js',
  '/js/pursuitSystem.js',
  '/js/nodeGenerator.js',
  '/js/eventSystem.js',
  '/js/missionEngine.js',
  '/js/saveSystem.js',
  '/js/securityLayerSystem.js',
  '/js/hackingEngine.js',
  '/js/network.js',
  '/js/gameLoop.js',
  '/js/localSystem_commands.js',
  '/js/tutorialSystem.js',
  '/js/aleximOS.js',
  '/js/toolsSystem.js',
  '/js/karmaSystem.js',
  '/js/missions.js',
  '/js/newsSystem.js',
  '/js/personGenerator.js',
  '/js/relationshipSystem.js',
  '/js/socialContentGenerator.js',
  '/js/darkForumSystem.js',
  '/js/worldConnector.js',
  '/js/worldPopulation.js',
  '/js/adversarialSystem.js',
  '/js/osintegration.js',
  '/js/integration-patch.js',
  '/js/mobileOS.js',
  '/data/missions.json',
  '/data/news.json',
  '/data/tools.json',
  '/data/dialogue.json'
];

// Instalar: cachear todos los assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first (offline primero)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match('/index.html'))
  );
});
