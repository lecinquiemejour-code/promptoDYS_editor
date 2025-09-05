# 🚀 Support Eel pour Applications Desktop

L'éditeur Markdown supporte maintenant **Eel** pour créer des applications desktop natives avec Python !

## ⚡ Installation et Usage

### 1. Prérequis
```bash
# Installer Eel
pip install eel

# Construire l'application React
npm run build
```

### 2. Lancement Desktop
```bash
python desktop_app.py
```

## 🎮 Interface Console Interactive

L'application inclut une **console interactive** qui s'exécute en parallèle de l'éditeur graphique :

```
🎮 ÉDITEUR MARKDOWN - CONSOLE SIMPLE
==================================================

📋 Options:
  1 - Lire le contenu de l'éditeur
  2 - Écrire dans l'éditeur  
  0 - Quitter
------------------------------
🎯 Votre choix (1/2/0):
```

### Fonctionnalités Console
- **📖 Lecture** : Affiche le contenu actuel de l'éditeur
- **✏️ Écriture** : Permet de saisir du contenu multiligne (terminer avec `EOF`)
- **🔄 Synchronisation** : Bidirectionnelle entre console et interface graphique

## 🔧 Fonctions Eel Disponibles

### Fonctions JavaScript → Python
- `eel.readMarkdown()` - Lit le contenu actuel de l'éditeur
- `eel.writeMarkdown(content)` - Injecte du contenu dans l'éditeur

### Fonctions utilitaires intégrées
- `get_markdown()` - Récupère le contenu avec gestion d'erreurs
- `set_markdown(content)` - Injecte du contenu avec validation
- `find_web_folder()` - Détection automatique du dossier web (build/dist/public)

## 💡 Exemples d'Usage

### Lecture du contenu
```python
def lire_contenu():
    contenu = get_markdown()
    if contenu:
        print(f"Contenu ({len(contenu)} caractères):")
        print(contenu)
    else:
        print("L'éditeur est vide")
```

### Écriture de contenu
```python
def ecrire_contenu():
    contenu = """# Mon Document
    
Ceci est un exemple de contenu Markdown
avec des **mots en gras** et des *mots en italique*.

- Liste à puces
- Autre élément
"""
    
    if set_markdown(contenu):
        print("✅ Contenu injecté avec succès !")
```

### Intégration IA (exemple)
```python
import openai

def ameliorer_texte():
    # Récupérer le contenu actuel
    content = get_markdown()
    
    # Traitement IA
    improved = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": f"Améliore ce texte: {content}"}]
    )
    
    # Réinjecter le résultat
    set_markdown(improved.choices[0].message.content)
```

## 🛡️ Sécurité

- Les fonctions Eel ne s'activent **que** en mode desktop
- En mode web normal, aucun impact sur les performances
- Accès contrôlé aux fonctions de lecture/écriture uniquement

## 🎯 Cas d'Usage

- **📝 Éditeur desktop** : Ouverture/sauvegarde de fichiers locaux
- **🤖 Intégration IA** : Correction, traduction, génération
- **📊 Générateur de rapports** : Templates + données → Markdown
- **🔄 Convertisseur** : Word/PDF → Markdown → formats divers
- **📚 Wiki personnel** : Gestion locale de connaissances

## 🔄 Compatibilité

✅ **Mode Web** : Fonctionne normalement sans Eel  
✅ **Mode Desktop** : Toutes les fonctionnalités Eel disponibles  
✅ **Rétrocompatible** : Aucun impact sur l'usage existant
