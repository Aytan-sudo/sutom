// La liste des palettes et leur ordre, rien d'autre : les couleurs elles-mêmes
// sont dans css/themes.css. Ce module sert à peupler les Options, à faire
// tourner le bouton d'en-tête et à teinter la barre du navigateur.
//
// `couleur` est le fond de la palette : c'est ce que reçoit `theme-color`,
// pour que la barre du téléphone se fonde dans la page.

export const THEMES = [
    { id: 'plateau', nom: 'Plateau', couleur: '#0d1117' },
    { id: 'papier', nom: 'Papier', couleur: '#f4ecdc' },
    { id: 'craie', nom: 'Craie', couleur: '#1b2420' },
    { id: 'neon', nom: 'Néon', couleur: '#16102b' },
    { id: 'ecume', nom: 'Écume', couleur: '#e8eef2' }
];

export const DEFAULT_THEME = THEMES[0].id;

export function isTheme(id) {
    return THEMES.some(theme => theme.id === id);
}

export function findTheme(id) {
    return THEMES.find(theme => theme.id === id) || THEMES[0];
}

export function nextTheme(id) {
    const index = THEMES.findIndex(theme => theme.id === id);
    return THEMES[(index + 1) % THEMES.length].id;
}
