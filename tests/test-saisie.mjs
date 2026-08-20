// Test d'integration dedie a la saisie : lettre offerte intouchable, cases
// laissees vides, et option « lettres modifiables ». Fichier a part parce que
// le harnais ne demarre qu'une partie par processus.

import { boot, inspector, counter, wait } from './harness.mjs';

const SOLUTION = 'ABATTU';
const GUESS = 'ADOPTE'; // A et T bien places : la ligne suivante garde des trous au milieu

const { check, report } = counter();
const window = await boot();
const { cellsOf, rowStates, rowText, message, storage, press, tap, click } = inspector(window);

// Les regles s'ouvrent a la premiere visite et retiennent les touches.
window.document.getElementById('help-dialog').close();

console.log('\nlettres acquises');
{
    for (const letter of GUESS.slice(1)) press(letter);
    press('Enter');
    await wait(1300);
    check('deux lettres bien placees',
        rowStates(0) === 'correct absent absent absent correct absent', rowStates(0));
    check('lettres reportees sur la ligne suivante', rowText(1) === 'AT', rowText(1));
}

console.log('\ncase laissee vide');
{
    press(' '); // la barre d'espace saute la case
    check('case marquee vide', cellsOf(1)[1].classList.contains('blank'));
    check('aucune lettre posee', rowText(1) === 'AT', rowText(1));

    press('U');
    check('la frappe reprend apres le trou', cellsOf(1)[2].textContent === 'U');

    press('Enter');
    await wait(50);
    check('essai refuse tant qu il reste un trou', message() === 'Mot incomplet', message());
    check('aucun essai consomme', storage('sutom.game').attempts.length === 1);

    press('Backspace'); // le U
    tap('BLANK');
    press('Backspace'); // un trou
    press('Backspace'); // l autre
    check('les trous s effacent', rowText(1) === 'AT' && !cellsOf(1)[1].classList.contains('blank'));
}

console.log('\noption lettres modifiables');
{
    const settingsDialog = window.document.getElementById('settings-dialog');
    const toggle = window.document.getElementById('option-free-input');
    const setOption = value => {
        click('settings-button');
        toggle.checked = value;
        toggle.dispatchEvent(new window.Event('change'));
        settingsDialog.close();
    };

    check('option fermee par defaut', toggle.checked === false);
    press('Backspace');
    check('lettre acquise protegee', rowText(1) === 'AT', rowText(1));

    setOption(true);
    check('option memorisee', storage('sutom.settings').freeInput === true);

    press('Backspace');
    check('lettre acquise effacable', rowText(1) === 'A', rowText(1));
    press('Backspace');
    press('Backspace');
    check('lettre offerte toujours verrouillee', rowText(1) === SOLUTION[0], rowText(1));

    press('Z');
    press('E');
    check('mot libre en cours de frappe', rowText(1) === 'AZE', rowText(1));

    // Retour au mode normal : la lettre acquise revient, la frappe reste.
    setOption(false);
    check('lettre acquise restauree', rowText(1) === 'AZET', rowText(1));
    press('Backspace');
    check('la lettre acquise ne s efface plus', rowText(1) === 'AZT', rowText(1));
}

report();
