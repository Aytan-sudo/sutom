// Orchestration : relie le moteur, le dictionnaire, le stockage et l'interface.

import { VERSION, GAME_URL } from './config.js';
import { createGame, restoreGame, MAX_ATTEMPTS, normalize, ABSENT, PRESENT, CORRECT } from './engine.js';
import { load, pickSolution, isPlayable, randomLength } from './dictionary.js';
import {
    loadStats, recordGame, resetStats,
    loadSettings, saveSettings,
    loadGame, saveGame, clearGame,
    loadRecent, pushRecent,
    loadDaily, recordDaily, dailyResult,
    hasSeenHelp, markHelpSeen
} from './storage.js';
import { buildLink, readChallenge } from './challenge.js';
import { today, readDay, dayLength, dayIndex, dayLink, formatDay } from './daily.js';
import {
    soundType, soundReveal, soundReject, soundWin, soundLose, watchVisibility
} from './sound.js';
import { nextTheme } from './themes.js';
import * as ui from './ui.js';

let game = null;
let day = null; // la date du mot du jour en cours, null en partie libre
let settings = loadSettings();
let input = [];
let busy = false; // vrai pendant la révélation d'un essai : on ignore la saisie

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Sons et vibration passent par ici : une seule porte, fermée par défaut si le
// joueur a décoché l'option.
function play(sound, ...args) {
    if (settings.sound) sound(...args);
}

function vibrate(pattern) {
    if (settings.vibration) navigator.vibrate?.(pattern);
}

// ------------------------------------------------------------------ saisie

// Case laissée vide volontairement : elle occupe sa position sans porter de
// lettre, ce qui permet d'écrire la fin d'un mot sans en connaître le début.
// Un essai ne part que si toutes les cases portent une lettre, ces trous
// servent donc à regarder, pas à proposer.
const BLANK = '\u00b7';

// La ligne en cours part des lettres déjà acquises. Par défaut elles sont
// verrouillées et la frappe ne remplit que les cases encore inconnues ; avec
// l'option « lettres modifiables » elles restent inscrites mais s'effacent
// comme les autres, ce qui permet de sacrifier un essai pour sonder des
// lettres qu'un mot contraint ne laisserait jamais tester.
function resetInput() {
    input = game.template();
}

// Une case est libre si le jeu ne l'a pas offerte, ou si l'option lève le
// verrou. La lettre offerte fait exception : c'est le point de départ de la
// partie, elle reste en place quelle que soit l'option.
function editable(i, template) {
    if (i === 0) return false;
    return settings.freeInput || template[i] === null;
}

// Première case encore libre, de gauche à droite : c'est là que va la frappe.
function nextFree(template) {
    for (let i = 0; i < game.length; i++) {
        if (!input[i] && editable(i, template)) return i;
    }
    return -1;
}

function typeLetter(letter) {
    const i = nextFree(game.template());
    if (i >= 0) input[i] = letter;
}

function skipCell() {
    const i = nextFree(game.template());
    if (i >= 0) input[i] = BLANK;
}

function eraseLetter() {
    const template = game.template();
    for (let i = game.length - 1; i >= 0; i--) {
        if (input[i] && editable(i, template)) {
            input[i] = null;
            return;
        }
    }
}

// Changer d'option en pleine ligne ne doit pas escamoter ce qui est tapé : on
// se contente de remettre les lettres acquises quand le verrou revient, sinon
// la ligne resterait trouée alors que la saisie ne peut plus les rejoindre.
function applySettings() {
    ui.renderSettings(settings);
    if (settings.freeInput || !game || game.isOver) return;

    const template = game.template();
    template.forEach((letter, i) => {
        if (letter !== null) input[i] = letter;
    });
    refreshInput();
}

// Les trous ne comptent pas : le mot rendu est plus court que la grille, ce
// qui suffit à faire refuser l'essai comme incomplet.
function currentWord() {
    return input.map(letter => (letter && letter !== BLANK ? letter : '')).join('');
}

function refreshInput() {
    ui.paintInput(game.attempts.length, input, game.template());
}

// ------------------------------------------------------------------ palette

// Le script inline de la page a déjà posé la palette mémorisée : ici on ne
// fait que la refléter dans les Options et dans la barre du navigateur.
function applyTheme(id) {
    const theme = ui.applyTheme(id);
    if (theme.id !== settings.theme) {
        settings = saveSettings({ ...settings, theme: theme.id });
    }
    return theme;
}

function rotateTheme() {
    const theme = applyTheme(nextTheme(settings.theme));
    ui.showMessage(`Palette ${theme.nom}`, 1400);
}

// ------------------------------------------------------------------ partie

// `imposed` est le mot d'un lien de défi. S'il est illisible ou inconnu du
// dictionnaire, on le signale et on tire un mot au hasard : mieux vaut une
// partie normale qu'une page morte parce qu'un lien a été tronqué en route.
async function startGame(imposed = null) {
    ui.showMessage('');

    let solution = imposed;
    if (solution) {
        await load(solution.length);
        if (!isPlayable(solution, solution.length)) {
            ui.showMessage('Lien de défi invalide, voici un mot au hasard');
            solution = null;
        }
    }
    if (!solution) {
        solution = await pickSolution(randomLength(), loadRecent());
    }
    pushRecent(solution);

    game = createGame(solution);
    ui.buildBoard(MAX_ATTEMPTS, game.length);
    ui.paintKeyboard(new Map());
    resetInput();
    refreshInput();
    saveGame(game, day);
}

// ------------------------------------------------------------------ mot du jour

// Le mot n'est pas transmis : il se retrouve. La date donne une longueur et un
// index, l'index désigne un mot dans la liste des solutions — la même partout,
// puisqu'elle est committée. Deux joueurs cherchent donc le même mot sans que
// rien ne circule entre eux.
async function wordOfTheDay(date) {
    const length = dayLength(date);
    const { solutions } = await load(length);
    return solutions[dayIndex(date, solutions.length)];
}

// Le mot du jour remplace ce qui était en cours : on ne garde qu'une partie à
// la fois, et c'est celle que le joueur vient de demander.
async function startDailyGame(date) {
    day = date;
    const played = dailyResult(date);
    await startGame(await wordOfTheDay(date));

    if (played) {
        const verdict = played.won ? `trouvé en ${played.attempts}` : 'manqué';
        ui.showMessage(`Défi du ${formatDay(date)} déjà joué (${verdict}) — hors série`, 5000);
    } else if (date === today()) {
        ui.showMessage(`Mot du jour du ${formatDay(date)}`, 3000);
    } else {
        ui.showMessage(`Défi du ${formatDay(date)} — hors série`, 4000);
    }
}

// Le bouton ☀ : toujours le jour même, et l'URL le dit, pour qu'un
// rechargement ou un signet retombe sur la bonne grille.
//
// Deux précautions avant de tout remplacer : ne pas relancer le défi qu'on est
// déjà en train de jouer, et ne pas jeter sans prévenir une grille entamée.
async function playToday() {
    const date = today();

    if (day === date && game && !game.isOver) {
        ui.showMessage('Tu es déjà sur le mot du jour');
        return;
    }
    if (game && !game.isOver && game.attempts.length > 0
        && !confirm('Abandonner la partie en cours pour le mot du jour ?')) {
        return;
    }

    setUrl(`?jour=${date}`);
    await startDailyGame(date);
}

// Reprend la grille laissée en plan. Retourne false si rien d'exploitable,
// l'appelant lance alors une partie neuve.
async function resumeGame() {
    const saved = loadGame();
    const restored = restoreGame(saved);
    if (!restored || restored.isOver) {
        clearGame();
        return false;
    }

    day = saved.day || null;
    game = restored;
    await load(game.length); // nécessaire pour valider les prochaines saisies
    ui.buildBoard(MAX_ATTEMPTS, game.length);
    game.attempts.forEach((attempt, i) => ui.paintAttempt(i, attempt, false));
    ui.paintKeyboard(game.letterStates());
    resetInput();
    refreshInput();
    return true;
}

// Un essai refusé : le même geste à trois voix — la ligne tremble, deux notes
// graves tombent, le téléphone donne deux coups brefs.
function reject(message) {
    ui.showMessage(message);
    ui.shakeRow(game.attempts.length);
    play(soundReject);
    vibrate([12, 30, 12]);
}

async function submitWord() {
    if (busy || !game || game.isOver) return;

    const word = currentWord();
    if (word.length < game.length) {
        reject('Mot incomplet');
        return;
    }
    if (!isPlayable(word, game.length)) {
        reject(`${word} n'est pas dans le dictionnaire`);
        return;
    }

    const rowIndex = game.attempts.length;
    const attempt = game.submit(word);
    saveGame(game, day);

    busy = true;
    ui.paintAttempt(rowIndex, attempt, true);
    vibrate(12);
    play(soundReveal, attempt.marks, ui.REVEAL_STEP_MS / 1000);
    await wait(ui.revealDelay(game.length));
    ui.paintKeyboard(game.letterStates());
    busy = false;

    if (game.isOver) finishGame();
    else {
        resetInput();
        refreshInput();
    }
}

function finishGame() {
    const won = game.status === 'won';
    play(won ? soundWin : soundLose);
    vibrate(won ? [30, 45, 30] : 60);
    recordGame(won, game.attempts.length);
    // Seul le défi joué le jour même compte pour la série : rouvrir un vieux
    // lien redonne la grille, jamais les jours d'affilée.
    if (day) recordDaily(day, { won, attempts: game.attempts.length }, day === today());
    clearGame();
    ui.showEnd(game, won, day ? formatDay(day) : null);
}

// ------------------------------------------------------------------ partage

// Deux partages, et une règle commune : le lien ne porte jamais un résultat.
//
// Le mot du jour n'a pas besoin d'emporter sa solution — la date suffit à la
// retrouver. En partie libre, au contraire, le lien doit contenir le mot :
// sans lui le destinataire tomberait sur un tirage au hasard et la grille
// partagée ne signifierait rien.
function shareText() {
    const result = game.status === 'won' ? `${game.attempts.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    if (day) {
        return `SUTOM ${formatDay(day)}\n${result} · ${game.length} lettres\n\n`
            + `${game.emojiGrid()}\n\n${dayLink(GAME_URL, day)}`;
    }
    return `SUTOM ${result} — ${game.length} lettres\n\n${game.emojiGrid()}\n\n`
        + `Même mot, à toi de jouer :\n${buildLink(GAME_URL, game.solution)}`;
}

async function share() {
    const text = shareText();
    // navigator.share n'existe que sur mobile et exige un geste utilisateur ;
    // ailleurs on retombe sur le presse-papier.
    try {
        if (navigator.share) {
            await navigator.share({ text });
            return;
        }
        await navigator.clipboard.writeText(text);
        ui.showMessage('Résultat copié');
    } catch (e) {
        if (e && e.name === 'AbortError') return; // partage annulé par l'utilisateur
        ui.showMessage('Copie impossible');
    }
}

// ------------------------------------------------------------------ événements

// Réécrit l'adresse sans recharger. `suffix` vaut '' pour une partie libre :
// sinon le prochain rechargement ramènerait le défi ou le jour de l'URL alors
// qu'on est déjà passé à autre chose.
function setUrl(suffix) {
    history.replaceState(null, '', window.location.pathname + suffix);
}

async function newRandomGame() {
    day = null;
    setUrl('');
    await startGame();
}

function onKey(key) {
    if (!game) return;
    // Une fois la partie finie, Entrée relance : c'est la sortie de secours
    // pour qui a fermé le dialogue de fin avec Échap.
    if (key === 'ENTER') return game.isOver ? newRandomGame() : submitWord();
    if (busy || game.isOver) return; // révélation en cours ou partie finie

    if (key === 'BACKSPACE') eraseLetter();
    else if (key === 'BLANK') skipCell();
    else typeLetter(key);
    play(soundType);
    refreshInput();
}

function dialogOpen() {
    return document.querySelector('dialog[open]') !== null;
}

function bindEvents() {
    ui.el.keyboard.addEventListener('click', event => {
        const button = event.target.closest('.key');
        if (button) onKey(button.dataset.key);
    });

    document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (dialogOpen()) return; // les dialogues gèrent leurs propres touches

        if (event.key === 'Enter') {
            event.preventDefault();
            onKey('ENTER');
        } else if (event.key === 'Backspace') {
            event.preventDefault();
            onKey('BACKSPACE');
        } else if (event.key === ' ') {
            // La barre d'espace saute une case. preventDefault évite au passage
            // qu'elle réactive la dernière touche cliquée, qui a gardé le focus.
            event.preventDefault();
            onKey('BLANK');
        } else if (event.key.length === 1) {
            const letter = normalize(event.key);
            if (letter.length === 1) onKey(letter);
        }
    });

    document.getElementById('replay-button').addEventListener('click', async () => {
        ui.closeDialog(ui.el.endDialog);
        await newRandomGame();
    });
    document.getElementById('share-button').addEventListener('click', share);

    // Échap ferme le dialogue de fin sans passer par « Rejouer » : sans ce
    // rappel, on se retrouve devant une grille figée sans savoir quoi faire.
    ui.el.endDialog.addEventListener('close', () => {
        if (game && game.isOver) ui.showMessage('Entrée pour une nouvelle partie', 0);
    });

    document.getElementById('stats-button').addEventListener('click', () => {
        ui.renderStats(loadStats(), loadDaily());
        ui.openDialog(ui.el.statsDialog);
    });
    document.getElementById('daily-button').addEventListener('click', async () => {
        ui.closeDialog(ui.el.endDialog);
        await playToday();
    });
    document.getElementById('help-button').addEventListener('click', () => {
        ui.openDialog(ui.el.helpDialog);
    });
    document.getElementById('settings-button').addEventListener('click', () => {
        ui.renderSettings(settings);
        ui.openDialog(ui.el.settingsDialog);
    });
    // Pas de raccourci clavier pour la palette : dans un jeu de lettres, les
    // 26 touches appartiennent à la grille. Le bouton fait tourner la liste,
    // les Options donnent l'accès direct.
    document.getElementById('theme-button').addEventListener('click', rotateTheme);
    ui.el.freeInput.addEventListener('change', event => {
        settings = saveSettings({ ...settings, freeInput: event.target.checked });
        applySettings();
    });
    for (const [element, key] of [[ui.el.soundOption, 'sound'], [ui.el.vibrationOption, 'vibration']]) {
        element.addEventListener('change', event => {
            settings = saveSettings({ ...settings, [key]: event.target.checked });
            // Cocher « sons » fait entendre ce qu'on vient d'activer : sans ce
            // retour, on ne sait pas si l'option a pris.
            if (key === 'sound') play(soundReveal, [ABSENT, PRESENT, CORRECT]);
            else vibrate(30);
        });
    }
    document.getElementById('reset-stats').addEventListener('click', () => {
        if (confirm('Effacer définitivement les statistiques, séries comprises ?')) {
            ui.renderStats(resetStats(), loadDaily());
        }
    });

    for (const button of document.querySelectorAll('[data-close]')) {
        button.addEventListener('click', () => ui.closeDialog(button.closest('dialog')));
    }
}

// ------------------------------------------------------------------ démarrage

// Quatre entrées possibles dans le jeu, dans cet ordre de priorité : le mot
// du jour demandé par l'URL, un lien de défi, la partie laissée en plan, puis
// un tirage au hasard.
async function boot() {
    const requested = readDay(window.location.search);

    if (requested) {
        // Recharger la page en plein mot du jour reprend la grille : la partie
        // sauvegardée retient sa date, on sait donc si elle porte sur ce défi.
        const saved = loadGame();
        if (saved && saved.day === requested && await resumeGame()) return;

        await startDailyGame(requested);
        return;
    }

    const challenge = readChallenge(window.location.hash);

    if (challenge) {
        // Recharger la page en plein défi doit reprendre la grille, pas la
        // remettre à zéro : on ne relance le défi que si la partie sauvegardée
        // porte sur un autre mot.
        const saved = loadGame();
        if (saved && saved.solution === challenge && await resumeGame()) return;

        await startGame(challenge);
        // startGame a pu refuser le mot et en tirer un autre : dans ce cas il
        // affiche déjà son propre message, qu'il ne faut pas écraser.
        if (game.solution === challenge) {
            ui.showMessage('Défi reçu : trouve le mot de ton ami', 4000);
        }
        return;
    }

    if (!await resumeGame()) await startGame();
}

async function main() {
    ui.mount();
    ui.showVersion(VERSION);
    watchVisibility(document);
    ui.buildThemeChoice(id => applyTheme(id));
    bindEvents();
    applyTheme(settings.theme);
    ui.renderSettings(settings);

    try {
        await boot();
    } catch (e) {
        console.error(e);
        ui.showMessage('Dictionnaire indisponible. Rechargez la page.', 0);
        return;
    }

    if (!hasSeenHelp()) {
        ui.openDialog(ui.el.helpDialog);
        markHelpSeen();
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
    }
}

main();
