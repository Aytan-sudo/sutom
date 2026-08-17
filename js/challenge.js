// Lien de defi : le mot a deviner voyage dans le fragment de l'URL.
//
// Sans ca le partage ne veut rien dire. En partie libre chacun tire un mot au
// hasard, donc une grille d'emojis envoyee a un ami ne se compare a rien : il
// cherchait un autre mot. Le fragment porte le mot, celui qui ouvre le lien
// affronte exactement la meme grille.
//
// Le code n'est pas du chiffrement, seulement un encodage : de quoi ne pas lire
// la reponse dans la barre d'adresse ou dans l'apercu du message. Qui veut
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
        return null; // code tronque ou bricole a la main
    }
}

export function buildLink(baseUrl, word) {
    return `${baseUrl}#${KEY}=${encodeWord(word)}`;
}

// Retourne le mot du defi contenu dans un fragment d'URL, ou null.
export function readChallenge(hash) {
    if (!hash) return null;
    const match = new RegExp(`[#&]${KEY}=([A-Za-z0-9_-]+)`).exec(hash);
    return match ? decodeWord(match[1]) : null;
}
