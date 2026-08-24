// Le mot du jour : la dérivation date → mot et la série quotidienne.
//
// Ce qui compte ici, c'est la promesse : deux joueurs qui ouvrent le même jour
// cherchent le même mot sans que rien ne circule entre eux. Un test Node peut
// la vérifier entièrement, puisque le tirage ne dépend que de la date et d'une
// liste de mots committée.
//
// La partie jouée depuis `?jour=` est dans test-daily-game.mjs : ici on importe
// le stockage hors navigateur, ce qui le fige sur sa mémoire de secours — un
// démarrage jsdom dans le même processus n'y retrouverait plus ses petits.

import {
    today, isDay, readDay, hash, dayLength, dayIndex, dayLink, formatDay
} from '../js/daily.js';
import { MIN_LENGTH, MAX_LENGTH } from '../js/engine.js';
import { counter } from './harness.mjs';

const { check, report } = counter();
const JOUR = '2026-08-24';

console.log('\nla date');
check('format du jour', today(new Date(2026, 7, 24)) === JOUR, today(new Date(2026, 7, 24)));
check('mois et jour complétés', today(new Date(2026, 0, 5)) === '2026-01-05');
check('date locale, pas UTC', today(new Date(2026, 7, 24, 23, 30)) === JOUR);
check('jour valide accepté', isDay(JOUR));
check('année bissextile', isDay('2028-02-29'));
check('jour inexistant refusé', !isDay('2026-02-31'));
check('mois inexistant refusé', !isDay('2026-13-01'));
check('format libre refusé', !isDay('24/08/2026'));
check('valeur vide refusée', !isDay('') && !isDay(null));

console.log('\nle paramètre d’URL');
check('jour lu', readDay(`?jour=${JOUR}`) === JOUR);
check('jour parmi d’autres paramètres', readDay(`?a=1&jour=${JOUR}`) === JOUR);
check('sans paramètre', readDay('') === null);
check('paramètre étranger', readDay('?seed=abc') === null);
check('date impossible ignorée', readDay('?jour=2026-02-31') === null);

console.log('\nle tirage');
check('même jour, même longueur', dayLength(JOUR) === dayLength(JOUR));
check('même jour, même index', dayIndex(JOUR, 2000) === dayIndex(JOUR, 2000));
check('longueur dans les bornes', (() => {
    for (let i = 0; i < 400; i++) {
        const date = today(new Date(2026, 0, 1 + i));
        const length = dayLength(date);
        if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) return false;
    }
    return true;
})());
check('index dans les bornes', (() => {
    for (let i = 0; i < 400; i++) {
        const index = dayIndex(today(new Date(2026, 0, 1 + i)), 1731);
        if (!Number.isInteger(index) || index < 0 || index >= 1731) return false;
    }
    return true;
})());
// Une graine mal mélangée donnerait la même longueur des semaines durant, ou
// ferait avancer l'index d'un cran par jour : le mot du lendemain se devinerait.
check('les quatre longueurs sortent sur un an', (() => {
    const vues = new Set();
    for (let i = 0; i < 365; i++) vues.add(dayLength(today(new Date(2026, 0, 1 + i))));
    return vues.size === MAX_LENGTH - MIN_LENGTH + 1;
})());
check('deux jours voisins ne se suivent pas', (() => {
    let colles = 0;
    for (let i = 0; i < 200; i++) {
        const a = dayIndex(today(new Date(2026, 0, 1 + i)), 2000);
        const b = dayIndex(today(new Date(2026, 0, 2 + i)), 2000);
        if (Math.abs(a - b) <= 1) colles++;
    }
    return colles < 5;
})());
check('longueur et index décorrélés', dayLength(JOUR) !== dayIndex(JOUR, MAX_LENGTH + 1) + MIN_LENGTH
    || hash(`longueur:${JOUR}`) !== hash(`mot:${JOUR}`));
check('lien du jour', dayLink('https://x/sutom/', JOUR) === `https://x/sutom/?jour=${JOUR}`);
check('date en toutes lettres', formatDay(JOUR) === '24/08/2026');

console.log('\nla série quotidienne');
{
    // Le module de stockage retombe sur une mémoire volatile sous Node : la
    // série se teste donc sans navigateur, exactement comme le moteur.
    const { recordDaily, loadDaily, emptyDaily, dailyResult } = await import('../js/storage.js');

    check('série vide au départ', loadDaily().streak === 0 && loadDaily().bestStreak === 0);

    recordDaily('2026-08-20', { won: true, attempts: 3 }, true);
    check('première victoire du jour', loadDaily().streak === 1);
    recordDaily('2026-08-21', { won: true, attempts: 4 }, true);
    check('lendemain : la série s’allonge', loadDaily().streak === 2);

    recordDaily('2026-08-21', { won: false, attempts: 6 }, true);
    check('rejouer le même jour ne recompte pas', loadDaily().streak === 2);
    check('le premier verdict fait foi', dailyResult('2026-08-21').won === true);

    recordDaily('2026-08-23', { won: true, attempts: 2 }, true);
    check('un jour sauté repart à 1', loadDaily().streak === 1);
    check('meilleure série conservée', loadDaily().bestStreak === 2);

    recordDaily('2026-08-24', { won: false, attempts: 6 }, true);
    check('une défaite casse la série', loadDaily().streak === 0);
    check('la défaite est mémorisée', dailyResult('2026-08-24').won === false);

    recordDaily('2026-08-25', { won: true, attempts: 3 }, true);
    recordDaily('2026-08-26', { won: true, attempts: 3 }, true);
    check('la série repart', loadDaily().streak === 2);

    // Un vieux lien rouvert : la grille est rendue, la série ne bouge pas.
    recordDaily('2026-01-15', { won: true, attempts: 1 }, false);
    check('un défi hors du jour ne compte pas', loadDaily().streak === 2);
    check('mais son résultat est gardé', dailyResult('2026-01-15').attempts === 1);
    check('journée jamais jouée : rien', dailyResult('2019-01-01') === null);
    check('schéma de la structure vide', emptyDaily().schema === 1);
}

report();
