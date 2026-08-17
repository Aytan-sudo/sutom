// Test d'integration : charge index.html dans jsdom, branche les vrais modules
// et joue une partie. C'est ce qui attrape les erreurs de cablage (un id
// renomme, un ecouteur oublie) que les tests du moteur ne peuvent pas voir.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;

function check(label, condition, detail = '') {
    if (condition) { pass++; console.log(`  OK    ${label}`); }
    else { fail++; console.log(`  ECHEC ${label} ${detail}`); }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Math.random fige a 0 : la partie tombe toujours sur 6 lettres et sur le
// premier mot de solutions-6.txt, donc le test connait la reponse.
const SOLUTION = 'ABATTU';
const GUESS = 'AVOCAT'; // A bien place, un A et un T ailleurs

const dom = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8'), {
    url: 'https://example.test/',
    pretendToBeVisual: true
});
const { window } = dom;

// jsdom 26 connait l'element <dialog> et sa propriete open, mais pas encore
// showModal()/close(). On les simule sur l'attribut, ce qui suffit : le jeu ne
// se sert du modal que pour savoir si un dialogue est ouvert.
for (const dialog of window.document.querySelectorAll('dialog')) {
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () {
        this.removeAttribute('open');
        this.dispatchEvent(new window.Event('close'));
    };
}

// Les modules du jeu tapent dans les globales du navigateur : on les expose
// avant l'import, sinon app.js s'execute dans le vide.
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.fetch = async path => {
    const file = join(ROOT, String(path));
    return { ok: true, status: 200, text: async () => readFileSync(file, 'utf8') };
};

Math.random = () => 0;

const cellsOf = row => [...window.document.querySelectorAll('.row')[row].children];
const stateOf = cell => ['correct', 'present', 'absent']
    .find(name => cell.classList.contains(name)) || 'vide';
const rowStates = row => cellsOf(row).map(stateOf).join(' ');

function press(key) {
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key, bubbles: true, cancelable: true
    }));
}

function tap(key) {
    window.document.querySelector(`.key[data-key="${key}"]`).dispatchEvent(
        new window.MouseEvent('click', { bubbles: true })
    );
}

await import('../js/app.js');
await wait(60); // laisse le chargement du dictionnaire se terminer

console.log('\ndemarrage');
{
    const help = window.document.getElementById('help-dialog');
    check('regles ouvertes a la premiere visite', help.open);
    help.querySelector('[data-close]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('regles refermees', !help.open);

    check('six rangees', window.document.querySelectorAll('.row').length === 6);
    check('six colonnes', cellsOf(0).length === 6);
    check('premiere lettre affichee', cellsOf(0)[0].textContent === SOLUTION[0]);
    check('premiere lettre verrouillee', cellsOf(0)[0].classList.contains('locked'));
    check('partie sauvegardee', JSON.parse(window.localStorage.getItem('sutom.game')).solution === SOLUTION);
    check('mot memorise comme deja vu',
        JSON.parse(window.localStorage.getItem('sutom.recent')).includes(SOLUTION));
}

console.log('\nsaisie');
{
    // La premiere lettre etant deja placee, on ne tape que la suite du mot.
    for (const letter of GUESS.slice(1)) press(letter);
    check('lettres saisies', cellsOf(0).map(c => c.textContent).join('') === GUESS);

    press('Backspace');
    check('effacement', cellsOf(0)[5].textContent === '');

    press('Enter');
    await wait(50);
    check('mot incomplet refuse', window.document.querySelectorAll('.row')[0].children[0].classList.contains('locked'));
    check('message affiche', window.document.getElementById('message').textContent === 'Mot incomplet');
    press(GUESS[5]);
}

console.log('\nmot hors dictionnaire');
{
    for (let i = 0; i < 5; i++) press('Backspace');
    for (const letter of 'ZZZZZ') press(letter);
    press('Enter');
    await wait(50);
    check('refuse', window.document.getElementById('message').textContent.includes('dictionnaire'));
    check('aucun essai consomme', JSON.parse(window.localStorage.getItem('sutom.game')).attempts.length === 0);

    for (let i = 0; i < 5; i++) press('Backspace');
    for (const letter of GUESS.slice(1)) press(letter);
}

console.log('\npremier essai');
{
    press('Enter');
    await wait(1300); // revelation case par case
    check('couleurs appliquees', rowStates(0) === 'correct absent absent absent present present', rowStates(0));
    check('clavier colore',
        window.document.querySelector('.key[data-key="V"]').classList.contains('absent'));
    check('essai enregistre', JSON.parse(window.localStorage.getItem('sutom.game')).attempts.length === 1);
    check('ligne suivante amorcee', cellsOf(1)[0].textContent === SOLUTION[0]);
}

console.log('\nvictoire');
{
    for (const letter of SOLUTION.slice(1)) tap(letter);
    check('clavier tactile fonctionnel', cellsOf(1).map(c => c.textContent).join('') === SOLUTION);

    tap('ENTER');
    await wait(1300);
    check('grille gagnante', rowStates(1) === 'correct correct correct correct correct correct', rowStates(1));

    const dialog = window.document.getElementById('end-dialog');
    check('fin de partie annoncee', dialog.open);
    check('titre de victoire', window.document.getElementById('end-title').textContent === 'Gagne !');
    check('grille emoji partageable',
        window.document.getElementById('end-grid').textContent.split('\n').length === 2);

    const stats = JSON.parse(window.localStorage.getItem('sutom.stats'));
    check('victoire comptabilisee', stats.played === 1 && stats.won === 1);
    check('serie a 1', stats.streak === 1);
    check('victoire en 2 essais', stats.distribution[1] === 1);
    check('partie en cours effacee', window.localStorage.getItem('sutom.game') === null);
}

console.log('\nrejouer');
{
    window.document.getElementById('replay-button').dispatchEvent(
        new window.MouseEvent('click', { bubbles: true })
    );
    await wait(60);
    check('dialogue referme', !window.document.getElementById('end-dialog').open);
    check('grille remise a zero', rowStates(0) === 'vide vide vide vide vide vide', rowStates(0));
    check('clavier remis a zero',
        !window.document.querySelector('.key[data-key="V"]').classList.contains('absent'));
    // Le mot precedent est dans l'historique : le tirage doit en choisir un autre.
    const next = JSON.parse(window.localStorage.getItem('sutom.game')).solution;
    check('nouveau mot different', next !== SOLUTION, next);
}

console.log(`\n${pass} reussis, ${fail} echecs\n`);
window.close();
process.exit(fail === 0 ? 0 : 1);
