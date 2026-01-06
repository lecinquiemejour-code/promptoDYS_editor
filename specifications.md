# Spécifications : Éditeur React avec Intégration Eel

## 📝 Contexte : L'éditeur Markdown Propre

### Architecture actuelle
L'éditeur est une **application React** moderne avec une architecture modulaire et une intégration native pour le bureau :

**Structure des composants :**
- `App.js` : Composant racine, gère l'état global et intègre les ponts (Eel, Thème, MathJax).
- `hooks/useEelBridge.js` : **[NOUVEAU]** Pont natif entre React et Python. Expose directement les fonctions au backend Python.
- `hooks/useEditor.js` : Gestion fine du contenu, du formatage et des modes de vue.
- `utils/markdownConverter.js` : Moteur de conversion HTML ↔ Markdown optimisé.

### Fonctionnalités implémentées
**Modes d'édition :**
- **WYSIWYG** : Édition visuelle type traitement de texte.
- **Source (Markdown/HTML)** : Édition directe du code avec formatage auto.

**Support Natif Desktop :**
- **Pont Eel intégré** : Communication bidirectionnelle ultra-rapide sans bidouillage de DOM.
- **Mode Standalone** : Capacité de générer un fichier `standalone.html` unique, sans dépendances, tout en désactivant proprement les fonctions desktop pour éviter les erreurs.

## 🎯 Objectif de l'Intégration Eel
Contrairement aux anciennes versions qui injectaient du code dans le build, la nouvelle architecture utilise un **Hook React dédié** (`useEelBridge`) pour :
- Permettre à Python de lire/écrire le contenu via `window.eel.readMarkdown()` et `window.eel.writeMarkdown()`.
- Synchroniser l'état React de manière fluide.
- Gérer proprement le démarrage et l'arrêt de la communication.

## ⚙️ Contraintes techniques
- **Fonctionnement 100% offline** : L'éditeur doit fonctionner sans connexion internet, toutes les ressources (bibliothèques, polices, icônes) doivent être embarquées localement.

## 🏗️ Structure du projet (Nettoyée)

```
projet/
├── app.py              # Votre script Python (Backend)
├── build/              # Résultat de 'npm run build' (Frontend)
│   ├── index.html      # Inclut <script src="/eel.js">
│   └── standalone.html # Version portable (Eel désactivé)
├── src/                # Sources React
│   ├── hooks/
│   │   └── useEelBridge.js # Le cœur de la communication
│   └── App.js          # Intégration du hook
└── inline-build.js     # Script de génération du standalone
```

## 🔧 Architecture de communication

### Fonctions JavaScript exposées à Python
Le hook `useEelBridge.js` expose automatiquement :

1. **`readMarkdown()`** : Retourne le contenu actuel de l'éditeur au format Markdown.
2. **`writeMarkdown(content)`** : Met à jour l'éditeur avec le nouveau contenu Markdown.

### Utilisation côté Python (Exemple simplifié)

```python
import eel

# Initialiser avec le dossier 'build'
eel.init('build')

@eel.expose
def notify_save(content):
    print("Sauvegarde demandée par l'éditeur")
    with open("document.md", "w", encoding="utf-8") as f:
        f.write(content)

# Démarrage
eel.start('index.html', size=(1280, 800))

# Pour lire le contenu depuis Python plus tard :
# content = eel.readMarkdown()()
```

## ✅ Avantages de la nouvelle approche
- **Robustesse** : Plus d'injection de scripts fragiles dans le HTML buildé.
- **Performance** : Utilise les cycles de rendu React pour mettre à jour l'UI.
- **Propreté** : Le code est modulaire et facile à déboguer via la console (logs détaillés inclus).
- **Flexibilité** : Supporte à la fois le mode Desktop (Eel) et le mode Web/Portable (Standalone).

## 🚀 Utilisation
1. **Lancer le build** : `npm run build`
2. **Lancer Python** : `python app.py` (en pointant eel.init sur le dossier `build/`).