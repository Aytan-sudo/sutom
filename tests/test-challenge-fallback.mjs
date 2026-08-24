// Lien de défi abîmé : un code qui se décode en un mot inexistant.
//
// Cas réel : un lien coupé par une messagerie, ou bricolé à la main. Le jeu doit
// rester jouable — une page morte serait le pire résultat possible pour
// quelqu'un qui vient d'ouvrir un lien reçu d'un ami.
//
// Scénario à part car app.js démarre sa partie à l'import : un démarrage par
// processus.

import { encodeWord } from '../js/challenge.js';
import { boot, inspector, counter } from './harness.mjs';

const { check, report } = counter();

// Six lettres, donc une longueur valable, mais absent du dictionnaire.
const BOGUS = 'ZZZZZZ';

console.log('\nlien de défi invalide');
{
    const window = await boot({ url: `https://example.test/#defi=${encodeWord(BOGUS)}` });
    const { cellsOf, message, storage } = inspector(window);
    window.document.getElementById('help-dialog').close();

    check('le jeu démarre quand même', storage('sutom.game') !== null);
    check('mot du lien écarté', storage('sutom.game').solution !== BOGUS);
    check('joueur prévenu', message() === 'Lien de défi invalide, voici un mot au hasard', message());
    check('grille utilisable', cellsOf(0).length >= 6);
    check('première lettre offerte',
        cellsOf(0)[0].textContent === storage('sutom.game').solution[0]);
}

report();
