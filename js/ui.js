// Rendu et interactions. Ce module ne connait pas les regles : il recoit un
// etat et le dessine, il renvoie les intentions de l'utilisateur (une lettre,
// une validation) au module app.js.

import { CORRECT, PRESENT, ABSENT } from './engine.js';

const KEYBOARD_ROWS = [
    ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
    ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', 'BACKSPACE']
];

const KEY_LABELS = { ENTER: 'Entrer', BACKSPACE: '⌫' };
const STATE_CLASS = { [CORRECT]: 'correct', [PRESENT]: 'present', [ABSENT]: 'absent' };

// Duree entre deux cases lors de la revelation d'un essai (voir --reveal-step).
const REVEAL_STEP_MS = 160;
const REVEAL_DURATION_MS = 320;

export const el = {};

export function mount() {
    el.board = document.getElementById('board');
    el.message = document.getElementById('message');
    el.keyboard = document.getElementById('keyboard');
    el.endDialog = document.getElementById('end-dialog');
    el.endTitle = document.getElementById('end-title');
    el.endWord = document.getElementById('end-word');
    el.endGrid = document.getElementById('end-grid');
    el.statsDialog = document.getElementById('stats-dialog');
    el.helpDialog = document.getElementById('help-dialog');
    buildKeyboard();
}

// ------------------------------------------------------------------ grille

export function buildBoard(rows, columns) {
    el.board.style.setProperty('--columns', columns);
    el.board.replaceChildren();

    for (let r = 0; r < rows; r++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.setAttribute('role', 'row');
        for (let c = 0; c < columns; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('role', 'gridcell');
            row.append(cell);
        }
        el.board.append(row);
    }
}

function cellsOf(rowIndex) {
    return [...el.board.children[rowIndex].children];
}

// Affiche un essai joue. Anime = revelation case par case ; sinon tout est
// peint d'un coup (reprise de partie au chargement, ou grille deja connue).
export function paintAttempt(rowIndex, attempt, animate = false) {
    const cells = cellsOf(rowIndex);
    cells.forEach((cell, i) => {
        cell.textContent = attempt.word[i];
        cell.className = `cell filled ${STATE_CLASS[attempt.marks[i]]}`;
        if (animate) {
            cell.classList.add('revealing');
            cell.style.animationDelay = `${i * REVEAL_STEP_MS}ms`;
        } else {
            cell.style.animationDelay = '';
        }
    });
}

export function revealDelay(columns) {
    return (columns - 1) * REVEAL_STEP_MS + REVEAL_DURATION_MS;
}

// Dessine la saisie en cours. `template` porte les lettres acquises : elles
// s'affichent en retrait pour que l'on voie ce qui est deja verrouille.
export function paintInput(rowIndex, letters, template) {
    if (rowIndex >= el.board.children.length) return;
    cellsOf(rowIndex).forEach((cell, i) => {
        const letter = letters[i] || '';
        cell.textContent = letter;
        cell.className = 'cell';
        if (letter) cell.classList.add('filled');
        if (template[i] !== null) cell.classList.add('locked');
        cell.style.animationDelay = '';
    });
}

export function shakeRow(rowIndex) {
    const row = el.board.children[rowIndex];
    if (!row) return;
    row.classList.remove('shake');
    void row.offsetWidth; // force le navigateur a relancer l'animation
    row.classList.add('shake');
}

// ------------------------------------------------------------------ clavier

function buildKeyboard() {
    el.keyboard.replaceChildren();
    for (const keys of KEYBOARD_ROWS) {
        const row = document.createElement('div');
        row.className = 'keyboard-row';
        for (const key of keys) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'key';
            button.dataset.key = key;
            button.textContent = KEY_LABELS[key] || key;
            if (key === 'ENTER' || key === 'BACKSPACE') button.classList.add('key-wide');
            if (key === 'BACKSPACE') button.setAttribute('aria-label', 'Effacer');
            row.append(button);
        }
        el.keyboard.append(row);
    }
}

export function paintKeyboard(states) {
    for (const button of el.keyboard.querySelectorAll('.key')) {
        const state = states.get(button.dataset.key);
        button.classList.remove('correct', 'present', 'absent');
        if (state) button.classList.add(STATE_CLASS[state]);
    }
}

// ------------------------------------------------------------------ messages

let messageTimer = null;

export function showMessage(text, duration = 2200) {
    clearTimeout(messageTimer);
    el.message.textContent = text;
    el.message.classList.toggle('visible', Boolean(text));
    if (text && duration) {
        messageTimer = setTimeout(() => {
            el.message.textContent = '';
            el.message.classList.remove('visible');
        }, duration);
    }
}

// ------------------------------------------------------------------ dialogues

export function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
}

export function closeDialog(dialog) {
    if (dialog.open) dialog.close();
}

export function showEnd(game, won) {
    el.endTitle.textContent = won ? 'Gagne !' : 'Perdu';
    el.endWord.innerHTML = won
        ? `en ${game.attempts.length} essai${game.attempts.length > 1 ? 's' : ''}`
        : `le mot etait <strong>${game.solution}</strong>`;
    el.endGrid.textContent = game.emojiGrid();
    openDialog(el.endDialog);
}

export function renderStats(stats) {
    const rate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-rate').textContent = `${rate} %`;
    document.getElementById('stat-streak').textContent = stats.streak;
    document.getElementById('stat-best').textContent = stats.bestStreak;

    const list = document.getElementById('stat-distribution');
    const max = Math.max(1, ...stats.distribution);
    list.replaceChildren();
    stats.distribution.forEach((count, i) => {
        const item = document.createElement('li');
        const bar = document.createElement('span');
        bar.className = count ? 'bar' : 'bar empty';
        bar.style.width = `${Math.max(8, (count / max) * 100)}%`;
        bar.textContent = count;
        item.append(document.createTextNode(`${i + 1}`), bar);
        list.append(item);
    });
}
