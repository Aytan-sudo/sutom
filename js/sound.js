// Synthèse WebAudio : aucun fichier audio, quelques oscillateurs et c'est tout.
//
// Le timbre central est celui de la révélation : une note par case pendant que
// la ligne se retourne, et la hauteur dit la couleur — grave pour une lettre
// absente, médium pour une lettre mal placée, aiguë pour une lettre bien
// placée. On entend son essai avant de l'avoir lu.
//
// Le contexte audio ne se crée qu'à la première note, donc après un geste du
// joueur : les navigateurs refusent de démarrer le son autrement. Un onglet
// passé à l'arrière-plan suspend tout — un jeu ne doit pas chanter dans le dos
// de quelqu'un qui est parti lire ailleurs.

import { CORRECT, PRESENT, ABSENT } from './engine.js';

let context;

function audio() {
    if (context) return context;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) context = new AudioContext();
    return context;
}

// Une note : attaque très courte, extinction exponentielle. Le volume reste bas
// par principe — le son accompagne, il ne commente pas.
function note(frequency, duration = 0.07, volume = 0.035, delay = 0, shape = 'sine') {
    const engine = audio();
    if (!engine) return;
    if (engine.state === 'suspended') engine.resume?.();

    const start = engine.currentTime + delay;
    const oscillator = engine.createOscillator();
    const gain = engine.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(engine.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
}

// Le clic de la frappe : très bref et mat, pour qu'un mot de neuf lettres ne
// tourne pas à la mitraillette.
export const soundType = () => note(180, 0.025, 0.018, 0, 'triangle');

// La révélation, timbre signature. `step` est la cadence de l'animation, pour
// que chaque note tombe avec sa case.
const PITCH = { [ABSENT]: 196, [PRESENT]: 330, [CORRECT]: 494 };

export function soundReveal(marks, step = 0.16) {
    marks.forEach((mark, index) => note(PITCH[mark], 0.09, 0.03, index * step));
}

// Le mot refusé : deux notes graves, la secousse de la ligne mise en son.
export function soundReject() {
    note(150, 0.08, 0.03);
    note(120, 0.09, 0.03, 0.09);
}

export function soundWin() {
    [440, 554, 659, 880].forEach((frequency, index) => note(frequency, 0.18, 0.035, index * 0.08));
}

// La défaite : deux notes descendantes, sans insister.
export function soundLose() {
    note(294, 0.22, 0.03);
    note(220, 0.3, 0.03, 0.2);
}

// L'onglet passe à l'arrière-plan : on se tait. Au retour, le contexte reprend
// tout seul à la note suivante.
export function watchVisibility(document) {
    document.addEventListener('visibilitychange', () => {
        if (!context) return;
        if (document.hidden) context.suspend?.();
        else context.resume?.();
    });
}
