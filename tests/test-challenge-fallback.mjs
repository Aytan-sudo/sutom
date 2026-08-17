// Lien de defi abime : un code qui se decode en un mot inexistant.
//
// Cas reel : un lien coupe par une messagerie, ou bricole a la main. Le jeu doit
// rester jouable — une page morte serait le pire resultat possible pour
// quelqu'un qui vient d'ouvrir un lien recu d'un ami.
//
// Scenario a part car app.js demarre sa partie a l'import : un demarrage par
// processus.

import { encodeWord } from '../js/challenge.js';
import { boot, inspector, counter } from './harness.mjs';

const { check, report } = counter();

// Six lettres, donc une longueur valable, mais absent du dictionnaire.
const BOGUS = 'ZZZZZZ';

console.log('\nlien de defi invalide');
{
    const window = await boot({ url: `https://example.test/#defi=${encodeWord(BOGUS)}` });
    const { cellsOf, message, storage } = inspector(window);
    window.document.getElementById('help-dialog').close();

    check('le jeu demarre quand meme', storage('sutom.game') !== null);
    check('mot du lien ecarte', storage('sutom.game').solution !== BOGUS);
    check('joueur prevenu', message() === 'Lien de defi invalide, voici un mot au hasard', message());
    check('grille utilisable', cellsOf(0).length >= 6);
    check('premiere lettre offerte',
        cellsOf(0)[0].textContent === storage('sutom.game').solution[0]);
}

report();
