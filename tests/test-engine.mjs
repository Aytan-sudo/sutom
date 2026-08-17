// Tests du moteur : regles de coloration, deroulement d'une partie, reprise.

import {
    compare, normalize, buildTemplate, letterStates, emojiGrid,
    createGame, restoreGame, CORRECT, PRESENT, ABSENT
} from '../js/engine.js';

let pass = 0, fail = 0;

function check(label, condition, detail = '') {
    if (condition) { pass++; console.log(`  OK    ${label}`); }
    else { fail++; console.log(`  ECHEC ${label} ${detail}`); }
}

// Ecriture compacte des attentes : R = rouge, J = jaune, B = bleu.
const CODES = { R: CORRECT, J: PRESENT, B: ABSENT };
const LETTERS = { [CORRECT]: 'R', [PRESENT]: 'J', [ABSENT]: 'B' };

const marksOf = pattern => [...pattern].map(c => CODES[c]);
const show = marks => marks.map(m => LETTERS[m]).join('');
const same = (marks, pattern) => show(marks) === pattern;

console.log('\nnormalize');
check('accents retires', normalize('béquille') === 'BEQUILLE');
check('cedille', normalize('Français') === 'FRANCAIS');
check('ligature oe', normalize('cœur') === 'COEUR');
check('ponctuation ecartee', normalize("aujourd'hui") === 'AUJOURDHUI');

console.log('\ncompare');
check('mot exact tout rouge', same(compare('MAISON', 'MAISON'), 'RRRRRR'));
check('aucune lettre commune', same(compare('MEUBLE', 'MAISON'), 'RBBBBB'),
    show(compare('MEUBLE', 'MAISON')));
check('anagramme : tout jaune', same(compare('SIMONA', 'MAISON'), 'JJJJJJ'),
    show(compare('SIMONA', 'MAISON')));
check('debut trouve', same(compare('MAIGRE', 'MAISON'), 'RRRBBB'),
    show(compare('MAIGRE', 'MAISON')));
check('longueurs differentes rejetees', (() => {
    try { compare('COURT', 'MAISON'); return false; } catch { return true; }
})());

console.log('\ncompare : lettres en double');
{
    // SALADE n'a que deux A. Les deux premiers A d'ANANAS les consomment, le
    // troisieme doit rester bleu au lieu de s'allumer « il y a un A quelque part ».
    const marks = compare('ANANAS', 'SALADE');
    check('A en trop reste bleu', same(marks, 'JBJBBJ'), show(marks));
}
{
    // PARLER n'a qu'un E, et il est deja pris par le rouge en position 5 :
    // les deux autres E d'ELEVER n'ont plus rien a se mettre.
    const marks = compare('ELEVER', 'PARLER');
    check('rouge sert avant le jaune', same(marks, 'BJBBRR'), show(marks));
}
{
    const marks = compare('PASSER', 'CASSER');
    check('doubles bien places', same(marks, 'BRRRRR'), show(marks));
}

console.log('\ntemplate');
{
    const game = createGame('MAISON');
    check('premiere lettre offerte', game.template().join('|') === 'M|||||');
    game.submit('MEUBLE');
    check('rien de neuf apres un essai sterile', game.template().join('|') === 'M|||||');
    game.submit('MAIGRE');
    check('lettres trouvees conservees', game.template().slice(0, 3).join('') === 'MAI');
    check('cases inconnues a null', game.template()[5] === null);
}
check('les jaunes ne remplissent pas le template',
    buildTemplate('MAISON', [{ word: 'SIMONA', marks: marksOf('JJJJJJ') }]).join('|') === 'M|||||');

console.log('\nclavier');
{
    const states = letterStates([
        { word: 'MEUBLE', marks: marksOf('RBBBBB') },
        { word: 'MAISON', marks: marksOf('RRRRRR') }
    ]);
    check('meilleur etat conserve', states.get('A') === CORRECT);
    check('absente reste absente', states.get('U') === ABSENT);
    check('lettre jamais jouee inconnue', states.get('Z') === undefined);
}
{
    // Le M d'ANANAS n'existe pas, mais un jaune trouve ailleurs ne doit pas
    // etre ecrase par un bleu venu d'un essai suivant.
    const states = letterStates([
        { word: 'SIMONA', marks: marksOf('JJJJJJ') },
        { word: 'MEUBLE', marks: marksOf('RBBBBB') }
    ]);
    check('un bleu ne degrade pas un jaune', states.get('M') === CORRECT);
    check('jaune conserve', states.get('S') === PRESENT);
}

console.log('\npartie');
{
    const game = createGame('MAISON');
    check('six essais par defaut', game.maxAttempts === 6);
    check('en cours au depart', !game.isOver && game.remaining === 6);
    game.submit('MEUBLE');
    check('essai decompte', game.remaining === 5 && game.attempts.length === 1);
    game.submit('maison');
    check('victoire detectee', game.status === 'won');
    check('saisie minuscule normalisee', game.attempts[1].word === 'MAISON');
    check('proposer apres la fin leve', (() => {
        try { game.submit('MEUBLE'); return false; } catch { return true; }
    })());
}
{
    const game = createGame('MAISON');
    for (let i = 0; i < 6; i++) game.submit('MEUBLE');
    check('defaite au sixieme essai', game.status === 'lost');
    check('plus d essai restant', game.remaining === 0);
}
check('longueur hors bornes refusee', (() => {
    try { createGame('CHAT'); return false; } catch { return true; }
})());
check('longueur 9 acceptee', createGame('AGRESSION').length === 9);

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
    check('essais rejoues', restored.attempts.length === 1);
    check('couleurs recalculees', same(restored.attempts[0].marks, 'RBBBBB'));
    check('partie jouable ensuite', !restored.isOver && restored.remaining === 5);
}
{
    const game = createGame('MAISON');
    game.submit('MAISON');
    const restored = restoreGame(JSON.parse(JSON.stringify(game)));
    check('victoire conservee', restored.status === 'won');
}
check('sauvegarde vide ignoree', restoreGame(null) === null);
check('sauvegarde corrompue ignoree', restoreGame({ solution: 'X', attempts: [] }) === null);

console.log(`\n${pass} reussis, ${fail} echecs\n`);
process.exit(fail === 0 ? 0 : 1);
