// Tests du lien de défi : l'encodage du mot, puis un démarrage complet sur un
// lien reçu. C'est le mécanisme qui rend le partage sensé — sans lui, celui qui
// ouvre le lien cherche un autre mot que celui de la grille partagée.

import { encodeWord, decodeWord, buildLink, readChallenge } from '../js/challenge.js';
import { boot, inspector, counter, wait } from './harness.mjs';

const { check, report } = counter();

const WORD = 'AGRESSION';
const CODE = 'QUdSRVNTSU9O';

console.log('\nencodage');
check('mot encodé', encodeWord(WORD) === CODE, encodeWord(WORD));
check('aller-retour', decodeWord(encodeWord(WORD)) === WORD);
check('accents normalisés avant encodage', encodeWord('cérémonie') === encodeWord('CEREMONIE'));
check('la réponse ne se lit pas dans le lien', !buildLink('https://x/', WORD).includes(WORD));
check('lien complet', buildLink('https://x/sutom/', WORD) === `https://x/sutom/#defi=${CODE}`);
// Un lien déjà partagé doit continuer à fonctionner : le code est un contrat.
check('code stable dans le temps', decodeWord(CODE) === WORD);

console.log('\nlecture du fragment');
check('fragment reconnu', readChallenge(`#defi=${CODE}`) === WORD);
check("fragment parmi d'autres paramètres", readChallenge(`#x=1&defi=${CODE}`) === WORD);
check('sans fragment', readChallenge('') === null);
check('fragment étranger', readChallenge('#autre=chose') === null);
check('code illisible', readChallenge('#defi=!!!!') === null);
check('code tronqué', readChallenge(`#defi=${CODE.slice(0, 4)}`) === null);
check('mot trop court refusé', readChallenge(`#defi=${encodeWord('CHAT')}`) === null);
check('mot trop long refusé', readChallenge(`#defi=${encodeWord('ANTICONSTITUTIONNEL')}`) === null);

console.log('\ndémarrage sur un lien reçu');
{
    const window = await boot({ url: `https://example.test/#defi=${CODE}` });
    const { cellsOf, rowText, message, storage, press } = inspector(window);
    window.document.getElementById('help-dialog').close();

    check('mot du lien imposé', storage('sutom.game').solution === WORD);
    check('grille à la bonne longueur', cellsOf(0).length === 9);
    check('première lettre offerte', cellsOf(0)[0].textContent === 'A');
    check('joueur prévenu', message() === 'Défi reçu : trouve le mot de ton ami', message());

    // Le défi se joue comme une partie normale.
    for (const letter of WORD.slice(1)) press(letter);
    check('saisie possible', rowText(0) === WORD);
    press('Enter');
    await wait(1800);
    check('victoire sur le mot du défi', window.document.getElementById('end-dialog').open);

    // Rejouer sort du défi : sinon un rechargement ramènerait le même mot.
    inspector(window).click('replay-button');
    await wait(80);
    check('fragment effacé', window.location.hash === '', window.location.hash);
    check('nouveau mot tiré', storage('sutom.game').solution !== WORD);
}

report();
