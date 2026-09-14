// Le passeport commun, côté réussite : trouver le mot donne le tampon Mots
// tout de suite, même au premier essai, sans attendre les dix mots.
//
// Fichier à part : le harnais ne démarre qu'une partie par processus. Le hasard
// figé tombe sur le premier mot de solutions-6.txt, le test le connaît donc.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { boot, inspector, counter, wait, ROOT } from './harness.mjs';

const { check, report } = counter();
const source = readFileSync(join(ROOT, 'commun', 'passeport.js'), 'utf8');
const PROFIL = 'profil-test-noe';
const MOT = readFileSync(join(ROOT, 'data', 'solutions-6.txt'), 'utf8').split('\n').filter(Boolean)[0];
const tampons = [];
let coffre;

console.log('\nun mot trouvé du premier coup avec un passeport');
{
    const window = await boot({
        url: `https://example.test/?profil=${PROFIL}`,
        avant: window => {
            const hub = { module: { exports: {} }, crypto: globalThis.crypto };
            vm.runInNewContext(source, hub);
            coffre = hub.module.exports.creerCoffre({ stockage: window.localStorage, uuid: () => PROFIL });
            coffre.creerProfil({ nom: 'Noé' });
            const page = {
                document: window.document, localStorage: window.localStorage, location: window.location,
                URL, crypto: globalThis.crypto, CustomEvent: window.CustomEvent, dispatchEvent: e => window.dispatchEvent(e)
            };
            vm.runInNewContext(source, page);
            globalThis.Passeport = page.Passeport;
            window.addEventListener('passeport-tampon', event => tampons.push(event.detail));
        }
    });
    const { press, click } = inspector(window);
    window.document.getElementById('help-dialog').close();

    for (const lettre of MOT.slice(1)) press(lettre);
    press('Enter');
    await wait(1800);

    check('la partie est gagnée en un essai', window.document.getElementById('end-dialog').hasAttribute('open'));
    check('un seul mot compté', JSON.parse(globalThis.Passeport.stockageJeu('sutom').getItem('sutom.passeport'))?.words === 1);
    check('le tampon Mots tombe tout de suite', tampons.length === 1 && tampons[0].theme === 'mots' && coffre.bilan(PROFIL).themes.mots.length === 1);

    click('replay-button');
    await wait(100);
    const suivant = JSON.parse(globalThis.Passeport.stockageJeu('sutom').getItem('sutom.game')).solution;
    for (const lettre of suivant.slice(1)) press(lettre);
    press('Enter');
    await wait(1800);
    check('un deuxième mot trouvé le même jour ne double pas le tampon', tampons.length === 1 && coffre.bilan(PROFIL).themes.mots.length === 1);
}

report();
