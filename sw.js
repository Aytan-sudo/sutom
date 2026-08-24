// Service worker : rend le jeu jouable hors ligne.
//
// Le squelette de l'application (HTML, CSS, JS, icônes) est mis en cache à
// l'installation : c'est petit et il faut qu'il soit là dès la première coupure
// réseau. Mais il est ensuite servi réseau d'abord, cache en secours. Le
// cache-first serait plus rapide et c'est un piège : un `git push` resterait
// invisible pour tous ceux qui ont déjà ouvert le jeu, jusqu'à ce qu'on pense à
// changer VERSION à la main. Un aller-retour de 30 Ko par visite est un prix
// très bas pour ne pas dépendre de cette vigilance.
//
// Les listes de mots suivent la règle inverse. Elles pèsent 630 Ko pour les
// quatre longueurs : les précharger ferait payer à chacun trois fichiers qu'il
// ne jouera peut-être jamais. Elles sont donc mises en cache au fil des parties,
// puis servies depuis le cache, leur contenu ne changeant que lors d'une
// régénération de data/ — qui s'accompagne alors d'un changement de VERSION.

const VERSION = 'sutom-1.1.0';
const SHELL = [
    './',
    'index.html',
    'css/themes.css',
    'css/style.css',
    'js/app.js',
    'js/config.js',
    'js/challenge.js',
    'js/daily.js',
    'js/engine.js',
    'js/dictionary.js',
    'js/sound.js',
    'js/storage.js',
    'js/themes.js',
    'js/ui.js',
    'manifest.webmanifest',
    'assets/icon.svg',
    'assets/icon-180.png',
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
