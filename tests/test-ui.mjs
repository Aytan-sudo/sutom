// Test d'integration : charge index.html dans jsdom, branche les vrais modules
// et joue une partie. C'est ce qui attrape les erreurs de cablage (un id
// renomme, un ecouteur oublie) que les tests du moteur ne peuvent pas voir.

import { boot, inspector, counter, wait, clipboard } from './harness.mjs';
import { readChallenge } from '../js/challenge.js';

const SOLUTION = 'ABATTU'; // premier mot de solutions-6.txt, avec Math.random fige
const GUESS = 'AVOCAT';    // A bien place, un A et un T ailleurs

const { check, report } = counter();
const window = await boot();
const { cellsOf, rowStates, rowText, message, storage, press, tap, click } = inspector(window);

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
    check('partie sauvegardee', storage('sutom.game').solution === SOLUTION);
    check('mot memorise comme deja vu', storage('sutom.recent').includes(SOLUTION));
}

console.log('\nsaisie');
{
    // La premiere lettre etant deja placee, on ne tape que la suite du mot.
    for (const letter of GUESS.slice(1)) press(letter);
    check('lettres saisies', rowText(0) === GUESS);

    press('Backspace');
    check('effacement', cellsOf(0)[5].textContent === '');

    press('Enter');
    await wait(50);
    check('mot incomplet refuse', storage('sutom.game').attempts.length === 0);
    check('message affiche', message() === 'Mot incomplet');
    press(GUESS[5]);
}

console.log('\nmot hors dictionnaire');
{
    for (let i = 0; i < 5; i++) press('Backspace');
    for (const letter of 'ZZZZZ') press(letter);
    press('Enter');
    await wait(50);
    check('refuse', message().includes('dictionnaire'));
    check('aucun essai consomme', storage('sutom.game').attempts.length === 0);

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
    check('essai enregistre', storage('sutom.game').attempts.length === 1);
    check('ligne suivante amorcee', cellsOf(1)[0].textContent === SOLUTION[0]);
}

console.log('\nvictoire');
{
    for (const letter of SOLUTION.slice(1)) tap(letter);
    check('clavier tactile fonctionnel', rowText(1) === SOLUTION);

    tap('ENTER');
    await wait(1300);
    check('grille gagnante', rowStates(1) === 'correct correct correct correct correct correct', rowStates(1));

    const dialog = window.document.getElementById('end-dialog');
    check('fin de partie annoncee', dialog.open);
    check('titre de victoire', window.document.getElementById('end-title').textContent === 'Gagne !');
    check('grille emoji partageable',
        window.document.getElementById('end-grid').textContent.split('\n').length === 2);

    const stats = storage('sutom.stats');
    check('victoire comptabilisee', stats.played === 1 && stats.won === 1);
    check('serie a 1', stats.streak === 1);
    check('victoire en 2 essais', stats.distribution[1] === 1);
    check('partie en cours effacee', window.localStorage.getItem('sutom.game') === null);
}

console.log('\npartage');
{
    click('share-button');
    await wait(50);
    check('resultat copie', message() === 'Resultat copie', message());
    check('score dans le texte', clipboard.text.startsWith('SUTOM 2/6 — 6 lettres'), clipboard.text);
    check('grille emoji jointe', clipboard.text.includes('🟥🟦🟦🟦🟡🟡'), clipboard.text);
    check('lien de defi joint', clipboard.text.includes('#defi='));
    // Le tour complet : ce que le lien contient est bien le mot qu'on vient de jouer.
    const link = clipboard.text.slice(clipboard.text.indexOf('#defi='));
    check('le lien porte le mot joue', readChallenge(link) === SOLUTION, link);
    check('la reponse reste illisible', !clipboard.text.includes(SOLUTION));
}

console.log('\nrejouer');
{
    click('replay-button');
    await wait(60);
    check('dialogue referme', !window.document.getElementById('end-dialog').open);
    check('grille remise a zero', rowStates(0) === 'vide vide vide vide vide vide', rowStates(0));
    check('clavier remis a zero',
        !window.document.querySelector('.key[data-key="V"]').classList.contains('absent'));
    // Le mot precedent est dans l'historique : le tirage doit en choisir un autre.
    const next = storage('sutom.game').solution;
    check('nouveau mot different', next !== SOLUTION, next);
}

console.log('\nsortie par echap');
{
    // On termine cette seconde partie pour retrouver le dialogue de fin, puis
    // on le ferme comme le ferait la touche Echap : sans porte de sortie, le
    // joueur resterait devant une grille figee.
    const solution = storage('sutom.game').solution;
    for (const letter of solution.slice(1)) press(letter);
    press('Enter');
    await wait(1300);

    const dialog = window.document.getElementById('end-dialog');
    check('deuxieme partie terminee', dialog.open);
    dialog.close();
    check('consigne affichee', message() === 'Entree pour une nouvelle partie');

    press('Enter');
    await wait(60);
    check('entree relance une partie', rowStates(0) === 'vide vide vide vide vide vide', rowStates(0));
    check('consigne effacee', message() === '');
    check('deux victoires comptees', storage('sutom.stats').played === 2);
}

console.log('\noption lettres modifiables');
{
    // La partie en cours vient de demarrer : seule la lettre offerte est posee.
    const solution = storage('sutom.game').solution;
    const autre = solution[0] === 'Z' ? 'W' : 'Z';
    const settingsDialog = window.document.getElementById('settings-dialog');
    const toggle = window.document.getElementById('option-free-input');
    const setOption = value => {
        click('settings-button');
        toggle.checked = value;
        toggle.dispatchEvent(new window.Event('change'));
        settingsDialog.close();
    };

    check('option fermee par defaut', toggle.checked === false);

    setOption(true);
    check('option memorisee', storage('sutom.settings').freeInput === true);

    press('Backspace');
    check('lettre acquise effacable', cellsOf(0)[0].textContent === '');
    press(autre);
    press(autre);
    check('remplacee par la lettre tapee', rowText(0) === autre + autre);
    check('case plus verrouillee', !cellsOf(0)[0].classList.contains('locked'));

    // Retour au mode normal : la lettre offerte revient, la frappe libre reste.
    setOption(false);
    check('option desactivee', storage('sutom.settings').freeInput === false);
    check('lettre acquise restauree', rowText(0) === solution[0] + autre);
    check('case reverrouillee', cellsOf(0)[0].classList.contains('locked'));

    press('Backspace');
    press('Backspace');
    check('lettre acquise de nouveau protegee', rowText(0) === solution[0]);
}

report();
