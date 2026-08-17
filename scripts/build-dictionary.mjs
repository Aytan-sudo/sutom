#!/usr/bin/env node
// Genere les fichiers de data/ a partir de Lexique 3.83 (http://www.lexique.org).
//
// Deux jeux de fichiers, un par longueur de mot :
//   - lexique-N.txt   : mots acceptes en saisie (toutes les formes flechies)
//   - solutions-N.txt : mots a deviner (noms, adjectifs et infinitifs courants)
//
// Les fichiers produits sont commites : le site n'a besoin d'aucun build.
//
//   node scripts/build-dictionary.mjs [--source .cache/Lexique383.tsv] [--stats]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const MIN_LENGTH = 6;
const MAX_LENGTH = 9;

// Frequence minimale (occurrences par million) pour qu'un mot soit une solution.
// A 1.5 on obtient ~2000 mots par longueur : assez pour ne pas tourner en rond,
// assez peu pour que le mot reste devinable.
const MIN_FREQUENCY = 1.5;

// Seules ces categories font de bonnes solutions. Les verbes n'entrent que par
// leur infinitif (islem), pas par leurs formes conjuguees.
const SOLUTION_CATEGORIES = new Set(['NOM', 'ADJ', 'VER']);

// Majuscules sans accent, comme dans la grille : ete -> ETE, ca -> CA, oeuf -> OEUF.
// Retourne '' si le mot contient autre chose que des lettres (trait d'union,
// apostrophe, espace, chiffre) : ces mots-la sont hors-jeu.
export function normalize(word) {
    const plain = word
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/Œ/g, 'OE')
        .replace(/Æ/g, 'AE');
    return /^[A-Z]+$/.test(plain) ? plain : '';
}

function parseArgs(argv) {
    const args = { source: null, stats: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--source') {
            args.source = argv[i + 1];
            i++;
        } else if (argv[i] === '--stats') {
            args.stats = true;
        }
    }
    return args;
}

function findSource(path) {
    const candidates = path
        ? [path]
        : [join(ROOT, '.cache', 'Lexique383.tsv'), join(ROOT, 'Lexique383.tsv')];
    const found = candidates.find(c => existsSync(c));
    if (!found) {
        console.error(
            'Lexique383.tsv introuvable. Telechargez-le puis relancez :\n' +
            '  mkdir -p .cache && curl -o .cache/Lexique383.tsv \\\n' +
            '      http://www.lexique.org/databases/Lexique383/Lexique383.tsv\n' +
            '  npm run build:dict'
        );
        process.exit(1);
    }
    return found;
}

// Mots acceptes a la saisie mais jamais tires comme solution (voir le fichier
// pour le pourquoi : le corpus vient de sous-titres de films).
function readExclusions() {
    const path = join(ROOT, 'scripts', 'mots-exclus.txt');
    if (!existsSync(path)) return new Set();
    const words = readFileSync(path, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    return new Set(words);
}

// Un mot fait une bonne solution s'il est courant, dans sa forme de base, et
// commun. On ecarte les pluriels (« CHATS » se devine mal) et les noms propres,
// que Lexique laisse avec leur majuscule initiale.
function isSolution(entry) {
    if (!SOLUTION_CATEGORIES.has(entry.cgram)) return false;
    if (entry.islem !== '1') return false;
    if (entry.nombre === 'p') return false;
    if (/^[A-ZÀ-Ü]/.test(entry.ortho)) return false;
    const frequency = Math.max(
        Number(entry.freqlemfilms2) || 0,
        Number(entry.freqlemlivres) || 0
    );
    return frequency >= MIN_FREQUENCY;
}

function build(source) {
    const excluded = readExclusions();
    const lines = readFileSync(source, 'utf8').split('\n');
    const columns = lines[0].split('\t');
    const col = Object.fromEntries(columns.map((name, i) => [name, i]));

    const lexicon = new Map();   // longueur -> Set de mots
    const solutions = new Map();
    for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
        lexicon.set(n, new Set());
        solutions.set(n, new Set());
    }

    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split('\t');
        if (fields.length < columns.length) continue;

        const ortho = fields[col.ortho];
        const word = normalize(ortho);
        if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) continue;

        lexicon.get(word.length).add(word);

        const entry = {
            ortho,
            cgram: fields[col.cgram],
            nombre: fields[col.nombre],
            islem: fields[col.islem],
            freqlemfilms2: fields[col.freqlemfilms2],
            freqlemlivres: fields[col.freqlemlivres]
        };
        if (!excluded.has(word) && isSolution(entry)) {
            solutions.get(word.length).add(word);
        }
    }

    return { lexicon, solutions };
}

function write(name, words) {
    const sorted = [...words].sort();
    writeFileSync(join(DATA_DIR, name), sorted.join('\n') + '\n', 'utf8');
    return sorted.length;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const { lexicon, solutions } = build(findSource(args.source));

    console.log('longueur  solutions  lexique');
    for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
        const nbSolutions = args.stats
            ? solutions.get(n).size
            : write(`solutions-${n}.txt`, solutions.get(n));
        const nbLexicon = args.stats
            ? lexicon.get(n).size
            : write(`lexique-${n}.txt`, lexicon.get(n));
        console.log(
            String(n).padStart(8) +
            String(nbSolutions).padStart(11) +
            String(nbLexicon).padStart(9)
        );
    }
    if (args.stats) console.log('\n(--stats : aucun fichier ecrit)');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
