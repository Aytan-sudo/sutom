// Lien de défi : le mot à deviner voyage dans le fragment de l'URL.
//
// Sans ça le partage ne veut rien dire. En partie libre chacun tire un mot au
// hasard, donc une grille d'emojis envoyée à un ami ne se compare à rien : il
// cherchait un autre mot. Le fragment porte le mot, celui qui ouvre le lien
// affronte exactement la même grille.
//
// Le code n'est pas du chiffrement, seulement un encodage : de quoi ne pas lire
// la réponse dans la barre d'adresse ou dans l'aperçu du message. Qui veut
// tricher y arrivera, comme sur tout jeu dont la logique tient dans le
// navigateur — mais on ne se spoile pas par accident, et c'est le but.
//
// Le fragment n'est jamais transmis au serveur : le mot ne quitte pas le lien.

import { normalize, MIN_LENGTH, MAX_LENGTH } from './engine.js';

const KEY = 'defi';

// Base64 dans sa variante URL : ni + ni / ni = , qui se font mal recopier
// quand un lien passe par un SMS ou une messagerie.
export function encodeWord(word) {
    return btoa(normalize(word))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function decodeWord(code) {
    try {
        const word = normalize(atob(code.replace(/-/g, '+').replace(/_/g, '/')));
        if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) return null;
        return word;
    } catch (e) {
        return null; // code tronqué ou bricolé à la main
    }
}

export function buildLink(baseUrl, word) {
    return `${baseUrl}#${KEY}=${encodeWord(word)}`;
}

// Retourne le mot du défi contenu dans un fragment d'URL, ou null.
export function readChallenge(hash) {
    if (!hash) return null;
    const match = new RegExp(`[#&]${KEY}=([A-Za-z0-9_-]+)`).exec(hash);
    return match ? decodeWord(match[1]) : null;
}
