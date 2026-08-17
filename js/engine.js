// Moteur du jeu : regles pures, aucune dependance au DOM ni au reseau.
// Tout ce qui est ici tourne tel quel sous Node, donc se teste sans navigateur.

export const CORRECT = 'correct'; // bien place    -> rouge
export const PRESENT = 'present'; // mal place     -> jaune
export const ABSENT = 'absent';   // pas dans le mot -> bleu

export const MAX_ATTEMPTS = 6;
export const MIN_LENGTH = 6;
export const MAX_LENGTH = 9;

const EMOJI = {
    [CORRECT]: '🟥',
    [PRESENT]: '🟡',
    [ABSENT]: '🟦'
};

// Majuscules sans accent : c'est la seule forme que le moteur manipule.
// Doit rester identique a la normalisation de scripts/build-dictionary.mjs,
// sinon un mot du dictionnaire pourrait ne plus correspondre a la saisie.
export function normalize(word) {
    return word
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/Œ/g, 'OE')
        .replace(/Æ/g, 'AE')
        .replace(/[^A-Z]/g, '');
}

// Compare une proposition au mot cache et renvoie un statut par lettre.
//
// Le piege classique, ce sont les lettres en double : dans SANTE, un S de trop
// dans la proposition ne doit pas s'allumer en jaune sous pretexte qu'il y a
// « un S quelque part ». On compte donc d'abord les lettres consommees par les
// rouges, et les jaunes se servent uniquement dans ce qui reste.
export function compare(guess, solution) {
    if (guess.length !== solution.length) {
        throw new Error(`longueurs incompatibles : ${guess.length} vs ${solution.length}`);
    }

    const marks = new Array(guess.length).fill(ABSENT);
    const available = new Map();

    for (let i = 0; i < solution.length; i++) {
        if (guess[i] === solution[i]) {
            marks[i] = CORRECT;
        } else {
            available.set(solution[i], (available.get(solution[i]) || 0) + 1);
        }
    }

    for (let i = 0; i < guess.length; i++) {
        if (marks[i] === CORRECT) continue;
        const left = available.get(guess[i]) || 0;
        if (left > 0) {
            marks[i] = PRESENT;
            available.set(guess[i], left - 1);
        }
    }

    return marks;
}

// Les lettres acquises, dans l'ordre du mot : la premiere lettre est offerte
// des le depart (regle Motus) et chaque rouge trouve reste affiche ensuite.
// Les cases non trouvees valent null.
export function buildTemplate(solution, attempts) {
    const template = new Array(solution.length).fill(null);
    template[0] = solution[0];
    for (const attempt of attempts) {
        attempt.marks.forEach((mark, i) => {
            if (mark === CORRECT) template[i] = attempt.word[i];
        });
    }
    return template;
}

// Etat le plus favorable connu pour chaque lettre, pour colorer le clavier.
export function letterStates(attempts) {
    const rank = { [ABSENT]: 0, [PRESENT]: 1, [CORRECT]: 2 };
    const states = new Map();
    for (const attempt of attempts) {
        attempt.marks.forEach((mark, i) => {
            const letter = attempt.word[i];
            const known = states.get(letter);
            if (known === undefined || rank[mark] > rank[known]) {
                states.set(letter, mark);
            }
        });
    }
    return states;
}

export function emojiGrid(attempts) {
    return attempts
        .map(attempt => attempt.marks.map(mark => EMOJI[mark]).join(''))
        .join('\n');
}

// Une partie. L'objet est mutable et se serialise tel quel (toJSON) : c'est ce
// qui permet de retrouver sa grille en cours apres un rechargement de page.
export function createGame(solution, { maxAttempts = MAX_ATTEMPTS } = {}) {
    const word = normalize(solution);
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) {
        throw new Error(`longueur de solution hors bornes : ${word}`);
    }

    return {
        solution: word,
        length: word.length,
        maxAttempts,
        attempts: [],
        status: 'playing', // 'playing' | 'won' | 'lost'

        get isOver() {
            return this.status !== 'playing';
        },

        get remaining() {
            return this.maxAttempts - this.attempts.length;
        },

        // Enregistre une proposition. Le mot est suppose deja valide (bonne
        // longueur, present au dictionnaire) : c'est l'appelant qui filtre,
        // pour que le moteur n'ait pas a connaitre le dictionnaire.
        submit(guess) {
            if (this.isOver) throw new Error('partie terminee');
            const attempt = { word: normalize(guess), marks: null };
            attempt.marks = compare(attempt.word, this.solution);
            this.attempts.push(attempt);

            if (attempt.word === this.solution) this.status = 'won';
            else if (this.attempts.length >= this.maxAttempts) this.status = 'lost';

            return attempt;
        },

        template() {
            return buildTemplate(this.solution, this.attempts);
        },

        letterStates() {
            return letterStates(this.attempts);
        },

        emojiGrid() {
            return emojiGrid(this.attempts);
        },

        toJSON() {
            return {
                solution: this.solution,
                maxAttempts: this.maxAttempts,
                attempts: this.attempts,
                status: this.status
            };
        }
    };
}

// Reconstruit une partie a partir d'un toJSON(). On rejoue les propositions au
// lieu de faire confiance aux marques stockees : si les regles changent, une
// partie sauvegardee se recalcule au lieu d'afficher d'anciennes couleurs.
export function restoreGame(data) {
    if (!data || typeof data.solution !== 'string') return null;
    try {
        const game = createGame(data.solution, { maxAttempts: data.maxAttempts });
        for (const attempt of data.attempts || []) {
            if (game.isOver) break;
            game.submit(attempt.word);
        }
        return game;
    } catch (e) {
        return null; // sauvegarde corrompue ou issue d'une version incompatible
    }
}
