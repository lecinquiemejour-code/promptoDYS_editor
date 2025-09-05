# Build Standalone - Fichier HTML Autonome

## Description

Le build standalone génère un fichier HTML unique et autonome (`build/standalone.html`) contenant :
- ✅ Tout le code React compilé (inliné)
- ✅ Tous les styles CSS (inlinés) 
- ✅ Le favicon en base64
- ✅ Les images/assets en base64
- ✅ Compatible hors ligne, sans serveur

## Utilisation

### Génération du build standalone
```bash
npm run build:standalone
```

Cette commande :
1. Exécute `npm run build` (build React classique)
2. Lance le script `inline-build.js` pour inline tous les assets
3. Génère `build/standalone.html` (~2-3 MB)

### Utilisation du fichier
```bash
# Ouvrir directement dans le navigateur
start build/standalone.html

# Ou copier/partager le fichier
cp build/standalone.html /chemin/vers/destination/
```

## Fonctionnalités préservées

Le fichier standalone conserve **toutes** les fonctionnalités :
- 🎨 **Éditeur WYSIWYG** avec formatage (gras, italique, titres, listes)
- 📝 **3 modes d'affichage** : WYSIWYG, HTML, Markdown
- 🔧 **Paramètres DYS** complets (couleurs, polices, tailles)
- 📐 **MathJax** pour les formules LaTeX ($...$, $$...$$)
- 🖼️ **Redimensionnement d'images** par drag
- 💾 **Sauvegarde localStorage** automatique
- 🎯 **Conversions** HTML ↔ Markdown robustes

## Différences avec le build classique

| Aspect | Build classique | Build standalone |
|--------|----------------|------------------|
| **Fichiers** | Multiple (HTML + CSS + JS) | Un seul HTML |
| **Taille** | ~500 KB total | ~2-3 MB unique |
| **Cache navigateur** | ✅ Optimisé | ❌ Pas de cache |
| **Portabilité** | ❌ Nécessite serveur | ✅ Fonctionne partout |
| **Intégration Eel** | ✅ Complète | ⚠️ Limitée (eel.js retiré) |

## Notes techniques

- **Google Fonts** : Chargées via CDN (connexion internet requise pour Lexend)
- **MathJax** : Chargé via CDN (connexion internet requise pour formules)
- **localStorage** : Fonctionne normalement pour la persistance
- **File System Access API** : Compatible pour PromptoDYS workspace

## Cas d'usage recommandés

- ✅ **Distribution** : Partage facile du fichier complet
- ✅ **Démonstration** : Présentation hors ligne
- ✅ **Archivage** : Version figée et autonome
- ✅ **Environnements restreints** : Sans possibilité d'installer un serveur
