// Test d'intégration : charge index.html dans jsdom, branche les vrais modules
// et joue une partie. C'est ce qui attrape les erreurs de câblage (un id
// renommé, un écouteur oublié) que les tests du moteur ne peuvent pas voir.

import { boot, inspector, counter, wait, clipboard } from './harness.mjs';
import { readChallenge } from '../js/challenge.js';

const SOLUTION = 'ABATTU'; // premier mot de solutions-6.txt, avec Math.random figé
const GUESS = 'AVOCAT';    // A bien placé, un A et un T ailleurs

const { check, report } = counter();
const window = await boot();
const { cellsOf, rowStates, rowText, message, storage, press, tap, click } = inspector(window);

console.log('\ndémarrage');
{
    const help = window.document.getElementById('help-dialog');
    check('règles ouvertes à la première visite', help.open);
    help.querySelector('[data-close]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('règles refermées', !help.open);

    check('six rangées', window.document.querySelectorAll('.row').length === 6);
    check('six colonnes', cellsOf(0).length === 6);
    check('première lettre affichée', cellsOf(0)[0].textContent === SOLUTION[0]);
    check('première lettre verrouillée', cellsOf(0)[0].classList.contains('locked'));
    check('partie sauvegardée', storage('sutom.game').solution === SOLUTION);
    check('mot mémorisé comme déjà vu', storage('sutom.recent').includes(SOLUTION));
}

console.log('\nsaisie');
{
    // La première lettre étant déjà placée, on ne tape que la suite du mot.
    for (const letter of GUESS.slice(1)) press(letter);
    check('lettres saisies', rowText(0) === GUESS);

    press('Backspace');
    check('effacement', cellsOf(0)[5].textContent === '');

    press('Enter');
    await wait(50);
    check('mot incomplet refusé', storage('sutom.game').attempts.length === 0);
    check('message affiché', message() === 'Mot incomplet');
    press(GUESS[5]);
}

console.log('\nmot hors dictionnaire');
{
    for (let i = 0; i < 5; i++) press('Backspace');
    for (const letter of 'ZZZZZ') press(letter);
    press('Enter');
    await wait(50);
    check('refusé', message().includes('dictionnaire'));
    check('aucun essai consommé', storage('sutom.game').attempts.length === 0);

    for (let i = 0; i < 5; i++) press('Backspace');
    for (const letter of GUESS.slice(1)) press(letter);
}

console.log('\npremier essai');
{
    press('Enter');
    await wait(1300); // révélation case par case
    check('couleurs appliquées', rowStates(0) === 'correct absent absent absent present present', rowStates(0));
    check('clavier coloré',
        window.document.querySelector('.key[data-key="V"]').classList.contains('absent'));
    check('essai enregistré', storage('sutom.game').attempts.length === 1);
    check('ligne suivante amorcée', cellsOf(1)[0].textContent === SOLUTION[0]);
}

console.log('\nvictoire');
{
    for (const letter of SOLUTION.slice(1)) tap(letter);
    check('clavier tactile fonctionnel', rowText(1) === SOLUTION);

    tap('ENTER');
    await wait(1300);
    check('grille gagnante', rowStates(1) === 'correct correct correct correct correct correct', rowStates(1));

    const dialog = window.document.getElementById('end-dialog');
    check('fin de partie annoncée', dialog.open);
    check('titre de victoire', window.document.getElementById('end-title').textContent === 'Gagné !');
    check('grille emoji partageable',
        window.document.getElementById('end-grid').textContent.split('\n').length === 2);

    const stats = storage('sutom.stats');
    check('victoire comptabilisée', stats.played === 1 && stats.won === 1);
    check('série à 1', stats.streak === 1);
    check('victoire en 2 essais', stats.distribution[1] === 1);
    check('partie en cours effacée', window.localStorage.getItem('sutom.game') === null);
}

console.log('\npartage');
{
    click('share-button');
    await wait(50);
    check('résultat copié', message() === 'Résultat copié', message());
    check('score dans le texte', clipboard.text.startsWith('SUTOM 2/6 — 6 lettres'), clipboard.text);
    check('grille emoji jointe', clipboard.text.includes('🟥🟦🟦🟦🟡🟡'), clipboard.text);
    check('lien de défi joint', clipboard.text.includes('#defi='));
    // Le tour complet : ce que le lien contient est bien le mot qu'on vient de jouer.
    const link = clipboard.text.slice(clipboard.text.indexOf('#defi='));
    check('le lien porte le mot joué', readChallenge(link) === SOLUTION, link);
    check('la réponse reste illisible', !clipboard.text.includes(SOLUTION));
}

console.log('\nrejouer');
{
    click('replay-button');
    await wait(60);
    check('dialogue refermé', !window.document.getElementById('end-dialog').open);
    check('grille remise à zéro', rowStates(0) === 'vide vide vide vide vide vide', rowStates(0));
    check('clavier remis à zéro',
        !window.document.querySelector('.key[data-key="V"]').classList.contains('absent'));
    // Le mot précédent est dans l'historique : le tirage doit en choisir un autre.
    const next = storage('sutom.game').solution;
    check('nouveau mot différent', next !== SOLUTION, next);
}

console.log('\nsortie par Échap');
{
    // On termine cette seconde partie pour retrouver le dialogue de fin, puis
    // on le ferme comme le ferait la touche Échap : sans porte de sortie, le
    // joueur resterait devant une grille figée.
    const solution = storage('sutom.game').solution;
    for (const letter of solution.slice(1)) press(letter);
    press('Enter');
    await wait(1300);

    const dialog = window.document.getElementById('end-dialog');
    check('deuxième partie terminée', dialog.open);
    dialog.close();
    check('consigne affichée', message() === 'Entrée pour une nouvelle partie');

    press('Enter');
    await wait(60);
    check('entrée relance une partie', rowStates(0) === 'vide vide vide vide vide vide', rowStates(0));
    check('consigne effacée', message() === '');
    check('deux victoires comptées', storage('sutom.stats').played === 2);
}

report();
