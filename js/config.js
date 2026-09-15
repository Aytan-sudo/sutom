// Ce qui identifie cette publication, en un seul endroit.
//
// La version vit à trois endroits qui doivent concorder : package.json, cette
// constante — affichée au bas des Options — et le nom du cache dans sw.js. Un
// test les compare. La ligne affichée est lue depuis le code réellement
// chargé : si le service worker sert encore un vieux cache, c'est le vieux
// numéro qui s'affiche, et la mise à jour manquante se voit d'un coup d'œil.

export const VERSION = '1.3.4';

// L'adresse publique, celle que portent les liens partagés. En dur plutôt que
// déduite de location : un lien copié depuis un serveur local doit rester
// jouable chez celui qui le reçoit.
export const GAME_URL = 'https://aytan-sudo.github.io/sutom/';
