# Revue de l'éditeur PromptoDYS (React)

> Passe de revue complète du dépôt `promptoDYS_editor`, à la recherche de problèmes et d'améliorations possibles. Complément de la revue de l'application Python (`PromptoDYS_app/doc/REVUE_PROJET.md`).
>
> Date : 12/10/2026. Commit revu : `0b91ed3f`. Périmètre : sources `src/`, configuration de build, dépendances, bundle produit, pont Eel. Les chemins de fichiers sont relatifs à la racine du dépôt.
>
> **Aucune modification de code n'a été faite.** Ce document est un constat et un plan ; chaque correction attend un GO.

---

## Sommaire

1. [Résumé en une page](#1-résumé-en-une-page)
2. [Méthode](#2-méthode)
3. [Constats critiques : perte de données et sécurité](#3-constats-critiques--perte-de-données-et-sécurité)
4. [Constats importants : performance et robustesse](#4-constats-importants--performance-et-robustesse)
5. [Constats importants : rendu et apparence](#5-constats-importants--rendu-et-apparence)
6. [Constats mineurs : qualité du code](#6-constats-mineurs--qualité-du-code)
7. [Dépendances, build et dépôt](#7-dépendances-build-et-dépôt)
8. [Accessibilité](#8-accessibilité)
9. [Ce qui est bien fait](#9-ce-qui-est-bien-fait)
10. [Trois stratégies de remédiation](#10-trois-stratégies-de-remédiation)
11. [Plan d'action proposé](#11-plan-daction-proposé)
12. [Tableau récapitulatif](#12-tableau-récapitulatif)

---

## 1. Résumé en une page

L'éditeur fait ce qu'on lui demande : une zone d'écriture confortable pour un élève DYS, avec images, formules, lecture vocale et thème. Le pont avec Python fonctionne. Mais la pièce centrale, **le convertisseur HTML ↔ Markdown écrit à base d'expressions régulières**, a des trous que la revue a pu reproduire, et deux d'entre eux font perdre du texte à l'élève sans aucun message.

Les cinq priorités, dans l'ordre :

1. **Le texte contenant `<` et `>` est tronqué.** La phrase « Si x<5 et y>3 alors ok » ressort en « Si x3 alors ok » après un passage par Python (traitement IA ou sauvegarde). Reproduit par test. Pour des notes de maths, c'est fréquent.
2. **Les astérisques des calculs deviennent de l'italique**, et les listes à puces écrites avec `*` perdent leurs puces. « 3\*4 + 5\*6 » devient « 3*4 + 5*6 » en italique. Reproduit par test. Le prompt interdit l'italique à Gemini, mais l'éditeur en fabrique tout seul.
3. **Les images sont rechargées depuis IndexedDB à chaque frappe.** Un effet se déclenche sur chaque changement de contenu, relit chaque image, crée une nouvelle URL blob et réassigne `img.src`. Sur un document avec trois photos, chaque lettre tapée coûte trois lectures de base et trois URL jamais libérées.
4. **La feuille Tailwind est maintenue à la main et il manque une douzaine de classes utilisées** dans le JSX : fond sombre des modales, largeur des modales, bordure orange, états désactivés et survol. L'interface ne ressemble pas à ce que le code décrit.
5. **La police Lexend, mise en avant dans le README, ne fonctionne pas** sur une machine où elle n'est pas installée : les fichiers TTF sont livrés deux fois mais jamais référencés par le CSS.

Deux points de sécurité modérés complètent le tableau : un attribut `onclick` dans un `<span>` coloré passe tel quel dans le DOM (reproduit), et l'outillage de build repose sur `react-scripts`, abandonné, avec 102 vulnérabilités signalées.

---

## 2. Méthode

| Vérification | Outil | Résultat |
|---|---|---|
| Lecture intégrale des 16 fichiers de `src/` (6 970 lignes), du `package.json`, de `index.html`, des docs | Lecture manuelle | Base des constats |
| Analyse statique | `eslint` avec la config `react-app` | 37 avertissements, dont une clé dupliquée, 12 dépendances de hooks manquantes, 15 variables inutilisées |
| Tests empiriques du convertisseur | Script Node + jsdom sur `markdownConverter.js` et une copie de `cleanIsolatedAsterisks` | E1, E2, E3, E8 et E17 reproduits (sortie brute en annexe de chaque constat) |
| Audit des dépendances | `npm audit --omit=dev`, `npm outdated` | 102 vulnérabilités (3 critiques, 79 hautes), toutes dans la chaîne `react-scripts` sauf `js-yaml` |
| Classes Tailwind utilisées vs définies | `grep` croisé JSX / `tailwind-compiled.css` | 12 classes utilisées absentes du CSS |
| Polices MathJax dans le bundle | `find build -iname "*.woff*"`, lecture de `getRoot()` dans le chunk | Aucune police livrée ; racine résolue sur `static/js/` |
| Volume de logs | `grep -c console.` | 352 appels, dont 253 dans `Editor.js` et `Toolbar.js` |

---

## 3. Constats critiques : perte de données et sécurité

### E1. Le texte contenant `<` ou `>` est tronqué par `htmlToMarkdown`

**Où.** [markdownConverter.js:103-107](../src/utils/markdownConverter.js#L103-L107) décode les entités HTML (`&lt;` → `<`) **avant** que [la ligne 242](../src/utils/markdownConverter.js#L242) ne supprime « toutes les autres balises » avec `<[^>]+>`. Un `<` tapé par l'élève, suivi plus loin d'un `>`, est alors pris pour une balise.

**Reproduction.**

```
Entrée HTML : <div>Si x&lt;5 et y&gt;3 alors ok</div>
Sortie MD   : "Si x3 alors ok"
```

**Quand ça arrive.** À chaque fois que Python lit l'éditeur : traitement IA (`readMarkdown`) et sauvegarde (`readDocumentData`). Aussi au passage en vue Markdown. Les notes de maths et de sciences (`x<5`, `a>b`, `pH<7`) sont les premières touchées. La note originale, que le prompt demande à Gemini de recopier, est déjà abîmée avant d'arriver à Gemini.

**Piste.** Ne décoder les entités qu'à la toute fin, après la suppression des balises. Ou, mieux, remplacer la chaîne de regex par un parcours du DOM (voir E17).

**Effort.** Faible pour le correctif ponctuel. Un test de non-régression est indispensable.

### E2. Les astérisques des calculs sont convertis en italique

**Où.** Deux endroits, dans les deux sens :
- [markdownConverter.js:315](../src/utils/markdownConverter.js#L315) : `\*([^*]+)\*` → `<em>`.
- [useEelBridge.js:27](../src/hooks/useEelBridge.js#L27) : `cleanIsolatedAsterisks` « préserve » comme italique tout ce qui est entre deux `*`, puis supprime les autres.

**Reproduction.**

```
MD "Calcul : 3*4 + 5*6 = 42"  → HTML "<div>Calcul : 3<em>4 + 5</em>6 = 42</div>"
MD "Formule $a*b*c$ ici"      → HTML "<div>Formule $a<em>b</em>c$ ici</div>"
```

Dans le second cas, MathJax reçoit `$a<em>b</em>c$` et ne rend plus la formule. Le contenu entre `$...$` devrait être intouchable, comme le sont déjà les `<span>` colorés.

**Piste.** Protéger les segments `$...$` et `$$...$$` par des marqueurs avant toute conversion, comme c'est fait pour les spans. Exiger qu'un `*` d'italique soit collé au mot (`\*(\S[^*]*?\S)\*`) réduit déjà les faux positifs.

### E3. Les listes à puces écrites avec `*` perdent leurs puces

**Où.** [markdownToHtml](../src/utils/markdownConverter.js#L320) ne reconnaît que `- `. Le nettoyage de [useEelBridge.js:34](../src/hooks/useEelBridge.js#L34) supprime ensuite tous les `*` restants.

**Reproduction.**

```
clean "* pomme\n* poire"       → "pomme\n poire"
MD    "* pomme\n* poire" → HTML "<div><em> pomme<br></em> poire</div>"
```

Gemini produit couramment des listes avec `*`. Le résultat est soit une liste sans puces, soit du texte en italique.

**Piste.** Accepter `^(\s*)[-*+]\s+` dans `markdownToHtml`, et ne pas supprimer un `*` en début de ligne dans `cleanIsolatedAsterisks`.

### E8. Un attribut de script dans un `<span>` coloré passe tel quel dans le DOM

**Où.** [markdownConverter.js:266](../src/utils/markdownConverter.js#L266) préserve verbatim tout `<span ... style="...color:..." ...>`. L'expression `[^>]*` laisse passer n'importe quel autre attribut.

**Reproduction.**

```
MD   : ### <span style="color: #3399ff;" onclick="alert(1)">Titre</span>
HTML : <h3><span style="color: #3399ff;" onclick="alert(1)">Titre</span></h3>
```

Ce HTML est injecté par `innerHTML` dans l'éditeur. La source est la réponse de Gemini ou un fichier `.md` ouvert. Le risque est local (application de bureau, pas de serveur), mais la fenêtre Chrome est lancée avec `--disable-web-security` côté Python, et le pont Eel expose des fonctions Python. Un `.md` partagé entre élèves suffirait à exécuter du code.

**Piste.** Ne conserver du span que la couleur : reconstruire `<span style="color: #rrggbb">` à partir d'une extraction stricte, et jeter le reste. Ou passer le HTML final par DOMPurify (bibliothèque de 20 Ko) avec une liste blanche d'attributs.

---

## 4. Constats importants : performance et robustesse

### E4. Les images sont rechargées depuis IndexedDB à chaque frappe

**Où.** [Editor.js:633-647](../src/components/Editor.js#L633-L647). L'effet se déclenche dès que `content` change, c'est-à-dire à chaque caractère tapé. Il appelle `rehydrateImages` puis `migrateOldBlobImages` : pour chaque image, une lecture IndexedDB, un `URL.createObjectURL` jamais révoqué, et un `img.src = ...` qui force le navigateur à recharger l'image.

**Effets.** Lag proportionnel au nombre d'images, fuite mémoire (une URL blob par image par frappe), clignotement possible. Ce code était prévu pour « nouveau document chargé », pas pour la saisie.

**Piste.** Ne réhydrater que quand une image porte un `src` cassé (pas de `blob:` valide), ou quand le changement de contenu vient de l'extérieur (le signal `externalUpdateTrigger` existe déjà dans les props, il n'est pas utilisé pour ça). Révoquer l'ancienne URL avant d'en créer une nouvelle.

### E5. Chaque frappe déclenche trois fois le même traitement lourd

**Où.** [Editor.js:1570-1581](../src/components/Editor.js#L1570-L1581) : `handleWysiwygChange` est branché sur `onInput`, `onKeyUp` et `onPaste`. Il passe cinq expressions régulières sur la totalité de `innerHTML` et déclenche `onSelectionChange` avec un délai. En parallèle, deux écouteurs `selectionchange` distincts (dans `useEditor.js` et `Editor.js`) appellent tous deux `updateCurrentFormat`, qui remonte le DOM avec `getComputedStyle`.

Sur une note longue avec des formules rendues (le markup MathJax est volumineux), chaque frappe coûte plusieurs passes sur plusieurs dizaines de kilo-octets.

**Piste.** Garder uniquement `onInput`. Un seul écouteur `selectionchange`. Débouncer `updateCurrentFormat` à 50 ms.

### E6. La sauvegarde localStorage peut planter l'application sans message

**Où.** [App.js:72](../src/App.js#L72) : `localStorage.setItem` à chaque changement de contenu, sans `try/catch`, dans un `useEffect`. Le contenu sauvegardé est le HTML complet de l'éditeur, **y compris le markup MathJax rendu** (voir E33), ce qui le fait grossir vite.

**Effet.** Au-delà du quota (5 Mo selon le navigateur), `setItem` lève `QuotaExceededError`. Une exception dans un effet React, sans *error boundary*, démonte l'arbre entier : écran blanc, travail en cours perdu. C'est précisément le scénario que la sauvegarde voulait éviter.

**Piste.** `try/catch` autour du `setItem` avec un message dans la barre d'état. Sauvegarder le Markdown plutôt que le HTML (dix fois plus compact, sans markup MathJax). Débouncer à 500 ms. Ajouter un *error boundary* racine qui affiche « Une erreur est survenue, votre texte est conservé ».

### E7. IndexedDB n'est jamais nettoyée

**Où.** [imageStore.js:145-176](../src/utils/imageStore.js#L145-L176) : `cleanupOrphanedImages` retourne toujours 0, avec le commentaire « idb-keyval ne fournit pas de méthode keys() ». C'est inexact : `idb-keyval` 6 exporte `keys()`, `entries()` et `clear()`.

**Effet.** Chaque capture d'écran collée, chaque image insérée puis supprimée, chaque document ouvert via Python reste dans IndexedDB pour toujours. Le profil Chrome de l'élève grossit sans limite.

**Piste.** Implémenter le nettoyage avec `keys()` : tout identifiant absent du document courant est supprimé au moment de la sauvegarde ou de l'ouverture d'un nouveau document.

### E19. Le pont Eel redéfinit et ré-expose ses quatre fonctions à chaque frappe

**Où.** [useEelBridge.js:71-388](../src/hooks/useEelBridge.js#L71-L388) : l'effet dépend de `content`, donc il tourne à chaque modification. Il recrée quatre fonctions et rappelle `window.eel.expose` quatre fois.

Ce n'est pas un bug fonctionnel, mais c'est du travail inutile et une source de confusion. Le pattern standard est de stocker `content` et `viewMode` dans des `useRef` mis à jour par un effet léger, et d'exposer les fonctions une seule fois au montage.

### E18. La sauvegarde via Python ré-encode toutes les images en PNG

**Où.** [useEelBridge.js:187-197](../src/hooks/useEelBridge.js#L187-L197) : `readDocumentData` lit les pixels via un `canvas` et `toDataURL('image/png')`, type et extension codés en dur.

**Effet.** Une photo JPEG de 200 Ko prise au téléphone devient un PNG de plusieurs Mo sur le disque. L'extension change (`photo.jpg` → `photo_..._0.png`). Le résultat n'est donc **pas** « strictement identique » à la sauvegarde côté navigateur, contrairement à ce que dit `SPEC_EDITEUR_ET_BRIDGE_PYTHON.md`. Le canvas perd aussi les métadonnées et la transparence éventuelle est préservée, mais pas le profil couleur.

**Piste.** La contrainte est que `readDocumentData` doit être synchrone. La solution propre est un cache mémoire `Map(imageId → { base64, mimeType })` rempli de façon asynchrone au moment où l'image entre dans l'éditeur (insertion, collage, ouverture). `readDocumentData` le lit instantanément, et ne tombe sur le canvas qu'en dernier recours.

### E12. La touche Échap de la modale de sauvegarde ne fait rien

**Où.** [Toolbar.js:1941-1948](../src/components/Toolbar.js#L1941-L1948) : `onKeyPress` est déprécié et **ne se déclenche jamais pour Échap**. La branche `e.key === 'Escape'` est du code mort. Remplacer par `onKeyDown`.

---

## 5. Constats importants : rendu et apparence

### E9. Douze classes Tailwind utilisées dans le JSX n'existent pas dans le CSS

**Où.** [tailwind-compiled.css](../src/tailwind-compiled.css) est un sous-ensemble écrit à la main (11 Ko), sans `tailwind.config.js` ni génération automatique. Classes utilisées et absentes :

| Classe | Usages | Effet visible de son absence |
|---|---|---|
| `bg-black` + `bg-opacity-50` | 4 modales | Le voile sombre derrière les modales n'existe pas |
| `z-[100]` | 4 modales | Les modales n'ont pas de z-index propre |
| `w-64`, `w-80` | 4 modales | Les modales n'ont pas de largeur fixée |
| `border-orange-400` | 2 modales | La bordure « orange » est de la couleur du texte |
| `hover:bg-gray-50` | 11 boutons | Aucun retour visuel au survol |
| `disabled:opacity-50` | 2 boutons | Les boutons désactivés ont l'air actifs |
| `focus:ring-2` | 11 éléments | Pas d'anneau de focus clavier (accessibilité) |
| `justify-end` | 1 | Boutons de la modale alignés à gauche |

**Piste.** Deux choix cohérents, pas d'entre-deux :
- Installer `tailwindcss` (PostCSS et Autoprefixer sont déjà dans les devDependencies) avec un `tailwind.config.js` qui scanne `src/`, et supprimer le fichier manuel.
- Ou abandonner Tailwind et écrire 200 lignes de CSS classique pour les modales et boutons, ce qui est plus simple pour un projet maintenu par une personne.

### E10. La police Lexend ne se charge pas depuis les fichiers livrés

**Où.** [index.css:21-44](../src/index.css#L21-L44) : les trois `@font-face` Lexend utilisent uniquement `src: local(...)`. Les fichiers `Lexend-*.ttf` existent dans `src/assets/fonts/` **et** dans `public/fonts/` (310 Ko à chaque fois), mais aucun CSS ne les référence.

**Effet.** Choisir « Lexend » dans le thème ne fonctionne que si la police est installée sur l'ordinateur. Sur un poste d'élève standard, elle retombe silencieusement sur Arial. OpenDyslexic, elle, est correctement câblée via `url('./assets/fonts/...')`.

**Piste.** Ajouter `url('./assets/fonts/Lexend-Regular.ttf') format('truetype')` après le `local()`. Supprimer `public/fonts/` qui n'est référencé nulle part (et qui est copié dans l'exe Python pour rien).

### E11. Les polices MathJax ne sont pas livrées : rendu des formules probablement dégradé

**Où.** `useMathJax.js` importe `mathjax/es5/tex-mml-chtml.js`. Le mode CHTML a besoin de polices `woff` que MathJax cherche à `<racine>/output/chtml/fonts/woff-v2/`. La racine est déduite de l'emplacement du script courant ([`getRoot()` dans le chunk](../build/static/js/)), donc `static/js/`. Aucun fichier `.woff` n'est dans `build/`.

**Effet attendu.** Des erreurs 404 silencieuses dans l'onglet Réseau, et des formules affichées avec la police de secours du navigateur : lisibles, mais espacements et symboles approximatifs. **À confirmer visuellement** avec l'onglet Réseau de Chrome sur une note contenant une formule.

**Piste.** La plus simple : passer à `tex-mml-svg.js`, qui n'a besoin d'aucune police (les glyphes sont dessinés en SVG). L'enrichissement `data-tex` continue de fonctionner. Sinon, copier le dossier `woff-v2` dans `public/mathjax/` et fixer `chtml.fontURL` dans `index.html`.

### E17. Le convertisseur Markdown ignore plusieurs syntaxes que Gemini produit

Testé sur la fonction réelle :

| Syntaxe | Résultat actuel |
|---|---|
| `---` (séparateur, imposé par le prompt) | Affiché en texte brut `<div>---</div>`, pas de `<hr>` |
| `[texte](url)` (lien) | Affiché en texte brut avec les crochets |
| `* item` (puce) | Voir E3 |
| Listes imbriquées | Aplaties |
| Blocs de code ` ``` ` | Non reconnus |
| `<h2>` sur plusieurs lignes | La regex sans drapeau `s` ne matche pas |
| Alt d'image contenant un `"` | Casse l'attribut `alt="..."` |

Le séparateur `---` mérite une décision : soit on le rend en `<hr>` dans l'éditeur, soit on l'enlève du prompt. Aujourd'hui l'élève voit trois tirets.

L'aller-retour sur le cas nominal du prompt (titre coloré `### <span>...</span>`) est, lui, correct.

---

## 6. Constats mineurs : qualité du code

### E13. Deux composants de 1 854 et 2 089 lignes

`Editor.js` et `Toolbar.js` portent chacun cinq ou six responsabilités. Ce n'est pas un bug, mais c'est ce qui a permis à E4, E5 et aux doublons de passer inaperçus. Le découpage suit déjà les commentaires de section des fichiers :

| Module proposé | Contenu actuel | Lignes |
|---|---|---|
| `hooks/useTtsHighlight.js` | Calcul de la position du mot lu, surlignage, traînée | Editor 36 à 328 |
| `hooks/useImagePersistence.js` | `rehydrateImages`, `migrateOldBlobImages`, `processImageBlobs`, `forceVerify` | Editor 330 à 647 |
| `hooks/useImageResize.js` | Poignées de redimensionnement, MutationObserver | Editor 1238 à 1419 |
| `hooks/useEditorClipboard.js` | `handleCopy`, `handlePaste`, isolation des images collées | Editor 831 à 1098 |
| `utils/oneNoteExport.js` | `extractPlainTextWithLineBreaks`, `formatHtmlForOneNote`, `handleExportToOneNote` | Toolbar 153 à 451 |
| `utils/htmlImport.js` | `parseMHTMLContent`, `parseHTMLContent`, `cleanImportedHTML` | Toolbar 223 à 385 |
| `utils/documentFiles.js` | `performSave`, `handleOpenDocument`, `extractAndSaveImages`, `loadLocalImages` (File System Access) | Toolbar 487 à 881 |
| `components/modals/` | Les quatre modales, qui sont du JSX quasi identique | Toolbar 1924 à 2084 |
| `components/Toolbar.js` | Uniquement les boutons et leur état | reste |

### E14. 352 appels `console.log`, dont le document entier imprimé quatre fois par conversion

[markdownConverter.js](../src/utils/markdownConverter.js) lignes 22, 32, 45 et 47 impriment le HTML complet avant et après normalisation, à chaque appel. `Editor.js` logue chaque frappe, chaque mouvement de curseur, chaque focus. Les logs sont utiles (règle 11 du projet), mais ils doivent être conditionnés.

**Piste.** Le mécanisme existe déjà : `configManager.get('developer_mode')`. Un utilitaire `debug(...)` de cinq lignes qui ne fait rien quand le mode développeur est désactivé, et un remplacement global de `console.log(` par `debug(`. Les `console.warn` et `console.error` restent inconditionnels.

### E15. Code mort, doublons et vestiges

- `promptoDysManager.js` : `getCurrentProject()` retourne toujours `null`, donc `convertAllPromptoDysUrlsToBlobs` ne s'exécute jamais. Fichier entier à supprimer, avec son import dans `Editor.js`.
- `Toolbar.js` : `processImageBlobs` (doublon de celui d'`Editor.js`, inutilisé), `handleLoadMarkdown`, `handleCopyMarkdown`, `showColorPicker`, `showBackgroundPicker` inutilisés. `handleNewDocument` (qui vérifie si le document est vide) n'est pas branché : le bouton « Nouveau » ouvre toujours la modale de confirmation, même sur un document vide.
- `Editor.js` : `isInitializedRef` inutilisé, `debugPaste` (écouteur de débogage laissé en production, ligne 1188), `createUniqueBlob` dupliqué avec `Toolbar.js`, `forwardRef` dont le `ref` est ignoré au profit de la prop `editorRef`, prop `onDeleteSelectedImage={null}` jamais lue.
- Suppression d'image gérée deux fois pour la touche Suppr : un écouteur natif (`handleKeyDown`, ligne 1101) **et** le `onKeyDown` JSX (ligne 1601). Le second trouve un élément déjà retiré, puis déclenche un second événement `input`.
- `App.js` : `isWysiwyg`, `setSelectedImage` inutilisés.
- `imageStore.js` : `listAllImages` et `cleanupOrphanedImages` sont des coquilles vides (voir E7).
- Deux systèmes d'images coexistent : `blobStorageRef` (Map en mémoire, commenté « ancien système ») et IndexedDB. `validateImagesBeforeSave` ne regarde que l'ancien.
- `useThemeSettings.js:10` : clé `fontSize` dupliquée dans `defaultSettings`.
- `useEditor.js:52` : l'initialiseur de `viewMode` programme la suppression de `editor-refresh-backup` après 1 s, mais `App.js` la recrée à chaque changement. Suppression sans effet, à retirer.

### E16. Douze dépendances de hooks manquantes, avec des fermetures périmées réelles

ESLint signale 12 `react-hooks/exhaustive-deps`, dont plusieurs désactivés par commentaire. Un cas concret : [`handlePaste`](../src/components/Editor.js#L1098) dépend de `[viewMode, handleSelectionChange, handleCopy]` mais utilise `mathJaxReady`, `storeBlobForUrl` et `onInput`. Tant que ni la sélection ni la vue ne changent, le collage utilise la valeur de `mathJaxReady` capturée au premier rendu, c'est-à-dire « pas prêt » : le rendu des formules après collage ne se déclenche pas. Ces avertissements ne sont pas cosmétiques.

### E25. La configuration YAML est ignorée dès la deuxième ouverture

[ConfigManager.js:29-35](../src/config/ConfigManager.js#L29-L35) : localStorage gagne toujours sur `config.yaml`. Déjà documenté côté Python comme point d'attention. Une fois le mode développeur activé par un élève curieux, modifier le YAML ne suffit plus à le désactiver.

**Piste.** Sur le bureau (Eel présent), lire le YAML d'abord et n'utiliser localStorage que pour les réglages modifiés dans l'application. Ou stocker un hash du YAML et réinitialiser quand il change.

### E33. L'état `content` contient le markup MathJax rendu

Après rendu, [Editor.js:773](../src/components/Editor.js#L773) renvoie `innerHTML` (avec les `<mjx-container>` et leur SVG ou CHTML interne) dans l'état React. Conséquences : localStorage gonflé (E6), conversions plus lentes (E5), et la vue « Code HTML » montre du markup MathJax illisible. Le `data-tex` suffit à reconstruire la formule ; le reste pourrait être retiré avant stockage.

---

## 7. Dépendances, build et dépôt

### E20. `react-scripts` 5.0.1 n'est plus maintenu

Create React App est archivé depuis 2023. `npm audit --omit=dev` remonte 102 vulnérabilités (3 critiques, 79 hautes), presque toutes dans la chaîne de build (`webpack-dev-server`, `postcss`, `braces`, `nth-check`). Elles n'affectent pas le bundle livré, mais plus aucun correctif n'arrivera. Seule `js-yaml` (<= 4.3.1, utilisé à l'exécution pour lire `config.yaml`) est une dépendance de production touchée ; le fichier étant local, l'impact est faible.

| Paquet | Installé | Dernier |
|---|---|---|
| react-scripts | 5.0.1 | abandonné |
| mathjax | 3.2.2 | 4.1.3 |
| js-yaml | 4.1.1 | 5.4.3 |
| react / react-dom | 18.3.1 | 19.3.0 (pas nécessaire) |
| caniuse-lite | 14 mois | à rafraîchir |

**Piste.** Migrer vers Vite : un `vite.config.js` de 15 lignes, `index.html` déplacé à la racine, `process.env.NODE_ENV` remplacé par `import.meta.env`. Une session. Le bundle produit garde la même forme (`index.html` + `assets/`), il faut juste adapter la copie vers `build_web/` côté Python et le script `inline-build.js`.

### E21. La copie du build vers le projet Python est manuelle

Documenté dans `ARCHITECTURE.md` du projet Python, et à l'origine des trois vieux bundles qui y traînent. Un script npm de dix lignes réglerait les deux problèmes :

```json
"deploy:python": "node scripts/deploy-to-python.js"
```

qui vide `../../PythonProjects/PromptoDYS/build_web/static/`, copie `build/` dedans, et affiche le hash du `main.*.js` livré.

### E22. Hygiène du dépôt

- `package.json` est en version `1.0.0`, l'application en 1.2.0.
- `README.md` est en anglais, générique, et ne mentionne ni le pont Eel ni la procédure de livraison vers Python. Il contient un lien vers un formulaire de bêta et une playlist YouTube, qui sont des informations produit plutôt que développeur.
- `public/fonts/` (310 Ko) n'est référencé nulle part (voir E10). Il est copié dans `build/fonts/` puis dans l'exe Python.
- `.vscode/settings.json` et `.cursorrules` sont versionnés ; ce sont des réglages personnels.
- `index.html` charge `/eel.js` en chemin absolu. En mode `npm start`, c'est un 404 dans la console à chaque chargement ; sans effet, mais bruyant.

### E23. Aucun test

`react-scripts test` est disponible et jsdom est déjà installé. `markdownConverter.js` est une fonction pure : les cinq reproductions de cette revue (E1, E2, E3, E8, E17) sont déjà des cas de test, il suffit de les écrire en `expect(...)`. Dix tests protègent le cœur avant toute refonte.

---

## 8. Accessibilité

Pour un outil destiné à des élèves DYS, quelques points méritent attention. Ce ne sont pas des bugs.

- **Boutons à icône seule** (`✗`, `↶`, `↷`) sans `aria-label`. Un lecteur d'écran lit « croix », « flèche ».
- **Infobulles au survol uniquement** (`group-hover`). Inaccessibles au clavier, et de toute façon inactives à cause de E9.
- **Modales sans piège de focus ni `role="dialog"`**. La touche Tab sort de la modale.
- **Anneaux de focus absents** (classe `focus:ring-2` manquante, E9). La navigation au clavier est invisible.
- **`spellCheck={false}` sur la zone d'édition.** C'est un choix : le soulignement rouge peut être une aide ou une source d'anxiété pour un élève dysorthographique. À confirmer avec les utilisateurs plutôt qu'à trancher dans le code.
- **Libellés des titres inversés** par rapport au Markdown : « Titre 1 » produit `<h3>`, « Titre 3 » produit `<h1>`. Cohérent dans l'application et avec le prompt (qui privilégie `###`), mais déroutant pour qui ouvre le `.md` ailleurs. À documenter au minimum.
- **Pas de raccourcis clavier** pour titres et listes. Ctrl+B / Ctrl+I fonctionnent nativement via `contentEditable`.

---

## 9. Ce qui est bien fait

- **Le pont Eel est synchrone et documenté**, avec la leçon du 19/02/2026 inscrite dans le code. Les quatre fonctions ont un contrat clair.
- **Le thème DYS** (couleurs, police, interlignage, espacement des mots) est propre, persistant, et appliqué par variables CSS. OpenDyslexic est correctement embarquée.
- **La lecture vocale avec surlignage mot à mot** est une vraie fonctionnalité d'accessibilité, avec une logique de resynchronisation intelligente quand `onboundary` dérive.
- **La sauvegarde « façon Arduino »** côté navigateur, avec gestion des collisions de noms, produit une structure lisible par un humain.
- **L'isolation des images sur leur propre ligne** (logique *split block*) montre que les cas réels de collage dans un titre ou une liste ont été rencontrés et traités.
- **La préservation des formules** via `data-tex` après rendu MathJax est la bonne approche pour un aller-retour fiable.
- **Les images persistent en IndexedDB** avec un identifiant stable qui survit dans le Markdown. C'est la bonne architecture, même si le nettoyage manque.

---

## 10. Trois stratégies de remédiation

### Option 1 : correctifs ciblés dans le convertisseur actuel

Corriger E1, E2, E3, E8, E12 et E17 par des ajustements de regex et de marqueurs, plus E4, E5, E6, E7, E9, E10, E11 qui sont indépendants du convertisseur.

- **Avantages.** Chaque correctif fait moins de vingt lignes. Pas de nouvelle dépendance. Livrable en une à deux sessions.
- **Inconvénients.** Le convertisseur reste une chaîne de 40 expressions régulières dont l'ordre est significatif. Chaque correctif risque d'en casser un autre (c'est déjà arrivé : les marqueurs `__BOLD_n__` qui fuient jusqu'à Python). Sans tests, c'est risqué ; avec, c'est acceptable.
- **Quand la choisir.** Pour une version corrective rapide, après avoir écrit les dix tests.

### Option 2 : correctifs ciblés, puis convertisseur basé sur le DOM avec tests

Option 1 pour tout ce qui n'est pas le convertisseur, puis réécriture de `htmlToMarkdown` en parcours récursif du DOM (`DOMParser` + visite des nœuds, 150 lignes) et de `markdownToHtml` avec une petite bibliothèque (`marked`, 40 Ko, extensible) plus une extension de 30 lignes pour `{width= id=}` et une protection des `$...$`. Sortie passée par DOMPurify.

- **Avantages.** Fin des problèmes de classe E1 (le DOM distingue texte et balises par construction), E8 (DOMPurify), E17 (marked gère `---`, liens, listes imbriquées, blocs de code). Les tests écrits en lot 2 valident la réécriture. Le projet Python n'a rien à changer : le format Markdown échangé reste le même.
- **Inconvénients.** Deux à trois sessions. Deux dépendances de plus. Il faut vérifier que `marked` produit le même HTML que l'éditeur attend (`<div>` par ligne, `<p class="image-line">`), ce qui peut demander un post-traitement.
- **Quand la choisir.** Si le projet continue et que la qualité de l'aller-retour Markdown est au cœur du produit, ce qui est le cas : tout ce que Gemini renvoie passe par là.

### Option 3 : remplacer `contentEditable` maison par un moteur d'édition

Adopter TipTap ou Lexical, qui gèrent nativement Markdown, listes imbriquées, images, historique, et exposent un modèle de document propre.

- **Avantages.** Élimine d'un coup la majorité des constats : conversions, sélection, poignées, collage, formatage.
- **Inconvénients.** Réécriture de 80 % du front, y compris le thème DYS, la lecture vocale avec surlignage (qui dépend de la structure DOM actuelle) et le pont Eel. Plusieurs semaines. Courbe d'apprentissage.
- **Quand la choisir.** Pas maintenant. À reconsidérer si l'éditeur doit gagner des fonctions lourdes (tableaux, collaboration, commentaires).

**Recommandation : l'option 2**, en commençant par les tests. Les correctifs hors convertisseur (lots 1 et 2) sont indépendants et peuvent partir tout de suite.

---

## 11. Plan d'action proposé

Chaque lot est un commit. Chaque étape attend un GO et s'accompagne d'une mise à jour de la todo list.

### Lot 1 : tests de non-régression (une demi-session)

1. Créer `src/utils/markdownConverter.test.js` avec les cas E1, E2, E3, E8, E17 et l'aller-retour nominal du prompt (titre coloré, liste, image avec attributs, formule). Ces tests **échouent** au départ : c'est voulu, ils documentent les bugs.

### Lot 2 : correctifs indépendants du convertisseur (une session)

| # | Fichier | Action | Constat |
|---|---|---|---|
| 2 | `Editor.js` | Réhydrater seulement sur signal externe ou `src` cassé ; révoquer les URL | E4 |
| 3 | `Editor.js` | Un seul déclencheur (`onInput`), un seul `selectionchange`, debounce | E5 |
| 4 | `App.js` | `try/catch` + debounce sur localStorage ; error boundary racine | E6 |
| 5 | `imageStore.js` | Nettoyage des orphelins avec `keys()` | E7 |
| 6 | `index.css`, `public/fonts/` | `url()` pour Lexend ; supprimer le doublon | E10 |
| 7 | `useMathJax.js`, `index.html` | Sortie SVG (ou livrer les woff) | E11 |
| 8 | `Toolbar.js` | `onKeyDown` pour Échap | E12 |
| 9 | Tailwind | Pipeline réel ou CSS classique (décision à prendre) | E9 |
| 10 | Partout | Utilitaire `debug()` conditionné par `developer_mode` | E14 |
| 11 | Partout | Supprimer le code mort listé en E15 ; corriger les deps de hooks | E15, E16 |
| 12 | `useEelBridge.js` | Refs + exposition unique ; cache base64 pour `readDocumentData` | E19, E18 |

### Lot 3 : convertisseur (une à deux sessions)

13. Réécrire `htmlToMarkdown` en parcours du DOM. Les tests du lot 1 passent au vert.
14. Remplacer `markdownToHtml` par `marked` + extension `{attrs}` + protection `$...$` + DOMPurify.
15. Décider du sort de `---` (rendu `<hr>` ou retrait du prompt) et synchroniser avec le projet Python.

### Lot 4 : découpage et outillage (une à deux sessions)

16. Extraire les hooks et utilitaires listés en E13, un commit par module, tests relancés à chaque fois.
17. Script `deploy:python` (E21). Version `1.2.0` dans `package.json`. README développeur.
18. Migration Vite (E20), puis mise à jour de `ARCHITECTURE.md` côté Python.

---

## 12. Tableau récapitulatif

| Réf. | Gravité | Constat | Reproduit | Effort | Lot |
|---|---|---|---|---|---|
| E1 | 🔴 Critique | Texte avec `<` `>` tronqué à la conversion | Oui | Faible | 3 |
| E2 | 🔴 Critique | Astérisques des maths convertis en italique | Oui | Faible | 3 |
| E3 | 🟠 Important | Puces `*` perdues | Oui | Trivial | 3 |
| E8 | 🟠 Important | Attributs arbitraires conservés dans les spans (XSS local) | Oui | Faible | 3 |
| E4 | 🟠 Important | Réhydratation des images à chaque frappe | Lecture | Faible | 2 |
| E5 | 🟠 Important | Triple traitement par frappe, double `selectionchange` | Lecture | Faible | 2 |
| E6 | 🟠 Important | localStorage sans `try/catch`, écran blanc possible | Lecture | Trivial | 2 |
| E7 | 🟠 Important | IndexedDB jamais nettoyée | Lecture | Faible | 2 |
| E9 | 🟠 Important | 12 classes Tailwind absentes, modales et boutons dégradés | Oui | Faible | 2 |
| E10 | 🟠 Important | Lexend non chargée depuis les fichiers livrés | Oui | Trivial | 2 |
| E11 | 🟠 Important | Polices MathJax absentes du build | À confirmer | Faible | 2 |
| E17 | 🟠 Important | `---`, liens, listes imbriquées non gérés | Oui | Moyen | 3 |
| E18 | 🟡 Mineur | Images ré-encodées en PNG via le pont Python | Lecture | Faible | 2 |
| E12 | 🟡 Mineur | Échap inopérant dans la modale (`onKeyPress`) | Lecture | Trivial | 2 |
| E13 | 🟡 Mineur | Composants de 1 854 et 2 089 lignes | Mesuré | Moyen | 4 |
| E14 | 🟡 Mineur | 352 logs, document entier imprimé 4× par conversion | Mesuré | Faible | 2 |
| E15 | 🟡 Mineur | Code mort, doublons, suppression d'image gérée deux fois | Lint | Faible | 2 |
| E16 | 🟡 Mineur | 12 dépendances de hooks manquantes, fermetures périmées | Lint | Faible | 2 |
| E19 | 🟡 Mineur | Pont Eel ré-exposé à chaque frappe | Lecture | Faible | 2 |
| E25 | 🟡 Mineur | localStorage écrase `config.yaml` définitivement | Lecture | Faible | 4 |
| E33 | 🟡 Mineur | Markup MathJax stocké dans l'état et localStorage | Lecture | Faible | 2 |
| E20 | 🟠 Important | `react-scripts` abandonné, 102 vulnérabilités d'outillage | Audit | Moyen | 4 |
| E21 | 🟡 Mineur | Copie manuelle du build vers Python | Doc | Trivial | 4 |
| E22 | 🟡 Mineur | Version, README, polices en double, fichiers IDE versionnés | Lecture | Trivial | 4 |
| E23 | 🟡 Mineur | Aucun test | Mesuré | Faible | 1 |
| A11y | 🔵 Amélioration | aria-labels, focus, modales, raccourcis | Lecture | Faible | 4 |
