// Rendu et interactions. Ce module ne connaît pas les règles : il reçoit un
// état et le dessine, il renvoie les intentions de l'utilisateur (une lettre,
// une validation) au module app.js.

import { CORRECT, PRESENT, ABSENT } from './engine.js';
import { THEMES } from './themes.js';

const KEYBOARD_ROWS = [
    ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
    ['BACKSPACE', 'BLANK', 'W', 'X', 'C', 'V', 'B', 'N', 'ENTER']
];

const KEY_LABELS = { ENTER: 'Entrer', BACKSPACE: '⌫', BLANK: 'Vide' };
const KEY_ARIA = { BACKSPACE: 'Effacer', BLANK: 'Laisser la case vide' };
const WIDE_KEYS = ['BACKSPACE', 'ENTER'];
const STATE_CLASS = { [CORRECT]: 'correct', [PRESENT]: 'present', [ABSENT]: 'absent' };

// Durée entre deux cases lors de la révélation d'un essai (voir --reveal-step).
export const REVEAL_STEP_MS = 160;
const REVEAL_DURATION_MS = 320;

export const el = {};

export function mount() {
    el.board = document.getElementById('board');
    el.message = document.getElementById('message');
    el.keyboard = document.getElementById('keyboard');
    el.endDialog = document.getElementById('end-dialog');
    el.endDay = document.getElementById('end-day');
    el.endTitle = document.getElementById('end-title');
    el.endWord = document.getElementById('end-word');
    el.endGrid = document.getElementById('end-grid');
    el.statsDialog = document.getElementById('stats-dialog');
    el.settingsDialog = document.getElementById('settings-dialog');
    el.freeInput = document.getElementById('option-free-input');
    el.soundOption = document.getElementById('option-sound');
    el.vibrationOption = document.getElementById('option-vibration');
    el.themeChoice = document.getElementById('theme-choice');
    el.themeColor = document.getElementById('couleur-barre');
    el.helpDialog = document.getElementById('help-dialog');
    el.version = document.getElementById('version');
    buildKeyboard();
}

// ------------------------------------------------------------------ palettes

// Une pastille par palette, chacune peinte de ses trois couleurs : on choisit
// une ambiance en la voyant, pas en lisant son nom. `onPick` reçoit l'identifiant.
export function buildThemeChoice(onPick) {
    el.themeChoice.replaceChildren(...THEMES.map(theme => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-pill';
        button.dataset.theme = theme.id;
        button.title = theme.nom;
        button.setAttribute('aria-label', `Palette ${theme.nom}`);
        button.append(document.createElement('span'), document.createTextNode(theme.nom));
        button.addEventListener('click', () => onPick(theme.id));
        return button;
    }));
}

// Applique la palette au document et à la barre du navigateur. Le thème est
// posé sur <html>, comme le fait déjà le script inline de la page.
export function applyTheme(id) {
    const theme = THEMES.find(candidate => candidate.id === id) || THEMES[0];
    document.documentElement.dataset.theme = theme.id;
    el.themeColor.setAttribute('content', theme.couleur);
    for (const button of el.themeChoice.querySelectorAll('.theme-pill')) {
        const active = button.dataset.theme === theme.id;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    }
    return theme;
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

// Affiche un essai joué. Animé = révélation case par case ; sinon tout est
// peint d'un coup (reprise de partie au chargement, ou grille déjà connue).
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
// s'affichent en retrait pour que l'on voie ce qui est déjà verrouillé.
//
// En mode « lettres modifiables », une case acquise peut avoir été effacée ou
// remplacée : elle ne porte alors plus la teinte du verrou, sinon on croirait
// que la lettre tapée vient du jeu.
export function paintInput(rowIndex, letters, template) {
    if (rowIndex >= el.board.children.length) return;
    cellsOf(rowIndex).forEach((cell, i) => {
        // Une case peut porter une lettre, rien, ou la marque d'un trou laissé
        // volontairement : seule une lettre s'écrit, le trou se signale d'un trait.
        const value = letters[i] || '';
        const letter = /^[A-Z]$/.test(value) ? value : '';
        cell.textContent = letter;
        cell.className = 'cell';
        if (letter) cell.classList.add('filled');
        else if (value) cell.classList.add('blank');
        if (letter && letter === template[i]) cell.classList.add('locked');
        cell.style.animationDelay = '';
    });
}

export function shakeRow(rowIndex) {
    const row = el.board.children[rowIndex];
    if (!row) return;
    row.classList.remove('shake');
    void row.offsetWidth; // force le navigateur à relancer l'animation
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
            // Les touches d'action portent un mot, pas une lettre : police plus
            // petite pour qu'il tienne dans la case.
            if (key.length > 1) button.classList.add('key-action');
            if (WIDE_KEYS.includes(key)) button.classList.add('key-wide');
            if (KEY_ARIA[key]) button.setAttribute('aria-label', KEY_ARIA[key]);
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

// `day` est la date du mot du jour, ou null pour une partie libre : la
// distinction se voit, sinon on ne sait plus ce qu'on vient de jouer ni ce que
// le bouton Partager va envoyer.
export function showEnd(game, won, day = null) {
    el.endDay.hidden = day === null;
    el.endDay.textContent = day ? `Mot du jour · ${day}` : '';
    el.endTitle.textContent = won ? 'Gagné !' : 'Perdu';
    el.endWord.innerHTML = won
        ? `en ${game.attempts.length} essai${game.attempts.length > 1 ? 's' : ''}`
        : `le mot était <strong>${game.solution}</strong>`;
    el.endGrid.textContent = game.emojiGrid();
    openDialog(el.endDialog);
}

// La page porte déjà le numéro en dur — un test le compare à package.json et
// au cache. On le réécrit ici depuis le code chargé : c'est cette valeur-là qui
// dit ce que l'appareil exécute vraiment.
export function showVersion(version) {
    el.version.textContent = `Sutom ${version}`;
}

export function renderSettings(settings) {
    el.freeInput.checked = settings.freeInput === true;
    el.soundOption.checked = settings.sound === true;
    el.vibrationOption.checked = settings.vibration === true;
}

export function renderStats(stats, daily) {
    const rate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-rate').textContent = `${rate} %`;
    document.getElementById('stat-streak').textContent = stats.streak;
    document.getElementById('stat-best').textContent = stats.bestStreak;

    const results = Object.values(daily.results);
    document.getElementById('stat-daily-streak').textContent = daily.streak;
    document.getElementById('stat-daily-best').textContent = daily.bestStreak;
    document.getElementById('stat-daily-played').textContent = results.length;
    document.getElementById('stat-daily-won').textContent = results.filter(result => result.won).length;

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
