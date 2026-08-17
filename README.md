# SUTOM

Jeu de lettres francais facon Motus : devinez le mot cache en six essais.
Site statique, sans build ni serveur, jouable hors ligne.

**Jouer : https://aytan-sudo.github.io/sutom/**

## Regles

- La longueur du mot change a chaque partie, entre 6 et 9 lettres.
- La premiere lettre est offerte et deja inscrite dans la grille : on tape la suite.
- Chaque lettre bien placee reste affichee dans les essais suivants (regle Motus).
- Rouge = bien placee, rond jaune = presente ailleurs, bleu = absente.
- Les accents ne comptent pas : on tape `ete` pour *été*.

## Developpement

```sh
npm install     # jsdom, uniquement pour les tests
npm run serve   # http://localhost:8765
npm test
```

Le jeu utilise des modules ES et charge ses listes de mots en `fetch` : il faut
le servir en HTTP, l'ouvrir en `file://` ne fonctionne pas.

### Organisation

| Fichier | Role |
| --- | --- |
| `js/engine.js` | Les regles. Aucune dependance au DOM ni au reseau, donc testable sous Node. |
| `js/dictionary.js` | Chargement des listes, tirage du mot, validation des saisies. |
| `js/storage.js` | Statistiques, partie en cours, mots deja vus (localStorage). |
| `js/ui.js` | Rendu de la grille et du clavier. Ne connait pas les regles. |
| `js/app.js` | Orchestration et evenements. |
| `data/` | Listes de mots generees, decoupees par longueur. |
| `sw.js` | Service worker : mise en cache pour le hors-ligne. |

Le decoupage tient a une idee : la logique de coloration (notamment le
traitement des lettres en double) est la seule partie reellement delicate du
jeu, elle est donc isolee dans `engine.js` ou elle se teste sans navigateur.

## Dictionnaire

Les mots viennent de [Lexique 3.83](http://www.lexique.org), sous licence
CC BY-SA 4.0. Deux listes par longueur :

- `data/solutions-N.txt` : les mots a deviner. Noms, adjectifs et infinitifs au
  singulier, filtres par frequence d'usage (~2000 mots par longueur).
- `data/lexique-N.txt` : les mots acceptes a la saisie, toutes formes flechies
  comprises (~15 000 mots par longueur).

Cette separation evite les deux travers opposes : devoir deviner un mot que
personne ne connait, et se voir refuser un mot parfaitement valable.

Les fichiers generes sont commites, le site n'a donc besoin d'aucun build. Pour
les regenerer (apres avoir modifie un seuil ou `scripts/mots-exclus.txt`) :

```sh
mkdir -p .cache
curl -o .cache/Lexique383.tsv http://www.lexique.org/databases/Lexique383/Lexique383.tsv
npm run build:dict
npm test
```

`scripts/mots-exclus.txt` liste les mots qui ne seront jamais tires comme
solution. Le corpus vient de sous-titres de films, ou le vocabulaire vulgaire
est tres frequent : sans ce filtre il se retrouve parmi les mots courants. Ces
mots restent acceptes a la saisie.

## Deploiement

GitHub Pages sert la branche `main` a la racine. Un `git push` suffit, il n'y a
rien a construire.

## Tests

```sh
npm test
```

- `tests/test-engine.mjs` : regles de coloration, lettres en double, partie, reprise.
- `tests/test-data.mjs` : coherence des fichiers de `data/`.
- `tests/test-ui.mjs` : partie complete jouee dans jsdom, du clavier au dialogue de fin.
