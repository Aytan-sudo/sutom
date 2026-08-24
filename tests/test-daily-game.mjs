// Une partie du jour de bout en bout : `?jour=` dans l'URL, le mot retrouvé
// sans serveur, la fin de partie, la série et le partage.
//
// Le jour testé est celui de l'horloge, pas une date en dur : c'est le cas
// courant — le défi du jour même, celui qui compte pour la série — et le test
// ne se met pas à mentir le lendemain. La logique de série sur des dates
// choisies est couverte par test-daily.mjs, sans navigateur.
//
// Fichier à part : le harnais ne démarre qu'une partie par processus, et le
// stockage doit voir le localStorage de jsdom dès son premier import.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { today, dayLength, dayIndex, formatDay } from '../js/daily.js';
import { boot, inspector, counter, wait, clipboard, ROOT } from './harness.mjs';

const { check, report } = counter();
const JOUR = today();

console.log('\nune partie du jour, de bout en bout');
{
    const window = await boot({ url: `https://example.test/?jour=${JOUR}` });
    const { cellsOf, rowText, message, storage, press, click } = inspector(window);
    window.document.getElementById('help-dialog').close();

    // Le mot attendu se recalcule ici comme le ferait un autre navigateur.
    const longueur = dayLength(JOUR);
    const solutions = readFileSync(join(ROOT, 'data', `solutions-${longueur}.txt`), 'utf8')
        .split('\n').filter(Boolean);
    const MOT = solutions[dayIndex(JOUR, solutions.length)];

    check('grille à la longueur du jour', cellsOf(0).length === longueur, String(cellsOf(0).length));
    check('mot du jour retrouvé sans serveur', storage('sutom.game').solution === MOT, storage('sutom.game').solution);
    check('la partie retient sa date', storage('sutom.game').day === JOUR);
    check('joueur situé', message().includes(formatDay(JOUR)), message());

    for (const letter of MOT.slice(1)) press(letter);
    check('saisie possible', rowText(0) === MOT);
    press('Enter');
    await wait(1800);

    check('fin de partie annoncée', window.document.getElementById('end-dialog').open);
    check('bandeau du jour affiché',
        window.document.getElementById('end-day').textContent === `Mot du jour · ${formatDay(JOUR)}`,
        window.document.getElementById('end-day').textContent);

    const daily = storage('sutom.daily');
    check('résultat quotidien enregistré', daily.results[JOUR].won === true);
    check('série du jour ouverte', daily.streak === 1 && daily.bestStreak === 1);
    check('dernier jour retenu', daily.lastDay === JOUR);

    click('share-button');
    await wait(50);
    check('date en tête du partage', clipboard.text.startsWith(`SUTOM ${formatDay(JOUR)}`), clipboard.text);
    check('lien du jour joint', clipboard.text.includes(`?jour=${JOUR}`), clipboard.text);
    check('le lien ne porte pas la solution', !clipboard.text.includes(MOT), clipboard.text);
    check('grille emoji jointe', clipboard.text.includes('🟥'), clipboard.text);
}

report();
