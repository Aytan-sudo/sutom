// Persistance : statistiques, partie en cours, mots vus récemment.
//
// localStorage peut lever (navigation privée très stricte, quota, iframe sans
// accès au stockage). Une exception ici ne doit jamais empêcher de jouer : on
// sonde une fois au démarrage et on retombe sur une mémoire volatile, la partie
// se déroule normalement, seules les stats sont perdues à la fermeture.

import { DEFAULT_THEME } from './themes.js';

const KEY_STATS = 'sutom.stats';
const KEY_GAME = 'sutom.game';
const KEY_RECENT = 'sutom.recent';
const KEY_HELP_SEEN = 'sutom.help-seen';
const KEY_SETTINGS = 'sutom.settings';
const KEY_DAILY = 'sutom.daily';
const RECENT_MAX = 60; // ~3 % du stock d'une longueur : évite les redites proches
const DAILY_MAX = 180; // six mois de résultats quotidiens gardés
const DAILY_SCHEMA = 1;

const memory = new Map();

const available = (() => {
    try {
        const probe = '__sutom_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return true;
    } catch (e) {
        return false;
    }
})();

function read(key, fallback) {
    try {
        const raw = available ? localStorage.getItem(key) : memory.get(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback; // donnée illisible : on repart proprement
    }
}

function write(key, value) {
    const raw = JSON.stringify(value);
    try {
        if (available) localStorage.setItem(key, raw);
        else memory.set(key, raw);
    } catch (e) {
        memory.set(key, raw);
    }
}

function remove(key) {
    try {
        if (available) localStorage.removeItem(key);
    } catch (e) { /* rien à faire */ }
    memory.delete(key);
}

// Options du joueur. Elles se fusionnent avec les valeurs par défaut à la
// lecture : ajouter une option plus tard ne casse pas une préférence déjà
// enregistrée, et une valeur inconnue ne laisse jamais un champ indéfini.
export function defaultSettings() {
    return {
        theme: DEFAULT_THEME,
        sound: true,
        vibration: true,
        freeInput: false // effacer/remplacer les lettres déjà trouvées
    };
}

export function loadSettings() {
    const saved = read(KEY_SETTINGS, null);
    if (!saved || typeof saved !== 'object') return defaultSettings();
    return { ...defaultSettings(), ...saved };
}

export function saveSettings(settings) {
    write(KEY_SETTINGS, settings);
    return settings;
}

export function emptyStats() {
    return {
        played: 0,
        won: 0,
        streak: 0,
        bestStreak: 0,
        distribution: [0, 0, 0, 0, 0, 0] // nombre de victoires par nombre d'essais
    };
}

export function loadStats() {
    const stats = read(KEY_STATS, null);
    if (!stats || typeof stats.played !== 'number') return emptyStats();
    return { ...emptyStats(), ...stats };
}

// Enregistre une partie terminée. `attempts` n'est lu que pour une victoire.
export function recordGame(won, attempts) {
    const stats = loadStats();
    stats.played++;
    if (won) {
        stats.won++;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        const slot = attempts - 1;
        if (slot >= 0 && slot < stats.distribution.length) stats.distribution[slot]++;
    } else {
        stats.streak = 0;
    }
    write(KEY_STATS, stats);
    return stats;
}

export function resetStats() {
    remove(KEY_STATS);
    remove(KEY_DAILY);
    return emptyStats();
}

// ------------------------------------------------------------------ mot du jour

// Les résultats quotidiens vivent à part des statistiques générales : la série
// quotidienne compte les jours d'affilée, pas les victoires d'affilée, et une
// partie libre ne doit ni l'allonger ni la casser.
//
// Cette clé est née après les autres, elle porte donc une version de schéma.
export function emptyDaily() {
    return { schema: DAILY_SCHEMA, streak: 0, bestStreak: 0, lastDay: null, results: {} };
}

export function loadDaily() {
    const saved = read(KEY_DAILY, null);
    if (!saved || saved.schema !== DAILY_SCHEMA) return emptyDaily();
    return { ...emptyDaily(), ...saved, results: { ...saved.results } };
}

export function dailyResult(day) {
    return loadDaily().results[day] || null;
}

// Écart en jours entre deux dates AAAA-MM-JJ. On passe par midi UTC pour que
// les changements d'heure ne fassent pas d'un jour 23 ou 25 heures.
function daysBetween(from, to) {
    const a = Date.parse(`${from}T12:00:00Z`);
    const b = Date.parse(`${to}T12:00:00Z`);
    return Math.round((b - a) / 86400000);
}

// `sameDay` dit si le joueur a joué ce défi le jour même : lui seul compte pour
// la série. Rouvrir un vieux lien redonne la grille, jamais la série.
export function recordDaily(day, result, sameDay) {
    const daily = loadDaily();
    if (daily.results[day]) return daily; // déjà joué : le premier verdict fait foi

    daily.results[day] = result;
    const days = Object.keys(daily.results).sort();
    for (const old of days.slice(0, Math.max(0, days.length - DAILY_MAX))) {
        delete daily.results[old];
    }

    if (sameDay) {
        if (!result.won) daily.streak = 0;
        else daily.streak = daily.lastDay && daysBetween(daily.lastDay, day) === 1 ? daily.streak + 1 : 1;
        daily.bestStreak = Math.max(daily.bestStreak, daily.streak);
        daily.lastDay = day;
    }

    write(KEY_DAILY, daily);
    return daily;
}

export function loadGame() {
    return read(KEY_GAME, null);
}

// `day` accompagne la partie sauvegardée : sans lui, recharger la page en plein
// mot du jour relancerait une partie libre sur le même mot, hors série.
export function saveGame(game, day = null) {
    write(KEY_GAME, { ...game.toJSON(), day });
}

export function clearGame() {
    remove(KEY_GAME);
}

// Les règles ne s'ouvrent qu'à la toute première visite. Se fier au nombre de
// parties jouées ne suffisait pas : tant qu'aucune partie n'était terminée,
// elles revenaient à chaque rechargement.
export function hasSeenHelp() {
    return read(KEY_HELP_SEEN, false) === true;
}

export function markHelpSeen() {
    write(KEY_HELP_SEEN, true);
}

export function loadRecent() {
    const recent = read(KEY_RECENT, []);
    return Array.isArray(recent) ? recent : [];
}

export function pushRecent(word) {
    const recent = [word, ...loadRecent().filter(w => w !== word)].slice(0, RECENT_MAX);
    write(KEY_RECENT, recent);
    return recent;
}
