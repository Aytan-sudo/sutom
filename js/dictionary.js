// Accès aux listes de mots.
//
// Les fichiers sont découpés par longueur : une partie de 7 lettres ne
// télécharge que lexique-7.txt (~120 Ko), pas les 630 Ko de data/. Une fois
// chargés ils restent en mémoire, et le service worker les garde sur disque.

import { MIN_LENGTH, MAX_LENGTH, normalize } from './engine.js';

const cache = new Map(); // longueur -> { solutions: [], lexicon: Set }
const pending = new Map(); // longueur -> Promise, pour ne pas fetcher deux fois

function parse(text) {
    return text.split('\n').map(line => line.trim()).filter(Boolean);
}

async function fetchList(name) {
    const response = await fetch(`data/${name}`);
    if (!response.ok) throw new Error(`${name} : HTTP ${response.status}`);
    return parse(await response.text());
}

export function randomLength() {
    const span = MAX_LENGTH - MIN_LENGTH + 1;
    return MIN_LENGTH + Math.floor(Math.random() * span);
}

export async function load(length) {
    if (cache.has(length)) return cache.get(length);
    if (pending.has(length)) return pending.get(length);

    const task = (async () => {
        const [solutions, lexicon] = await Promise.all([
            fetchList(`solutions-${length}.txt`),
            fetchList(`lexique-${length}.txt`)
        ]);
        const entry = { solutions, lexicon: new Set(lexicon) };
        cache.set(length, entry);
        pending.delete(length);
        return entry;
    })();

    pending.set(length, task);
    return task;
}

// Tire un mot en évitant ceux joués récemment. Si l'historique couvre tout le
// stock (impossible en pratique : ~2000 mots par longueur), on ignore le filtre
// plutôt que de tourner en boucle.
export async function pickSolution(length, recent = []) {
    const { solutions } = await load(length);
    const avoid = new Set(recent);
    const pool = solutions.filter(word => !avoid.has(word));
    const list = pool.length ? pool : solutions;
    return list[Math.floor(Math.random() * list.length)];
}

// Un mot est jouable s'il a la bonne longueur et figure au lexique. Les
// solutions sont incluses dans le lexique (vérifié par tests/test-data.mjs).
export function isPlayable(word, length) {
    const entry = cache.get(length);
    if (!entry) return false;
    const clean = normalize(word);
    return clean.length === length && entry.lexicon.has(clean);
}
