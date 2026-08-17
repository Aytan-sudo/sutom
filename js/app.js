// Orchestration : relie le moteur, le dictionnaire, le stockage et l'interface.

import { createGame, restoreGame, MAX_ATTEMPTS, normalize } from './engine.js';
import { load, pickSolution, isPlayable, randomLength } from './dictionary.js';
import {
    loadStats, recordGame, resetStats,
    loadGame, saveGame, clearGame,
    loadRecent, pushRecent,
    hasSeenHelp, markHelpSeen
} from './storage.js';
import * as ui from './ui.js';

const SHARE_URL = 'https://aytan-sudo.github.io/sutom/';

let game = null;
let input = [];
let busy = false; // vrai pendant la revelation d'un essai : on ignore la saisie

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// ------------------------------------------------------------------ saisie

// La ligne en cours part des lettres deja acquises : elles sont verrouillees,
// la frappe ne remplit que les cases encore inconnues.
function resetInput() {
    input = game.template();
}

function typeLetter(letter) {
    const template = game.template();
    for (let i = 0; i < game.length; i++) {
        if (template[i] === null && !input[i]) {
            input[i] = letter;
            return;
        }
    }
}

function eraseLetter() {
    const template = game.template();
    for (let i = game.length - 1; i >= 0; i--) {
        if (template[i] === null && input[i]) {
            input[i] = null;
            return;
        }
    }
}

function currentWord() {
    return input.map(letter => letter || '').join('');
}

function refreshInput() {
    ui.paintInput(game.attempts.length, input, game.template());
}

// ------------------------------------------------------------------ partie

async function startGame() {
    ui.showMessage('');
    const length = randomLength();
    const solution = await pickSolution(length, loadRecent());
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

function shareText() {
    const result = game.status === 'won' ? `${game.attempts.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    return `SUTOM ${result} — ${game.length} lettres\n\n${game.emojiGrid()}\n\n${SHARE_URL}`;
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

function onKey(key) {
    if (!game) return;
    if (key === 'ENTER') return submitWord();
    if (busy || game.isOver) return; // revelation en cours ou partie finie

    if (key === 'BACKSPACE') eraseLetter();
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
        } else if (event.key.length === 1) {
            const letter = normalize(event.key);
            if (letter.length === 1) onKey(letter);
        }
    });

    document.getElementById('replay-button').addEventListener('click', async () => {
        ui.closeDialog(ui.el.endDialog);
        await startGame();
    });
    document.getElementById('share-button').addEventListener('click', share);

    document.getElementById('stats-button').addEventListener('click', () => {
        ui.renderStats(loadStats());
        ui.openDialog(ui.el.statsDialog);
    });
    document.getElementById('help-button').addEventListener('click', () => {
        ui.openDialog(ui.el.helpDialog);
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

async function main() {
    ui.mount();
    bindEvents();

    try {
        if (!await resumeGame()) await startGame();
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
