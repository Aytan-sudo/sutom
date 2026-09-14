# SUTOM

Jeu de lettres français façon Motus : devinez le mot caché en six essais.
Site statique, sans build ni serveur, jouable hors ligne.

**Jouer : https://aytan-sudo.github.io/sutom/**

## Version 1.2.0 — Le passeport commun

- ouvert depuis le hub avec un passeport, le jeu range les statistiques, la
  série du mot du jour, les réglages et la partie en cours dans l'espace de
  l'enfant ; sans passeport (mode invité), rien ne change ;
- **dix mots acceptés par le dictionnaire dans la journée** donnent le tampon
  **Mots**, sur une ou plusieurs parties : les mots faux comptent, les mots
  incomplets ou refusés non. Le compteur est rangé dans le passeport et
  survit à un rechargement ;
- le bandeau du passeport, en haut de la page, ramène au hub et annonce le
  tampon ; l'adresse garde le profil quand une nouvelle partie commence, pour
  qu'un rechargement reste sur le même enfant ;
- les trois fichiers `commun/` viennent du hub (`npm run distribuer`) et sont
  précachés pour le hors-ligne. Le hub peut copier les anciennes données du
  mode invité vers un profil, sans les effacer.

## Version 1.1.1

- les cibles tactiles de l'interface passent à 44 px (boutons d'en-tête,
  boutons texte, listes déroulantes), conformément à la convention.
- les touches du clavier déclarent leur exemption (`data-cible-libre`) : dix
  touches par rangée font 440 px, plus que la largeur de l'écran.

## Version 1.1.0

- **mot du jour** : le même pour tout le monde, retrouvé par chaque navigateur
  à partir de la date, sans serveur ; série quotidienne et lien `?jour=` ;
- **cinq palettes** — Plateau, Papier, Craie, Néon, Écume — au lieu du seul
  thème sombre, mémorisées et restaurées avant le premier rendu ;
- **sons de synthèse et vibration**, en option : une note par case à la
  révélation, dont la hauteur dit la couleur ;
- toute l'interface et la documentation passent en français accentué ;
- le numéro de version s'affiche au bas des Options, le cache du service worker
  le porte, et un test vérifie que les trois concordent.

## Règles

- La longueur du mot change à chaque partie, entre 6 et 9 lettres.
- La première lettre est offerte et déjà inscrite dans la grille : on tape la suite.
- Chaque lettre bien placée reste affichée dans les essais suivants (règle Motus).
- Une option rend ces lettres effaçables : on sacrifie alors un essai pour
  proposer un tout autre mot et sonder des lettres encore inconnues. La lettre
  offerte reste en place dans tous les cas.
- La touche `Vide` (ou la barre d'espace) saute une case, de quoi écrire la fin
  d'un mot pour le voir en place. Un essai ne part que si la ligne est pleine.
- Rouge = bien placée, rond jaune = présente ailleurs, bleu = absente.
- Les accents ne comptent pas : on tape `ete` pour *été*.

## Le mot du jour

Le bouton **☀** ouvre le mot du jour : le même pour tout le monde, sans que
rien ne circule. Personne ne le distribue — la date donne une longueur et un
index, l'index désigne un mot dans une liste committée, identique chez chacun.
Deux navigateurs qui ouvrent le même jour cherchent donc le même mot.

Le réussir chaque jour allonge une série, visible dans les statistiques. Seul
le défi joué le jour même y compte : un lien `?jour=AAAA-MM-JJ` rouvert plus
tard redonne la grille, jamais la série. L'horloge de la machine fait foi, ce
qui laisse la possibilité de se tricher soi-même — sans intérêt.

## Palettes

Cinq ambiances, dont trois sombres et deux claires : **Plateau** (le bleu nuit
du studio télé, celle d'origine), **Papier** (crème et encre), **Craie** (le
tableau vert de l'école), **Néon** (violet d'arcade) et **Écume** (gris-bleu
froid). Le bouton **◐** les fait tourner, les Options donnent l'accès direct.

Le triptyque rouge/jaune/bleu est la langue du jeu : il survit dans chaque
palette, mais sa teinte se rabat sur les fonds clairs, où le rouge et le jaune
de la télévision éblouissent. Les couleurs vivent toutes dans `css/themes.css`,
et un test refuse toute couleur écrite en dur ailleurs.

Contrairement aux autres jeux de la collection, aucun raccourci clavier ne
change de palette : les 26 lettres appartiennent à la grille. Les boutons de
l'en-tête s'en chargent.

## Partager une partie

Le bouton **Partager** copie la grille en emojis accompagnée d'un lien de défi :
qui l'ouvre cherche exactement le même mot. C'est ce qui rend la grille
comparable — sans lien, chacun tirerait un mot au hasard et les emojis ne
signifieraient rien.

Le mot est encodé dans le fragment de l'URL (`#defi=...`), qui n'est jamais
transmis au serveur. Ce n'est pas du chiffrement, juste de quoi ne pas lire la
réponse dans la barre d'adresse.

Le mot du jour se partage autrement : son lien ne porte que la date
(`?jour=AAAA-MM-JJ`), puisqu'elle suffit à retrouver le mot. Dans les deux cas
le lien ne transporte jamais un résultat personnel.

```
SUTOM 24/08/2026
3/6 · 9 lettres

🟥🟦🟦🟡🟦🟦🟦🟦🟦
🟥🟦🟡🟦🟥🟦🟦🟡🟦
🟥🟥🟥🟥🟥🟥🟥🟥🟥

https://aytan-sudo.github.io/sutom/?jour=2026-08-24
```

## Développement

```sh
npm install     # jsdom, uniquement pour les tests
npm run serve   # http://localhost:8765
npm test
```

Le jeu utilise des modules ES et charge ses listes de mots en `fetch` : il faut
le servir en HTTP, l'ouvrir en `file://` ne fonctionne pas.

### Organisation

| Fichier | Rôle |
| --- | --- |
| `js/engine.js` | Les règles. Aucune dépendance au DOM ni au réseau, donc testable sous Node. |
| `js/dictionary.js` | Chargement des listes, tirage du mot, validation des saisies. |
| `js/storage.js` | Statistiques, options, partie en cours, mots déjà vus (localStorage). |
| `js/ui.js` | Rendu de la grille et du clavier. Ne connaît pas les règles. |
| `js/challenge.js` | Encodage du mot dans le lien de partage. |
| `js/daily.js` | Le mot du jour : date, tirage déterministe, lien. |
| `js/themes.js` | La liste des palettes et leur ordre, rien d'autre. |
| `js/sound.js` | Synthèse WebAudio, aucun fichier audio. |
| `js/config.js` | Version affichée et adresse publique du jeu. |
| `js/app.js` | Orchestration et événements. |
| `css/themes.css` | Les palettes, seule source des couleurs du jeu. |
| `data/` | Listes de mots générées, découpées par longueur. |
| `sw.js` | Service worker : mise en cache pour le hors-ligne. |

Le découpage tient à une idée : la logique de coloration (notamment le
traitement des lettres en double) est la seule partie réellement délicate du
jeu, elle est donc isolée dans `engine.js` où elle se teste sans navigateur.

## Dictionnaire

Les mots viennent de [Lexique 3.83](http://www.lexique.org), sous licence
CC BY-SA 4.0. Deux listes par longueur :

- `data/solutions-N.txt` : les mots à deviner. Noms, adjectifs et infinitifs au
  singulier, filtrés par fréquence d'usage (~2000 mots par longueur).
- `data/lexique-N.txt` : les mots acceptés à la saisie, toutes formes fléchies
  comprises (~15 000 mots par longueur).

Cette séparation évite les deux travers opposés : devoir deviner un mot que
personne ne connaît, et se voir refuser un mot parfaitement valable.

Les fichiers générés sont commités, le site n'a donc besoin d'aucun build. Pour
les régénérer (après avoir modifié un seuil ou `scripts/mots-exclus.txt`) :

```sh
mkdir -p .cache
curl -o .cache/Lexique383.tsv http://www.lexique.org/databases/Lexique383/Lexique383.tsv
npm run build:dict
npm test
```

`scripts/mots-exclus.txt` liste les mots qui ne seront jamais tirés comme
solution. Le corpus vient de sous-titres de films, où le vocabulaire vulgaire
est très fréquent : sans ce filtre il se retrouve parmi les mots courants. Ces
mots restent acceptés à la saisie.

## Déploiement

GitHub Pages sert la branche `main` à la racine. Un `git push` suffit, il n'y a
rien à construire.

## Tests

```sh
npm test
```

- `tests/test-engine.mjs` : règles de coloration, lettres en double, partie, reprise.
- `tests/test-data.mjs` : cohérence des fichiers de `data/`.
- `tests/test-ui.mjs` : partie complète jouée dans jsdom, du clavier au dialogue de fin.
- `tests/test-challenge.mjs` : encodage du lien de défi, et démarrage sur un lien reçu.
- `tests/test-challenge-fallback.mjs` : démarrage sur un lien de défi abîmé.
- `tests/test-daily.mjs` : dates, tirage déterministe et série quotidienne.
- `tests/test-daily-game.mjs` : une partie du jour jouée depuis `?jour=`.
- `tests/test-page.mjs` : les vérifications structurelles — coquille hors ligne
  complète, identifiants présents dans la page, palettes complètes, version
  concordante entre `package.json`, l'interface et le cache.

`npm run check` passe `node --check` sur chaque module : c'est la cinquième
vérification structurelle, celle que le reste de la suite ne couvre pas.

`tests/harness.mjs` monte index.html dans jsdom. Un seul démarrage par
processus : app.js lance sa partie à l'import, et un module n'est évalué qu'une
fois — d'où un fichier de test par scénario de démarrage.
