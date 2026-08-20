// Orchestration : relie le moteur, le dictionnaire, le stockage et l'interface.

import { createGame, restoreGame, MAX_ATTEMPTS, normalize } from './engine.js';
import { load, pickSolution, isPlayable, randomLength } from './dictionary.js';
import {
    loadStats, recordGame, resetStats,
    loadSettings, saveSettings,
    loadGame, saveGame, clearGame,
    loadRecent, pushRecent,
    hasSeenHelp, markHelpSeen
} from './storage.js';
import { buildLink, readChallenge } from './challenge.js';
import * as ui from './ui.js';

const SHARE_URL = 'https://aytan-sudo.github.io/sutom/';

let game = null;
let settings = loadSettings();
let input = [];
let busy = false; // vrai pendant la revelation d'un essai : on ignore la saisie

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// ------------------------------------------------------------------ saisie

// Case laissee vide volontairement : elle occupe sa position sans porter de
// lettre, ce qui permet d'ecrire la fin d'un mot sans en connaitre le debut.
// Un essai ne part que si toutes les cases portent une lettre, ces trous
// servent donc a regarder, pas a proposer.
const BLANK = '\u00b7';

// La ligne en cours part des lettres deja acquises. Par defaut elles sont
// verrouillees et la frappe ne remplit que les cases encore inconnues ; avec
// l'option « lettres modifiables » elles restent inscrites mais s'effacent
// comme les autres, ce qui permet de sacrifier un essai pour sonder des
// lettres qu'un mot contraint ne laisserait jamais tester.
function resetInput() {
    input = game.template();
}

// Une case est libre si le jeu ne l'a pas offerte, ou si l'option leve le
// verrou. La lettre offerte fait exception : c'est le point de depart de la
// partie, elle reste en place quelle que soit l'option.
function editable(i, template) {
    if (i === 0) return false;
    return settings.freeInput || template[i] === null;
}

// Premiere case encore libre, de gauche a droite : c'est la que va la frappe.
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

// Changer d'option en pleine ligne ne doit pas escamoter ce qui est tape : on
// se contente de remettre les lettres acquises quand le verrou revient, sinon
// la ligne resterait trouee alors que la saisie ne peut plus les rejoindre.
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
// qui suffit a faire refuser l'essai comme incomplet.
function currentWord() {
    return input.map(letter => (letter && letter !== BLANK ? letter : '')).join('');
}

function refreshInput() {
    ui.paintInput(game.attempts.length, input, game.template());
}

// ------------------------------------------------------------------ partie

// `imposed` est le mot d'un lien de defi. S'il est illisible ou inconnu du
// dictionnaire, on le signale et on tire un mot au hasard : mieux vaut une
// partie normale qu'une page morte parce qu'un lien a ete tronque en route.
async function startGame(imposed = null) {
    ui.showMessage('');

    let solution = imposed;
    if (solution) {
        await load(solution.length);
        if (!isPlayable(solution, solution.length)) {
            ui.showMessage('Lien de defi invalide, voici un mot au hasard');
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
    saveGame(game);
}

// Reprend la grille laissee en plan. Retourne false si rien d'exploitable,
// l'appelant lance alors une partie neuve.
async function resumeGame() {
    const saved = loadGame();
    const restored = restoreGame(saved);
    if (!restored || restored.isOver) {
        clearGame();
        return false;
    }

    game = restored;
    await load(game.length); // necessaire pour valider les prochaines saisies
    ui.buildBoard(MAX_ATTEMPTS, game.length);
    game.attempts.forEach((attempt, i) => ui.paintAttempt(i, attempt, false));
    ui.paintKeyboard(game.letterStates());
    resetInput();
    refreshInput();
    return true;
}

async function submitWord() {
    if (busy || !game || game.isOver) return;

    const word = currentWord();
    if (word.length < game.length) {
        ui.showMessage('Mot incomplet');
        ui.shakeRow(game.attempts.length);
        return;
    }
    if (!isPlayable(word, game.length)) {
        ui.showMessage(`${word} n'est pas dans le dictionnaire`);
        ui.shakeRow(game.attempts.length);
        return;
    }

    const rowIndex = game.attempts.length;
    const attempt = game.submit(word);
    saveGame(game);

    busy = true;
    ui.paintAttempt(rowIndex, attempt, true);
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
    recordGame(won, game.attempts.length);
    clearGame();
    ui.showEnd(game, won);
}

// ------------------------------------------------------------------ partage

// Le lien emporte le mot qu'on vient de jouer : sans lui, le destinataire
// tomberait sur un tirage au hasard et la grille partagee ne signifierait rien.
function shareText() {
    const result = game.status === 'won' ? `${game.attempts.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    return `SUTOM ${result} — ${game.length} lettres\n\n${game.emojiGrid()}\n\n`
        + `Meme mot, a toi de jouer :\n${buildLink(SHARE_URL, game.solution)}`;
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
        ui.showMessage('Resultat copie');
    } catch (e) {
        if (e && e.name === 'AbortError') return; // partage annule par l'utilisateur
        ui.showMessage('Copie impossible');
    }
}

// ------------------------------------------------------------------ evenements

// Passer a une partie au hasard efface le defi de l'URL : sinon le prochain
// rechargement ramenerait le mot du lien alors qu'on est deja passe a autre chose.
async function newRandomGame() {
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    await startGame();
}

function onKey(key) {
    if (!game) return;
    // Une fois la partie finie, Entree relance : c'est la sortie de secours
    // pour qui a ferme le dialogue de fin avec Echap.
    if (key === 'ENTER') return game.isOver ? newRandomGame() : submitWord();
    if (busy || game.isOver) return; // revelation en cours ou partie finie

    if (key === 'BACKSPACE') eraseLetter();
    else if (key === 'BLANK') skipCell();
    else typeLetter(key);
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
        if (dialogOpen()) return; // les dialogues gerent leurs propres touches

        if (event.key === 'Enter') {
            event.preventDefault();
            onKey('ENTER');
        } else if (event.key === 'Backspace') {
            event.preventDefault();
            onKey('BACKSPACE');
        } else if (event.key === ' ') {
            // La barre d'espace saute une case. preventDefault evite au passage
            // qu'elle reactive la derniere touche cliquee, qui a garde le focus.
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

    // Echap ferme le dialogue de fin sans passer par « Rejouer » : sans ce
    // rappel, on se retrouve devant une grille figee sans savoir quoi faire.
    ui.el.endDialog.addEventListener('close', () => {
        if (game && game.isOver) ui.showMessage('Entree pour une nouvelle partie', 0);
    });

    document.getElementById('stats-button').addEventListener('click', () => {
        ui.renderStats(loadStats());
        ui.openDialog(ui.el.statsDialog);
    });
    document.getElementById('help-button').addEventListener('click', () => {
        ui.openDialog(ui.el.helpDialog);
    });
    document.getElementById('settings-button').addEventListener('click', () => {
        ui.renderSettings(settings);
        ui.openDialog(ui.el.settingsDialog);
    });
    ui.el.freeInput.addEventListener('change', event => {
        settings = saveSettings({ ...settings, freeInput: event.target.checked });
        applySettings();
    });
    document.getElementById('reset-stats').addEventListener('click', () => {
        if (confirm('Effacer definitivement les statistiques ?')) {
            ui.renderStats(resetStats());
        }
    });

    for (const button of document.querySelectorAll('[data-close]')) {
        button.addEventListener('click', () => ui.closeDialog(button.closest('dialog')));
    }
}

// ------------------------------------------------------------------ demarrage

// Trois entrees possibles dans le jeu, dans cet ordre de priorite.
async function boot() {
    const challenge = readChallenge(window.location.hash);

    if (challenge) {
        // Recharger la page en plein defi doit reprendre la grille, pas la
        // remettre a zero : on ne relance le defi que si la partie sauvegardee
        // porte sur un autre mot.
        const saved = loadGame();
        if (saved && saved.solution === challenge && await resumeGame()) return;

        await startGame(challenge);
        // startGame a pu refuser le mot et en tirer un autre : dans ce cas il
        // affiche deja son propre message, qu'il ne faut pas ecraser.
        if (game.solution === challenge) {
            ui.showMessage('Defi recu : trouve le mot de ton ami', 4000);
        }
        return;
    }

    if (!await resumeGame()) await startGame();
}

async function main() {
    ui.mount();
    bindEvents();
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
