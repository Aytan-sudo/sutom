// Tests du moteur : règles de coloration, déroulement d'une partie, reprise.

import {
    compare, normalize, buildTemplate, letterStates, emojiGrid,
    createGame, restoreGame, CORRECT, PRESENT, ABSENT
} from '../js/engine.js';

let pass = 0, fail = 0;

function check(label, condition, detail = '') {
    if (condition) { pass++; console.log(`  OK    ${label}`); }
    else { fail++; console.log(`  ÉCHEC ${label} ${detail}`); }
}

// Écriture compacte des attentes : R = rouge, J = jaune, B = bleu.
const CODES = { R: CORRECT, J: PRESENT, B: ABSENT };
const LETTERS = { [CORRECT]: 'R', [PRESENT]: 'J', [ABSENT]: 'B' };

const marksOf = pattern => [...pattern].map(c => CODES[c]);
const show = marks => marks.map(m => LETTERS[m]).join('');
const same = (marks, pattern) => show(marks) === pattern;

console.log('\nnormalize');
check('accents retirés', normalize('béquille') === 'BEQUILLE');
check('cédille', normalize('Français') === 'FRANCAIS');
check('ligature oe', normalize('cœur') === 'COEUR');
check('ponctuation écartée', normalize("aujourd'hui") === 'AUJOURDHUI');

console.log('\ncompare');
check('mot exact tout rouge', same(compare('MAISON', 'MAISON'), 'RRRRRR'));
check('aucune lettre commune', same(compare('MEUBLE', 'MAISON'), 'RBBBBB'),
    show(compare('MEUBLE', 'MAISON')));
check('anagramme : tout jaune', same(compare('SIMONA', 'MAISON'), 'JJJJJJ'),
    show(compare('SIMONA', 'MAISON')));
check('début trouvé', same(compare('MAIGRE', 'MAISON'), 'RRRBBB'),
    show(compare('MAIGRE', 'MAISON')));
check('longueurs différentes rejetées', (() => {
    try { compare('COURT', 'MAISON'); return false; } catch { return true; }
})());

console.log('\ncompare : lettres en double');
{
    // SALADE n'a que deux A. Les deux premiers A d'ANANAS les consomment, le
    // troisième doit rester bleu au lieu de s'allumer « il y a un A quelque part ».
    const marks = compare('ANANAS', 'SALADE');
    check('A en trop reste bleu', same(marks, 'JBJBBJ'), show(marks));
}
{
    // PARLER n'a qu'un E, et il est déjà pris par le rouge en position 5 :
    // les deux autres E d'ELEVER n'ont plus rien à se mettre.
    const marks = compare('ELEVER', 'PARLER');
    check('rouge sert avant le jaune', same(marks, 'BJBBRR'), show(marks));
}
{
    const marks = compare('PASSER', 'CASSER');
    check('doubles bien placés', same(marks, 'BRRRRR'), show(marks));
}

console.log('\ntemplate');
{
    const game = createGame('MAISON');
    check('première lettre offerte', game.template().join('|') === 'M|||||');
    game.submit('MEUBLE');
    check('rien de neuf après un essai stérile', game.template().join('|') === 'M|||||');
    game.submit('MAIGRE');
    check('lettres trouvées conservées', game.template().slice(0, 3).join('') === 'MAI');
    check('cases inconnues à null', game.template()[5] === null);
}
check('les jaunes ne remplissent pas le template',
    buildTemplate('MAISON', [{ word: 'SIMONA', marks: marksOf('JJJJJJ') }]).join('|') === 'M|||||');

console.log('\nclavier');
{
    const states = letterStates([
        { word: 'MEUBLE', marks: marksOf('RBBBBB') },
        { word: 'MAISON', marks: marksOf('RRRRRR') }
    ]);
    check('meilleur état conservé', states.get('A') === CORRECT);
    check('absente reste absente', states.get('U') === ABSENT);
    check('lettre jamais jouée inconnue', states.get('Z') === undefined);
}
{
    // Le M d'ANANAS n'existe pas, mais un jaune trouvé ailleurs ne doit pas
    // être écrasé par un bleu venu d'un essai suivant.
    const states = letterStates([
        { word: 'SIMONA', marks: marksOf('JJJJJJ') },
        { word: 'MEUBLE', marks: marksOf('RBBBBB') }
    ]);
    check('un bleu ne dégrade pas un jaune', states.get('M') === CORRECT);
    check('jaune conservé', states.get('S') === PRESENT);
}

console.log('\npartie');
{
    const game = createGame('MAISON');
    check('six essais par défaut', game.maxAttempts === 6);
    check('en cours au départ', !game.isOver && game.remaining === 6);
    game.submit('MEUBLE');
    check('essai décompté', game.remaining === 5 && game.attempts.length === 1);
    game.submit('maison');
    check('victoire détectée', game.status === 'won');
    check('saisie minuscule normalisée', game.attempts[1].word === 'MAISON');
    check('proposer après la fin lève', (() => {
        try { game.submit('MEUBLE'); return false; } catch { return true; }
    })());
}
{
    const game = createGame('MAISON');
    for (let i = 0; i < 6; i++) game.submit('MEUBLE');
    check('défaite au sixième essai', game.status === 'lost');
    check("plus d'essai restant", game.remaining === 0);
}
check('longueur hors bornes refusée', (() => {
    try { createGame('CHAT'); return false; } catch { return true; }
})());
check('longueur 9 acceptée', createGame('AGRESSION').length === 9);

console.log('\npartage');
{
    const game = createGame('MAISON');
    game.submit('MEUBLE');
    game.submit('MAISON');
    const expected = '🟥🟦🟦🟦🟦🟦\n🟥🟥🟥🟥🟥🟥';
    check('grille emoji', game.emojiGrid() === expected, JSON.stringify(game.emojiGrid()));
}
check('grille vide sans essai', emojiGrid([]) === '');

console.log('\nreprise');
{
    const game = createGame('MAISON');
    game.submit('MEUBLE');
    const restored = restoreGame(JSON.parse(JSON.stringify(game)));
    check('essais rejoués', restored.attempts.length === 1);
    check('couleurs recalculées', same(restored.attempts[0].marks, 'RBBBBB'));
    check('partie jouable ensuite', !restored.isOver && restored.remaining === 5);
}
{
    const game = createGame('MAISON');
    game.submit('MAISON');
    const restored = restoreGame(JSON.parse(JSON.stringify(game)));
    check('victoire conservée', restored.status === 'won');
}
check('sauvegarde vide ignorée', restoreGame(null) === null);
check('sauvegarde corrompue ignorée', restoreGame({ solution: 'X', attempts: [] }) === null);

console.log(`\n${pass} réussis, ${fail} échecs\n`);
process.exit(fail === 0 ? 0 : 1);
