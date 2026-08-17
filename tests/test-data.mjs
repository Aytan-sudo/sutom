// Verifie les fichiers de data/. Ils sont generes puis commites : un test les
// relit tels que le navigateur les recevra, pour qu'une regeneration ratee ne
// parte pas en production.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_LENGTH, MAX_LENGTH } from '../js/engine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;

function check(label, condition, detail = '') {
    if (condition) { pass++; console.log(`  OK    ${label}`); }
    else { fail++; console.log(`  ECHEC ${label} ${detail}`); }
}

function readWords(name) {
    return readFileSync(join(ROOT, 'data', name), 'utf8').split('\n').filter(Boolean);
}

const excluded = new Set(
    readFileSync(join(ROOT, 'scripts', 'mots-exclus.txt'), 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
);

for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
    console.log(`\n${n} lettres`);

    const solutions = readWords(`solutions-${n}.txt`);
    const lexicon = readWords(`lexique-${n}.txt`);
    const lexiconSet = new Set(lexicon);

    check('assez de solutions', solutions.length > 500, `(${solutions.length})`);
    check('lexique fourni', lexicon.length > solutions.length, `(${lexicon.length})`);

    const badShape = lexicon.find(word => !/^[A-Z]+$/.test(word) || word.length !== n);
    check('lexique : majuscules non accentuees, bonne longueur', badShape === undefined, badShape || '');

    const badSolution = solutions.find(word => !/^[A-Z]+$/.test(word) || word.length !== n);
    check('solutions : majuscules non accentuees, bonne longueur', badSolution === undefined, badSolution || '');

    // Sans cette garantie, le mot a deviner pourrait etre refuse a la saisie.
    const orphan = solutions.find(word => !lexiconSet.has(word));
    check('toute solution est acceptee a la saisie', orphan === undefined, orphan || '');

    check('lexique sans doublon', lexiconSet.size === lexicon.length);
    check('lexique trie', lexicon.every((word, i) => i === 0 || lexicon[i - 1] < word));

    const banned = solutions.find(word => excluded.has(word));
    check('aucun mot exclu parmi les solutions', banned === undefined, banned || '');
}

console.log(`\n${pass} reussis, ${fail} echecs\n`);
process.exit(fail === 0 ? 0 : 1);
