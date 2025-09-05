# Spécifications : Script Python minimaliste avec Eel

## 📝 Contexte : L'éditeur Markdown existant

### Architecture actuelle
L'éditeur est une **application React** complète avec architecture modulaire :

**Structure des composants :**
- `App.js` : État global + persistance localStorage
- `components/Editor.js` : Zone d'édition avec styles CSS intégrés + MathJax
- `components/Toolbar.js` : Barre d'outils avec boutons de formatage
- `components/StatusBar.js` : Ligne de statut avec état de formatage
- `hooks/useEditor.js` : Hook personnalisé pour gestion d'état et formatage
- `utils/markdownConverter.js` : Conversions bidirectionnelles HTML ↔ Markdown

### Fonctionnalités implémentées
**Modes d'édition :**
- **WYSIWYG** : Édition visuelle avec formatage temps réel
- **HTML** : Code source HTML formaté
- **Markdown** : Syntaxe Markdown pure avec caractères spéciaux

**Formatage avancé :**
- Titres H1/H2/H3 avec styles CSS distincts
- Texte (gras, italique, couleur)
- Listes : puces, numérotées ET alphabétiques (a, b, c...)
- Formules LaTeX inline ($...$) et block ($$...$$) avec MathJax
- Préservation parfaite de la numérotation lors des changements de vue

**Persistance :**
- Sauvegarde automatique dans `localStorage`
- Restauration du contenu et mode de vue au démarrage
- Gestion intelligente du curseur et sélection

### Problème à résoudre
L'éditeur fonctionne parfaitement en **mode web** mais nécessite :
1. **Fenêtre native** pour utilisation desktop
2. **Accès fichiers** pour ouvrir/sauvegarder des documents .md
3. **Intégration Python** pour traitement avancé (IA, export, etc.)

### ✅ Contrainte : Préservation totale
**AUCUNE modification** des fichiers source React (`src/`) ne sera effectuée. L'intégration se fait uniquement par **injection de script** dans le HTML buildé.

## 🎯 Objectif
Créer un script Python minimaliste utilisant **Eel** pour :
- Démarrer l'éditeur Markdown dans une fenêtre native
- Lire le contenu Markdown depuis Python
- Écrire du contenu Markdown vers l'éditeur

## 📦 Installation

```bash
pip install eel
```

## 🏗️ Structure du projet

```
projet/
├── app.py              # Script Python principal
├── document.md         # Fichier MD de travail (optionnel)
├── specifications.md   # Ce fichier
└── build/              # Éditeur React buildé (existant)
    ├── index.html
    └── static/
        ├── css/
        └── js/
```

## 🔧 Architecture de communication

### Flux de données
```
Python (app.py) ←→ JavaScript (éditeur React)
       ↓                      ↓
   document.md            localStorage
```

### Fonctions Python exposées

#### `get_current_content() -> str`
- **Rôle** : Récupère le contenu actuel de l'éditeur en Markdown
- **Retour** : Contenu Markdown en string
- **Accès** : Direct via l'état React de l'éditeur

#### `set_editor_content(markdown_content: str) -> bool`
- **Rôle** : Injecte du contenu Markdown dans l'éditeur
- **Paramètre** : `markdown_content` - Contenu Markdown à injecter
- **Retour** : `True` si succès
- **Conversion** : Automatique Markdown → HTML pour l'affichage

## 🔌 Intégration sans modification de l'éditeur

### Principe : Injection de script externe
**Aucune modification** des fichiers React existants n'est nécessaire. L'intégration se fait par **injection d'un script externe** dans le HTML buildé.

### Méthode d'intégration
1. **Script Python** modifie temporairement `build/index.html`
2. **Injection automatique** d'un script `eel-integration.js`
3. **Communication** via `window.eel` sans toucher au code React

### Script d'intégration automatique
Le script Python injecte automatiquement le code nécessaire :

```python
def inject_eel_integration():
    """Injecte le script d'intégration Eel dans build/index.html"""
    html_path = 'build/index.html'
    
    # Script d'intégration à injecter
    integration_script = '''
    <script>
    // Intégration Eel sans modification du code React
    window.addEventListener('DOMContentLoaded', function() {
        
        // ACCÈS DIRECT AU CONTENU MARKDOWN
        // Fonction pour lire le contenu actuel en Markdown
        window.getCurrentMarkdown = function() {
            const editorApp = document.querySelector('[data-testid="editor-app"]') || document.querySelector('.editor-container');
            if (editorApp) {
                // Récupérer l'état React via les props internes
                const reactFiber = editorApp._reactInternalFiber || editorApp._reactInternals;
                if (reactFiber) {
                    // Naviguer dans l'arbre React pour trouver le hook useEditor
                    let currentFiber = reactFiber;
                    while (currentFiber) {
                        if (currentFiber.memoizedState) {
                            // Chercher l'état content et viewMode
                            let state = currentFiber.memoizedState;
                            while (state) {
                                if (state.memoizedState && typeof state.memoizedState === 'string') {
                                    const content = state.memoizedState;
                                    // Vérifier si c'est du HTML et le convertir en MD
                                    if (content.includes('<') && content.includes('>')) {
                                        return window.htmlToMarkdown ? window.htmlToMarkdown(content) : content;
                                    }
                                    return content;
                                }
                                state = state.next;
                            }
                        }
                        currentFiber = currentFiber.child || currentFiber.sibling || currentFiber.return;
                    }
                }
            }
            // Fallback: utiliser localStorage
            const content = localStorage.getItem('editor-content') || '';
            return window.htmlToMarkdown ? window.htmlToMarkdown(content) : content;
        };
        
        // Fonction pour écrire du contenu Markdown
        window.setMarkdownContent = function(markdownContent) {
            // Convertir MD en HTML si nécessaire
            const htmlContent = window.markdownToHtml ? window.markdownToHtml(markdownContent) : markdownContent;
            
            // Mettre à jour localStorage
            localStorage.setItem('editor-content', htmlContent);
            
            // Déclencher l'événement storage pour forcer React à recharger
            window.dispatchEvent(new Event('storage'));
            
            // Sauvegarder aussi en Python
            if (window.eel) {
                window.eel.save_markdown(markdownContent);
            }
        };
        
        // Exposer les fonctions de conversion si disponibles
        setTimeout(() => {
            if (window.markdownConverter) {
                window.htmlToMarkdown = window.markdownConverter.htmlToMarkdown;
                window.markdownToHtml = window.markdownConverter.markdownToHtml;
            }
        }, 1000);
    });
    </script>
    '''
    
    # Lire le HTML existant
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Injecter le script avant </head>
    if integration_script not in html_content:
        html_content = html_content.replace('</head>', integration_script + '\n</head>')
        
        # Sauvegarder le HTML modifié
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
```

## 🚀 Script Python minimal (app.py)

### Structure de base
```python
import eel
import os

def inject_eel_integration():
    """Injecte le script d'intégration Eel dans build/index.html"""
    html_path = 'build/index.html'
    
    # Script d'intégration à injecter
    integration_script = '''
    <script>
    // Intégration Eel sans modification du code React
    window.addEventListener('DOMContentLoaded', function() {
        // Intercepter localStorage pour synchronisation Python
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            originalSetItem.call(this, key, value);
            if (key === 'editorContent' && window.eel) {
                window.eel.save_markdown(value);
            }
        };
        
        // Chargement initial depuis Python
        if (window.eel) {
            window.eel.load_markdown()((content) => {
                if (content) {
                    localStorage.setItem('editorContent', content);
                    // Déclencher un événement pour forcer le rechargement
                    window.dispatchEvent(new Event('storage'));
                }
            });
        }
        
        // Fonctions globales pour interaction externe
        window.loadExternalFile = function(filepath) {
            if (window.eel) {
                window.eel.load_file(filepath)((content) => {
                    localStorage.setItem('editorContent', content);
                    window.dispatchEvent(new Event('storage'));
                });
            }
        };
        
        window.saveToFile = function(filepath) {
            const content = localStorage.getItem('editorContent') || '';
            if (window.eel) {
                window.eel.save_file(filepath, content);
            }
        };
    });
    </script>
    '''
    
    # Lire le HTML existant
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Injecter le script avant </head>
    if integration_script not in html_content:
        html_content = html_content.replace('</head>', integration_script + '\n</head>')
        
        # Sauvegarder le HTML modifié
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

# Initialiser Eel avec le dossier build
eel.init('build')

@eel.expose
def load_markdown():
    """Charge le contenu de document.md"""
    try:
        if os.path.exists('document.md'):
            with open('document.md', 'r', encoding='utf-8') as f:
                return f.read()
        return ""
    except Exception as e:
        print(f"Erreur lecture : {e}")
        return ""

@eel.expose
def save_markdown(content):
    """Sauvegarde le contenu dans document.md"""
    try:
        with open('document.md', 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Erreur sauvegarde : {e}")
        return False

@eel.expose
def load_file(filepath):
    """Charge un fichier MD spécifique"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        return ""
    except Exception as e:
        print(f"Erreur lecture fichier : {e}")
        return ""

@eel.expose
def save_file(filepath, content):
    """Sauvegarde vers un fichier spécifique"""
    try:
        # Créer le répertoire si nécessaire
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Erreur sauvegarde fichier : {e}")
        return False

if __name__ == '__main__':
    # Injecter l'intégration avant de démarrer
    inject_eel_integration()
    
    # Lancer l'application
    eel.start('index.html', 
              mode='chrome-app',  # Fenêtre native
              size=(1200, 800),   # Taille fenêtre
              port=0)             # Port automatique
```

## ⚡ Workflow d'utilisation

### Démarrage
1. **Lancer** : `python app.py`
2. **Fenêtre** : S'ouvre automatiquement avec l'éditeur
3. **Chargement** : Contenu de `document.md` affiché (si existe)

### Édition
1. **Utilisation normale** : WYSIWYG, HTML, Markdown
2. **Sauvegarde auto** : Chaque modification → `document.md`
3. **Persistance** : localStorage + fichier Python

## 🔄 Communication bidirectionnelle

### Python → JavaScript (Accès direct au contenu)
```python
@eel.expose
def get_current_content():
    """Récupère le contenu actuel de l'éditeur en Markdown"""
    # Appeler la fonction JavaScript injectée
    return eel.getCurrentMarkdown()()

@eel.expose  
def set_editor_content(markdown_content):
    """Injecte du contenu Markdown dans l'éditeur"""
    # Utiliser la fonction JavaScript injectée
    eel.setMarkdownContent(markdown_content)
    return True
```

### JavaScript → Python (Depuis la console ou extensions)
```javascript
// Lire le contenu Markdown actuel
const markdownContent = window.getCurrentMarkdown();

// Écrire du nouveau contenu Markdown
window.setMarkdownContent('# Nouveau titre\nContenu injecté par JavaScript');
```

## ✅ Avantages de cette approche

- **Simple** : Installation et code minimal
- **Natif** : Fenêtre intégrée au système
- **Bidirectionnel** : Communication Python ↔ JavaScript fluide
- **Extensible** : Ajout facile de fonctionnalités Python
- **Portable** : Fonctionne sur Windows, Mac, Linux
- **Léger** : Pas de serveur web visible

## 🔧 Points d'attention

### Gestion des erreurs
- Toujours encapsuler les I/O dans try/catch
- Retourner des valeurs par défaut en cas d'erreur
- Logger les erreurs pour debug

### Performance
- Éviter les sauvegardes trop fréquentes
- Implémenter un debounce sur les changements
- Utiliser des callbacks asynchrones

### Sécurité
- Valider les chemins de fichiers
- Limiter l'accès aux répertoires autorisés
- Échapper les caractères spéciaux

## 🚀 Prochaines étapes

1. **Installer Eel** : `pip install eel`
2. **Créer app.py** avec le code fourni
3. **Modifier useEditor.js** pour intégration
4. **Tester** : `python app.py`
5. **Étendre** selon besoins spécifiques