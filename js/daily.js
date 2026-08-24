// Le mot du jour : la même grille pour tout le monde, sans serveur.
//
// Personne ne distribue le mot — chaque navigateur le retrouve seul à partir
// de la date. La liste des solutions est committée et identique partout, donc
// un même jour donne un même index, donc un même mot. C'est aussi la limite
// assumée : l'horloge de la machine fait foi, et se tricher soi-même est
// possible et sans intérêt.
//
// Une régénération de data/ décalerait les mots des jours suivants. Elle
// s'accompagne d'un changement de version, comme le reste.

import { MIN_LENGTH, MAX_LENGTH } from './engine.js';

const KEY = 'jour';
const SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// La date locale, pas UTC : le jour change à minuit chez le joueur.
export function today(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Une date bien formée ne suffit pas : 2026-02-31 s'écrit sans peine et ne
// désigne rien. On la reconstruit pour vérifier qu'elle existe.
export function isDay(value) {
    if (!SHAPE.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// Le jour demandé par l'URL (`?jour=AAAA-MM-JJ`), ou null.
export function readDay(search) {
    try {
        const value = new URLSearchParams(search).get(KEY);
        return isDay(value) ? value : null;
    } catch (e) {
        return null; // URL illisible : partie libre
    }
}

// FNV-1a, comme dans les autres jeux du dossier : court, déterministe, et
// identique en Node et dans le navigateur — donc testable.
export function hash(text) {
    let value = 2166136261;
    for (const character of String(text)) {
        value ^= character.codePointAt(0);
        value = Math.imul(value, 16777619);
    }
    value ^= value >>> 16;
    value = Math.imul(value, 0x21f0aaad);
    value ^= value >>> 15;
    value = Math.imul(value, 0x735a2d97);
    return (value ^ (value >>> 15)) >>> 0;
}

// Deux tirages indépendants à partir de la même date : le préfixe évite que la
// longueur et l'index soient corrélés.
export function dayLength(day) {
    const span = MAX_LENGTH - MIN_LENGTH + 1;
    return MIN_LENGTH + (hash(`longueur:${day}`) % span);
}

export function dayIndex(day, count) {
    return hash(`mot:${day}`) % count;
}

export function dayLink(baseUrl, day) {
    return `${baseUrl}?${KEY}=${day}`;
}

// 2026-08-24 -> 24/08/2026, la forme lue dans un message partagé.
export function formatDay(day) {
    const [year, month, date] = day.split('-');
    return `${date}/${month}/${year}`;
}
