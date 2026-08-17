// Service worker : rend le jeu jouable hors ligne.
//
// Le squelette de l'application (HTML, CSS, JS, icones) est mis en cache a
// l'installation : c'est petit et il faut qu'il soit la des la premiere coupure
// reseau. Mais il est ensuite servi reseau d'abord, cache en secours. Le
// cache-first serait plus rapide et c'est un piege : un `git push` resterait
// invisible pour tous ceux qui ont deja ouvert le jeu, jusqu'a ce qu'on pense a
// changer VERSION a la main. Un aller-retour de 30 Ko par visite est un prix
// tres bas pour ne pas dependre de cette vigilance.
//
// Les listes de mots suivent la regle inverse. Elles pesent 630 Ko pour les
// quatre longueurs : les precharger ferait payer a chacun trois fichiers qu'il
// ne jouera peut-etre jamais. Elles sont donc mises en cache au fil des parties,
// puis servies depuis le cache, leur contenu ne changeant que lors d'une
// regeneration de data/ — qui s'accompagne alors d'un changement de VERSION.

const VERSION = 'sutom-v1';
const SHELL = [
    './',
    'index.html',
    'css/style.css',
    'js/app.js',
    'js/engine.js',
    'js/dictionary.js',
    'js/storage.js',
    'js/ui.js',
    'manifest.webmanifest',
    'assets/icon.svg',
    'assets/icon-192.png',
    'assets/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== VERSION).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, response.clone());
    }
    return response;
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(VERSION);
            cache.put(request, response.clone());
        }
        return response;
    } catch (e) {
        const cached = await caches.match(request) || await caches.match('index.html');
        if (cached) return cached;
        throw e;
    }
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const isWordList = url.pathname.includes('/data/');
    event.respondWith(isWordList ? cacheFirst(request) : networkFirst(request));
});
