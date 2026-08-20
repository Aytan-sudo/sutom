// Persistance : statistiques, partie en cours, mots vus recemment.
//
// localStorage peut lever (navigation privee tres stricte, quota, iframe sans
// acces au stockage). Une exception ici ne doit jamais empecher de jouer : on
// sonde une fois au demarrage et on retombe sur une memoire volatile, la partie
// se deroule normalement, seules les stats sont perdues a la fermeture.

const KEY_STATS = 'sutom.stats';
const KEY_GAME = 'sutom.game';
const KEY_RECENT = 'sutom.recent';
const KEY_HELP_SEEN = 'sutom.help-seen';
const KEY_SETTINGS = 'sutom.settings';
const RECENT_MAX = 60; // ~3 % du stock d'une longueur : evite les redites proches

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
        return fallback; // donnee illisible : on repart proprement
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
    } catch (e) { /* rien a faire */ }
    memory.delete(key);
}

// Options du joueur. Elles se fusionnent avec les valeurs par defaut a la
// lecture : ajouter une option plus tard ne casse pas une preference deja
// enregistree, et une valeur inconnue ne laisse jamais un champ indefini.
export function defaultSettings() {
    return {
        freeInput: false // effacer/remplacer les lettres deja trouvees
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

// Enregistre une partie terminee. `attempts` n'est lu que pour une victoire.
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
    return emptyStats();
}

export function loadGame() {
    return read(KEY_GAME, null);
}

export function saveGame(game) {
    write(KEY_GAME, game);
}

export function clearGame() {
    remove(KEY_GAME);
}

// Les regles ne s'ouvrent qu'a la toute premiere visite. Se fier au nombre de
// parties jouees ne suffisait pas : tant qu'aucune partie n'etait terminee,
// elles revenaient a chaque rechargement.
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
