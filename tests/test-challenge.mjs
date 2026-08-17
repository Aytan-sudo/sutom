// Tests du lien de defi : l'encodage du mot, puis un demarrage complet sur un
// lien recu. C'est le mecanisme qui rend le partage sensé — sans lui, celui qui
// ouvre le lien cherche un autre mot que celui de la grille partagee.

import { encodeWord, decodeWord, buildLink, readChallenge } from '../js/challenge.js';
import { boot, inspector, counter, wait } from './harness.mjs';

const { check, report } = counter();

const WORD = 'AGRESSION';
const CODE = 'QUdSRVNTSU9O';

console.log('\nencodage');
check('mot encode', encodeWord(WORD) === CODE, encodeWord(WORD));
check('aller-retour', decodeWord(encodeWord(WORD)) === WORD);
check('accents normalises avant encodage', encodeWord('cérémonie') === encodeWord('CEREMONIE'));
check('la reponse ne se lit pas dans le lien', !buildLink('https://x/', WORD).includes(WORD));
check('lien complet', buildLink('https://x/sutom/', WORD) === `https://x/sutom/#defi=${CODE}`);
// Un lien deja partage doit continuer a fonctionner : le code est un contrat.
check('code stable dans le temps', decodeWord(CODE) === WORD);

console.log('\nlecture du fragment');
check('fragment reconnu', readChallenge(`#defi=${CODE}`) === WORD);
check('fragment parmi d autres parametres', readChallenge(`#x=1&defi=${CODE}`) === WORD);
check('sans fragment', readChallenge('') === null);
check('fragment etranger', readChallenge('#autre=chose') === null);
check('code illisible', readChallenge('#defi=!!!!') === null);
check('code tronque', readChallenge(`#defi=${CODE.slice(0, 4)}`) === null);
check('mot trop court refuse', readChallenge(`#defi=${encodeWord('CHAT')}`) === null);
check('mot trop long refuse', readChallenge(`#defi=${encodeWord('ANTICONSTITUTIONNEL')}`) === null);

console.log('\ndemarrage sur un lien recu');
{
    const window = await boot({ url: `https://example.test/#defi=${CODE}` });
    const { cellsOf, rowText, message, storage, press } = inspector(window);
    window.document.getElementById('help-dialog').close();

    check('mot du lien impose', storage('sutom.game').solution === WORD);
    check('grille a la bonne longueur', cellsOf(0).length === 9);
    check('premiere lettre offerte', cellsOf(0)[0].textContent === 'A');
    check('joueur prevenu', message() === 'Defi recu : trouve le mot de ton ami', message());

    // Le defi se joue comme une partie normale.
    for (const letter of WORD.slice(1)) press(letter);
    check('saisie possible', rowText(0) === WORD);
    press('Enter');
    await wait(1800);
    check('victoire sur le mot du defi', window.document.getElementById('end-dialog').open);

    // Rejouer sort du defi : sinon un rechargement ramenerait le meme mot.
    inspector(window).click('replay-button');
    await wait(80);
    check('fragment efface', window.location.hash === '', window.location.hash);
    check('nouveau mot tire', storage('sutom.game').solution !== WORD);
}

report();
