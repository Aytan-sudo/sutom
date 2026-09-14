// Les vérifications structurelles : ce que ni le moteur ni jsdom n'attrapent,
// parce que rien ne lève d'erreur. Un fichier absent de la coquille du service
// worker, un id renommé dans la page, une variable oubliée dans une palette,
// une version qui ne concorde plus : le jeu continue de tourner, mal.
//
// La cinquième vérification de la convention — la syntaxe de chaque module —
// est `npm run check`, qui passe `node --check` sur les neuf fichiers.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { counter, ROOT } from './harness.mjs';
import { VERSION } from '../js/config.js';
import { THEMES } from '../js/themes.js';

const { check, report } = counter();
const lire = chemin => readFileSync(join(ROOT, chemin), 'utf8');

// Un commentaire CSS mal refermé avale les règles qui le suivent, sans que
// rien ne proteste : la page s'affiche, la couleur manque. On vérifie donc
// l'équilibre, et on analyse ensuite le CSS débarrassé de ses commentaires —
// sinon une règle citée dans un commentaire passerait pour une vraie.
const sansCommentaires = texte => texte.replace(/\/\*[\s\S]*?\*\//g, '');

const page = lire('index.html');
const worker = lire('sw.js');
const themesBrut = lire('css/themes.css');
const styleBrut = lire('css/style.css');
const themes = sansCommentaires(themesBrut);
const style = sansCommentaires(styleBrut);
const paquet = JSON.parse(lire('package.json'));
const manifeste = JSON.parse(lire('manifest.webmanifest'));
const modules = readdirSync(join(ROOT, 'js')).filter(nom => nom.endsWith('.js'));
const sources = Object.fromEntries(modules.map(nom => [nom, lire(`js/${nom}`)]));

console.log('\nla version, aux trois endroits');
check('paquet et code s’accordent', paquet.version === VERSION, `${paquet.version} vs ${VERSION}`);
check('la page affiche la même', page.includes(`Sutom ${VERSION}`));
check('le cache porte la même', worker.includes(`const VERSION = 'sutom-${VERSION}'`));
check('numéro en semver', /^\d+\.\d+\.\d+$/.test(VERSION), VERSION);

console.log('\nla coquille hors ligne');
{
    const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);
    const attendus = [
        'index.html', 'manifest.webmanifest',
        ...readdirSync(join(ROOT, 'css')).map(nom => `css/${nom}`),
        ...modules.map(nom => `js/${nom}`),
        ...readdirSync(join(ROOT, 'assets')).map(nom => `assets/${nom}`)
    ];
    const oublies = attendus.filter(chemin => !coquille.includes(chemin));
    check('tous les fichiers du jeu sont en cache', oublies.length === 0, oublies.join(', '));
    const fantomes = coquille.filter(chemin => chemin !== './' && !existsSync(join(ROOT, chemin)));
    check('aucun fichier fantôme dans la coquille', fantomes.length === 0, fantomes.join(', '));
    check('la racine est servie hors ligne', coquille.includes('./'));
    check('le service worker est enregistré', sources['app.js'].includes("navigator.serviceWorker.register('sw.js')"));
    // Les listes de mots pèsent 630 Ko : elles se mettent en cache au fil des
    // parties, pas à l'installation. Aucune ne doit donc figurer dans la coquille.
    check('les listes de mots restent hors de la coquille', !coquille.some(chemin => chemin.startsWith('data/')));
}

console.log('\nles modules');
{
    // On suit les imports depuis app.js : un module que plus personne ne charge
    // est du code mort qui continue de passer les tests.
    const vus = new Set();
    const aVoir = ['app.js'];
    while (aVoir.length) {
        const nom = aVoir.pop();
        if (vus.has(nom)) continue;
        vus.add(nom);
        for (const [, cible] of sources[nom].matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) aVoir.push(cible);
    }
    const orphelins = modules.filter(nom => !vus.has(nom));
    check('tous les modules sont reliés à l’application', orphelins.length === 0, orphelins.join(', '));
    check('la page charge une application modulaire', page.includes('<script type="module" src="js/app.js">'));
    const controles = paquet.scripts.check;
    const nonControles = modules.filter(nom => !controles.includes(`js/${nom}`));
    check('npm run check couvre chaque module', nonControles.length === 0, nonControles.join(', '));
}

console.log('\nles identifiants cherchés dans la page');
{
    const demandes = new Set();
    for (const source of Object.values(sources)) {
        for (const [, id] of source.matchAll(/getElementById\('([\w-]+)'\)/g)) demandes.add(id);
    }
    const absents = [...demandes].filter(id => !page.includes(`id="${id}"`));
    check('chaque élément cherché existe', absents.length === 0, absents.join(', '));
    check('au moins la grille et le clavier', demandes.has('board') && demandes.has('keyboard'));
}

console.log('\nles feuilles de style');
{
    for (const [nom, texte] of [['themes.css', themesBrut], ['style.css', styleBrut]]) {
        const ouvertures = (texte.match(/\/\*/g) || []).length;
        const fermetures = (texte.match(/\*\//g) || []).length;
        check(`${nom} : commentaires refermés`, ouvertures === fermetures,
            `${ouvertures} ouverts, ${fermetures} fermés`);
    }
    check('les couleurs vivent dans themes.css', themes.includes('--red:') && !style.includes('--red:'));
}

console.log('\nles palettes');
{
    const bloc = nom => {
        const debut = themes.indexOf(nom);
        if (debut === -1) return null;
        const ouvrante = themes.indexOf('{', debut);
        return themes.slice(ouvrante, themes.indexOf('}', ouvrante));
    };
    const variables = texte => new Set([...texte.matchAll(/(--[\w-]+):/g)].map(([, nom]) => nom));

    const reference = variables(bloc('[data-theme="plateau"]'));
    check('la palette de référence est fournie', reference.size >= 10, `${reference.size} variables`);
    check('quatre à six palettes', THEMES.length >= 4 && THEMES.length <= 6, String(THEMES.length));

    const incompletes = [];
    for (const theme of THEMES) {
        const texte = bloc(`[data-theme="${theme.id}"]`);
        if (!texte) { incompletes.push(`${theme.id} (absente)`); continue; }
        const manquantes = [...reference].filter(nom => !variables(texte).has(nom));
        if (manquantes.length) incompletes.push(`${theme.id} : ${manquantes.join(' ')}`);
    }
    check('chaque palette définit toutes les variables', incompletes.length === 0, incompletes.join(' | '));

    // Une couleur écrite en dur ailleurs échapperait aux palettes : elle
    // resterait claire au milieu d'un thème sombre.
    const enDur = [...style.matchAll(/:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)].map(([, valeur]) => valeur);
    check('aucune couleur en dur hors des palettes', enDur.length === 0, enDur.join(', '));
    check('des palettes claires et des sombres',
        /color-scheme: light/.test(themes) && /color-scheme: dark/.test(themes));
    check('le thème par défaut est posé sur la page', page.includes('data-theme="plateau"'));
    check('la palette mémorisée est restaurée avant le rendu',
        page.includes("getItem('sutom.settings')") && page.indexOf('<script>') < page.indexOf('</head>'));
    check('la barre du navigateur suit la palette', page.includes('id="couleur-barre"'));
    check('chaque palette a une couleur de barre', THEMES.every(theme => /^#[0-9a-f]{6}$/i.test(theme.couleur)));
    const sansPastille = THEMES.filter(theme => !themes.includes(`.theme-pill[data-theme="${theme.id}"]`));
    check('chaque palette a sa pastille', sansPastille.length === 0, sansPastille.map(t => t.id).join(', '));
}

console.log('\nla page et le manifeste');
check('le zoom tactile est neutralisé', page.includes('user-scalable=no'));
check('les encoches sont prises en compte', page.includes('viewport-fit=cover'));
check('page et manifeste partagent la couleur initiale',
    page.includes(`content="${manifeste.theme_color}"`));
check('le manifeste décrit le jeu', manifeste.name.includes('SUTOM') && manifeste.description.length > 40);
check('orientation déclarée', typeof manifeste.orientation === 'string' && manifeste.orientation.length > 0);
check('les icônes du manifeste existent',
    manifeste.icons.every(icone => existsSync(join(ROOT, icone.src))));
check('apple-touch-icon en PNG', page.includes('rel="apple-touch-icon" href="assets/icon-180.png"'));
check('les mouvements réduits sont respectés', style.includes('prefers-reduced-motion'));
check('les scripts npm attendus existent',
    ['test', 'check', 'serve'].every(nom => typeof paquet.scripts[nom] === 'string'));

report();
