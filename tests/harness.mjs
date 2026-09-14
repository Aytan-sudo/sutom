// Harnais commun aux tests d'intégration : monte index.html dans jsdom, expose
// les globales du navigateur et importe l'application.
//
// Un seul démarrage par processus : app.js lance sa partie au moment de
// l'import, et un module n'est évalué qu'une fois. Chaque scénario de
// démarrage a donc son propre fichier de test.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Ce que le bouton Partager a déposé dans le presse-papier.
export const clipboard = { text: null };

export function counter() {
    const state = { pass: 0, fail: 0 };
    const check = (label, condition, detail = '') => {
        if (condition) { state.pass++; console.log(`  OK    ${label}`); }
        else { state.fail++; console.log(`  ÉCHEC ${label} ${detail}`); }
    };
    const report = () => {
        console.log(`\n${state.pass} réussis, ${state.fail} échecs\n`);
        process.exit(state.fail === 0 ? 0 : 1);
    };
    return { check, report };
}

// `random` est figé par défaut : la partie tombe toujours sur 6 lettres et sur
// le premier mot de solutions-6.txt, donc les tests connaissent la réponse.
//
// `avant` s'exécute juste avant l'import du jeu, comme les scripts classiques
// de la page : c'est là que le passeport commun se charge.
export async function boot({ url = 'https://example.test/', random = () => 0, avant = null } = {}) {
    const dom = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8'), {
        url,
        pretendToBeVisual: true
    });
    const { window } = dom;

    // jsdom 26 connaît l'élément <dialog> et sa propriété open, mais pas encore
    // showModal()/close(). On les simule sur l'attribut, ce qui suffit : le jeu
    // ne se sert du modal que pour savoir si un dialogue est ouvert.
    for (const dialog of window.document.querySelectorAll('dialog')) {
        dialog.showModal = function () { this.setAttribute('open', ''); };
        dialog.close = function () {
            this.removeAttribute('open');
            this.dispatchEvent(new window.Event('close'));
        };
    }

    // Les modules du jeu tapent dans les globales du navigateur : on les expose
    // avant l'import, sinon app.js s'exécute dans le vide.
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.localStorage = window.localStorage;
    globalThis.history = window.history;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.fetch = async path => ({
        ok: true,
        status: 200,
        text: async () => readFileSync(join(ROOT, String(path)), 'utf8')
    });

    // Node fournit son propre `navigator`, sans presse-papier ni partage : on le
    // remplace pour pouvoir lire ce que le bouton Partager produit. Pas de
    // serviceWorker non plus, donc l'enregistrement du worker est ignoré.
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            clipboard: { writeText: async text => { clipboard.text = text; } }
        }
    });

    Math.random = random;
    if (avant) await avant(window);

    await import('../js/app.js');
    await wait(60); // laisse le chargement du dictionnaire se terminer
    return window;
}

// Raccourcis de lecture de la grille, partagés par les scénarios.
export function inspector(window) {
    const cellsOf = row => [...window.document.querySelectorAll('.row')[row].children];
    const stateOf = cell => ['correct', 'present', 'absent']
        .find(name => cell.classList.contains(name)) || 'vide';

    return {
        cellsOf,
        rowStates: row => cellsOf(row).map(stateOf).join(' '),
        rowText: row => cellsOf(row).map(cell => cell.textContent).join(''),
        message: () => window.document.getElementById('message').textContent,
        storage: key => JSON.parse(window.localStorage.getItem(key)),
        press: key => window.document.dispatchEvent(new window.KeyboardEvent('keydown', {
            key, bubbles: true, cancelable: true
        })),
        tap: key => window.document.querySelector(`.key[data-key="${key}"]`)
            .dispatchEvent(new window.MouseEvent('click', { bubbles: true })),
        click: id => window.document.getElementById(id)
            .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    };
}
