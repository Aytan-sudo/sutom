// Le passeport commun du hub : ouvert avec un profil, le jeu range tout dans
// l'espace de l'enfant, et dix mots acceptés dans la journée donnent le tampon
// Mots — les mots faux comptent, les mots refusés non.
//
// Fichier à part : le harnais ne démarre qu'une partie par processus, et le
// passeport doit exister avant l'import du stockage.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { today } from '../js/daily.js';
import { boot, inspector, counter, wait, ROOT } from './harness.mjs';

const { check, report } = counter();
const source = readFileSync(join(ROOT, 'commun', 'passeport.js'), 'utf8');
const PROFIL = 'profil-test-lou';
const tampons = [];
let coffre;

console.log('\nune journée de SUTOM avec un passeport');
{
    const window = await boot({
        url: `https://example.test/?profil=${PROFIL}&mission=passeport`,
        avant: window => {
            // Le hub a créé le passeport de Lou dans ce navigateur, avec
            // l'option qui permet de retaper un mot entier à chaque essai.
            const hub = { module: { exports: {} }, crypto: globalThis.crypto };
            vm.runInNewContext(source, hub);
            coffre = hub.module.exports.creerCoffre({ stockage: window.localStorage, uuid: () => PROFIL });
            coffre.creerProfil({ nom: 'Lou' });
            coffre.stockageJeu('sutom', PROFIL).setItem('sutom.settings', JSON.stringify({ freeInput: true }));
            // Puis la page charge le module comme un script classique, avant app.js.
            const page = {
                document: window.document, localStorage: window.localStorage, location: window.location,
                URL, crypto: globalThis.crypto, CustomEvent: window.CustomEvent, dispatchEvent: e => window.dispatchEvent(e)
            };
            vm.runInNewContext(source, page);
            globalThis.Passeport = page.Passeport;
            window.addEventListener('passeport-tampon', event => tampons.push(event.detail));
        }
    });
    const { press, message, click } = inspector(window);
    const espace = globalThis.Passeport.stockageJeu('sutom');
    const lire = cle => JSON.parse(espace.getItem(cle));
    window.document.getElementById('help-dialog').close();

    const solution = () => lire('sutom.game').solution;
    const mots = mot => readFileSync(join(ROOT, 'data', `lexique-${mot.length}.txt`), 'utf8')
        .split('\n').filter(m => m && m[0] === mot[0] && m !== mot);
    async function proposer(mot) {
        for (let i = 0; i < mot.length; i++) press('Backspace');
        for (const lettre of mot.slice(1)) press(lettre);
        press('Enter');
        await wait(1800); // révélation de la ligne
    }

    check('le jeu reconnaît l’enfant', globalThis.Passeport.profilId === PROFIL);
    check('réglages et aide rangés dans le passeport, pas en mode invité',
        lire('sutom.settings')?.freeInput === true && espace.getItem('sutom.help-seen') === 'true'
        && window.localStorage.getItem('sutom.settings') === null && window.localStorage.getItem('sutom.help-seen') === null);

    // Deux refus : ni l'un ni l'autre ne compte.
    const premiere = solution();
    press('Backspace'); press('Enter'); await wait(50);
    check('un mot incomplet est refusé', /incomplet/.test(message()), message());
    await proposer(premiere[0] + 'ZQZQZQZQZ'.slice(0, premiere.length - 1));
    check('un mot hors dictionnaire est refusé', /dictionnaire/.test(message()), message());
    check('les refus ne comptent pas', espace.getItem('sutom.passeport') === null);

    // Six mots faux : la première partie est perdue, ils comptent quand même.
    for (const mot of mots(premiere).slice(0, 6)) await proposer(mot);
    check('première partie terminée', lire('sutom.game') === null && lire('sutom.stats')?.played === 1);
    check('six mots comptés', lire('sutom.passeport')?.words === 6 && lire('sutom.passeport')?.day === today());
    check('pas encore de tampon', tampons.length === 0 && coffre.bilan(PROFIL).themes.mots.length === 0);

    click('replay-button');
    await wait(100);
    check('rejouer garde l’enfant dans l’adresse', new URLSearchParams(window.location.search).get('profil') === PROFIL, window.location.search);

    const suivants = mots(solution()).slice(0, 4);
    for (const mot of suivants.slice(0, 3)) await proposer(mot);
    check('neuf mots : toujours rien', tampons.length === 0 && lire('sutom.passeport')?.words === 9);
    await proposer(suivants[3]);
    check('le dixième mot donne le tampon Mots', tampons.length === 1 && tampons[0].theme === 'mots' && tampons[0].jeu === 'sutom');
    check('le hub le voit dans le carnet', coffre.bilan(PROFIL).themes.mots.length === 1 && coffre.bilan(PROFIL).joursTotal === 1);
    check('la journée est validée : SUTOM fait partie des activités', tampons[0]?.pedagogique === true);

    press('Backspace');
    const onzieme = mots(solution()).slice(4, 5)[0];
    if (onzieme && lire('sutom.game')) await proposer(onzieme);
    check('un seul tampon par jour', tampons.length === 1 && coffre.bilan(PROFIL).themes.mots.length === 1);
}

report();
