# 🎓 Mini-Tuto : Git & GitHub au quotidien

Ce petit guide vous aidera à gérer les versions de votre projet **PromptoDYS_editor** directement depuis VS Code.

## 🔄 Le Cycle de Travail (Workflow)

Chaque fois que vous travaillez sur le projet, suivez ces étapes :

### 1. Faire vos modifications
Codez normalement. Sauvegardez vos fichiers (`Ctrl+S`).

### 2. Vérifier (Menu "Source Control")
Cliquez sur l'icône **Source Control** (les ramifications) dans la barre de gauche.
- Vous verrez la liste des fichiers modifiés sous **"Changes"**.
- Cliquez sur un fichier pour voir les différences (Avant vs Après).

### 3. Valider (Stage & Commit)
Pour enregistrer vos modifications dans l'historique :

1.  **Stage (+)** : Passez la souris sur le mot "Changes" et cliquez sur le petit `+`. Cela prépare *tous* les fichiers. (Ou faites-le fichier par fichier).
2.  **Message** : Écrivez un court message décrivant ce que vous avez fait dans la zone de texte (ex: "Ajout du bouton retour", "Correction bug affichage").
3.  **Commit** : Cliquez sur le bouton bleu **"Commit"**.

> Votre travail est maintenant sauvegardé **localement** sur votre ordinateur.

### 4. Publier (Sync / Push)
Pour envoyer votre travail sur **GitHub** (Sauvegarde Cloud + Open Source) :

1.  Cliquez sur le bouton bleu **"Sync Changes"** (ou l'icône avec des flèches circulaires si le bouton n'est pas là).
2.  VS Code va envoyer vos commits vers GitHub.

---

## 💡 Astuces

### Les Messages de Commit
Essayez d'être clair. Une convention courante est d'utiliser des préfixes :
- `feat:` pour une nouvelle fonctionnalité (ex: `feat: ajout mode sombre`)
- `fix:` pour une correction de bug (ex: `fix: problème de scroll`)
- `docs:` pour la documentation (ex: `docs: mise à jour du readme`)
- `chore:` pour la maintenance (ex: `chore: nettoyage code`)

### "Pull" (Mettre à jour)
Si vous modifiez le code depuis un autre ordinateur (ou si quelqu'un d'autre contribue), pensez à récupérer la dernière version **avant** de commencer à travailler :
- Allez dans le menu Source Control > `...` (les 3 petits points) > `Pull`.
