# Spécifications : Éditeur React avec Intégration Eel

## 🔧 Architecture de communication

Le hook `useEelBridge.js` expose les fonctions JavaScript suivantes à Python via Eel :

### Fonctions existantes (texte seul)

1. **`readMarkdown()`** : Retourne le contenu actuel de l'éditeur au format Markdown.
2. **`writeMarkdown(content)`** : Met à jour l'éditeur avec le nouveau contenu Markdown.

```python
# Lire le texte :
content = eel.readMarkdown()()

# Écrire du texte :
eel.writeMarkdown("# Mon titre\n\nDu texte...")()
```

---

## 💾 Mission : Sauvegarde et ouverture de documents complets via Python/Eel

### Ta mission

L'éditeur PromptoDYS permet aux utilisateurs de rédiger des notes avec du texte formaté et des images. Aujourd'hui, la sauvegarde et l'ouverture de documents se font via des boutons dans l'éditeur (côté navigateur). **Ta mission est d'implémenter côté Python les mêmes fonctionnalités de sauvegarde et d'ouverture**, en utilisant le pont Eel pour communiquer avec l'éditeur JavaScript.

Le résultat sur le disque doit être **strictement identique** à ce que produisent les boutons navigateur : un dossier contenant un fichier Markdown et un sous-dossier d'images.

### Ce qui existe déjà (ne pas toucher)

Le pont Eel (`useEelBridge.js`) expose déjà deux fonctions pour le texte seul :
- `readMarkdown()` → retourne le contenu Markdown (texte uniquement, pas les images)
- `writeMarkdown(markdown)` → injecte du Markdown dans l'éditeur (texte uniquement)

**Ces fonctions restent inchangées.** Le script Python existant qui les utilise continue de fonctionner.

### Ce que le JS va exposer pour toi (2 nouvelles fonctions)

L'équipe front-end va ajouter deux nouvelles fonctions Eel que tu pourras appeler depuis Python :

#### `readDocumentData()` — Récupérer le document pour le sauvegarder

Tu appelles cette fonction quand tu veux sauvegarder. Elle te retourne **tout** : le texte et les images.

```python
data = eel.readDocumentData()()
```

Tu reçois un dictionnaire Python comme ceci :

```python
{
    "markdown": "# Mon cours\n\nDu texte...\n\n![photo](./images/photo_20250209.png){width=300px id=a1b2c3...}\n",
    "images": [
        {
            "filename": "photo_20250209.png",
            "data": "iVBORw0KGgoAAAANSUhEUgAA...",   # base64 pur (pas de préfixe data:...)
            "mimeType": "image/png"
        }
    ]
}
```

Si le document n'a pas d'images, `images` est une liste vide `[]`.

#### `writeDocumentData(data)` — Charger un document dans l'éditeur

Tu appelles cette fonction quand tu veux ouvrir un document. Tu lui envoies le texte et les images, et l'éditeur les affiche.

```python
result = eel.writeDocumentData(data)()   # retourne True ou False
```

Le format de `data` est **exactement le même** que celui retourné par `readDocumentData()`. Tu lis les fichiers depuis le disque, tu les mets dans ce format, et tu envoies.

---

### Ce que tu dois produire sur le disque

La structure de fichiers doit être exactement celle-ci :

```
MonDocument/
├── MonDocument.md
└── images/
    ├── photo_20250209_143022.png
    └── schema_20250209_150530.jpg
```

**Règles :**
- Le nom du dossier = le nom du document
- Le fichier `.md` porte le même nom que le dossier
- Les images vont dans le sous-dossier `images/`
- Les images sont des fichiers binaires classiques (PNG, JPEG, etc.)

#### Exemple de contenu du fichier .md

```markdown
# Mon cours de maths

Voici la leçon du jour avec un **schéma** :

![schema](./images/schema_20250209_150530.jpg){width=400px id=a1b2c3d4-e5f6-7890-abcd-ef1234567890}

Et une photo du tableau :

![photo](./images/photo_20250209_143022.png){width=300px id=f9e8d7c6-b5a4-3210-fedc-ba0987654321}

## Formules

La formule est $E = mc^2$
```

---

### Comment implémenter la sauvegarde

```python
import eel
import os
import base64

def save_document(document_name, save_directory):
    """
    Sauvegarde le document complet depuis l'éditeur vers le disque.
    
    Args:
        document_name: Nom du document (ex: "MonDocument")
        save_directory: Chemin du dossier parent (ex: "C:/Users/Jean/Documents")
    """
    # 1. Récupérer les données depuis l'éditeur JS
    data = eel.readDocumentData()()
    
    if not data:
        print("Aucune donnée reçue de l'éditeur")
        return False
    
    # 2. Créer la structure de dossiers
    doc_dir = os.path.join(save_directory, document_name)
    images_dir = os.path.join(doc_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # 3. Écrire le fichier Markdown
    md_path = os.path.join(doc_dir, f"{document_name}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(data["markdown"])
    
    # 4. Écrire chaque image (décodage base64 → binaire)
    for image in data.get("images", []):
        image_path = os.path.join(images_dir, image["filename"])
        image_bytes = base64.b64decode(image["data"])
        with open(image_path, "wb") as f:
            f.write(image_bytes)
    
    return True
```

### Comment implémenter l'ouverture

```python
import eel
import os
import base64
import mimetypes

def load_document(doc_dir):
    """
    Charge un document depuis le disque vers l'éditeur.
    
    Args:
        doc_dir: Chemin du dossier du document (ex: "C:/Users/Jean/Documents/MonDocument")
    """
    document_name = os.path.basename(doc_dir)
    md_path = os.path.join(doc_dir, f"{document_name}.md")
    images_dir = os.path.join(doc_dir, "images")
    
    # 1. Lire le fichier Markdown
    if not os.path.exists(md_path):
        print(f"Fichier non trouvé: {md_path}")
        return False
    
    with open(md_path, "r", encoding="utf-8") as f:
        markdown_content = f.read()
    
    # 2. Lire et encoder les images en base64
    images = []
    if os.path.exists(images_dir):
        for filename in os.listdir(images_dir):
            image_path = os.path.join(images_dir, filename)
            if not os.path.isfile(image_path):
                continue
            
            mime_type, _ = mimetypes.guess_type(image_path)
            if not mime_type or not mime_type.startswith("image/"):
                continue
            
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            
            images.append({
                "filename": filename,
                "data": image_data,
                "mimeType": mime_type
            })
    
    # 3. Envoyer à l'éditeur JS
    result = eel.writeDocumentData({
        "markdown": markdown_content,
        "images": images
    })()
    
    return result
```

---

### Ce que tu dois savoir

**Sur le base64 :**
- Le champ `data` contient du base64 **pur** : pas de préfixe `data:image/png;base64,`
- Pour décoder : `base64.b64decode(image["data"])`
- Pour encoder : `base64.b64encode(bytes).decode("utf-8")`

**Sur l'attribut `{id=...}` dans le Markdown :**
- Tu verras des lignes comme `![photo](./images/photo.png){width=300px id=a1b2c3...}`
- Le `id=...` est un identifiant interne du navigateur (IndexedDB). Tu n'as **rien à faire avec** : ne le génère pas, ne le modifie pas, contente-toi de le préserver tel quel quand tu lis et réécris le fichier .md

**Sur les noms de fichiers images :**
- Le champ `filename` dans la liste `images` correspond directement au nom de fichier dans le Markdown
- Exemple : si le Markdown dit `./images/photo_20250209.png`, alors `filename` vaut `photo_20250209.png`
- Il suffit d'écrire le fichier avec ce nom dans le sous-dossier `images/`

**Sur les appels Eel :**
- `eel.readDocumentData()()` → appel **bloquant** (double parenthèses)
- `eel.readDocumentData()(ma_callback)` → appel **non-bloquant** avec callback
- Même chose pour `writeDocumentData`

**Sur la gestion de conflits de noms :**
- Les boutons navigateur renomment automatiquement en cas de collision (`MonDocument (1)`)
- Côté Python, c'est **ta responsabilité** de gérer ça comme tu veux

**Sur la compatibilité :**
- Les anciennes fonctions `readMarkdown()` et `writeMarkdown()` ne sont **pas touchées**
- Le script Python existant continue de fonctionner sans modification
- `readDocumentData` et `writeDocumentData` sont un **ajout**, pas un remplacement
