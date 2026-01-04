# 📦 Système de Persistance - PromptoDYS Editor

## Vue d'ensemble

L'éditeur PromptoDYS implémente un **système de persistance automatique et complet** utilisant `localStorage` du navigateur. Toutes les données sont automatiquement sauvegardées et restaurées, même après fermeture complète du navigateur.

## ✅ Données persistées

### 1. **Contenu de l'éditeur**
- **Clé localStorage** : `editor-refresh-backup`
- **Fichier source** : [`src/hooks/useEditor.js`](file:///c:/Users/JEAN-NOELLEFEBVRE-SA/CascadeProjects/editor/src/hooks/useEditor.js#L5-L33)
- **Fonction** : `getInitialContent()`
- **Contenu sauvegardé** :
  - Le HTML complet de l'éditeur (texte formaté)
  - Les images insérées (via leurs URLs blob ou base64)
  - Le mode de vue actif (WYSIWYG, Markdown, HTML)
  - Un timestamp de sauvegarde

**Mécanisme** :
```javascript
const refreshData = {
  content: content,        // HTML complet avec images
  viewMode: viewMode,      // 'wysiwyg', 'markdown', ou 'html'
  timestamp: Date.now()
};
localStorage.setItem('editor-refresh-backup', JSON.stringify(refreshData));
```

**Restauration** :
- Au chargement de l'application, `getInitialContent()` vérifie la présence de données sauvegardées
- Si trouvées, le contenu est restauré automatiquement
- **Persistance infinie** : pas de limite de temps

### 2. **Mode de vue**
- **Fichier source** : [`src/hooks/useEditor.js`](file:///c:/Users/JEAN-NOELLEFEBVRE-SA/CascadeProjects/editor/src/hooks/useEditor.js#L38-L66)
- **Restauration** : Lignes 38-66
- **Comportement** :
  - Restaure le dernier mode utilisé (WYSIWYG, Markdown, HTML)
  - Le mode par défaut est `wysiwyg` si aucune sauvegarde
  - Nettoyage de la sauvegarde après 1 seconde (ligne 54)

### 3. **Thème personnalisé**
- **Clé localStorage** : `dysThemeSettings`
- **Fichier source** : [`src/hooks/useThemeSettings.js`](file:///c:/Users/JEAN-NOELLEFEBVRE-SA/CascadeProjects/editor/src/hooks/useThemeSettings.js#L54-L62)
- **Paramètres sauvegardés** :
  - Couleur de fond (`backgroundColor`)
  - Couleur du texte (`textColor`)
  - Police de caractères (`fontFamily`)
  - Taille de police (`fontSize`)
  - Interlignage (`lineHeight`)

**Mécanisme** :
```javascript
// Sauvegarde automatique à chaque changement
useEffect(() => {
  localStorage.setItem('dysThemeSettings', JSON.stringify(settings));
  applyThemeToDocument();
}, [settings]);

// Restauration au chargement
const [settings, setSettings] = useState(() => {
  const saved = localStorage.getItem('dysThemeSettings');
  return saved ? JSON.parse(saved) : defaultSettings;
});
```

### 4. **Police sélectionnée**
- **Clé localStorage** : `editor-font`
- **Fichier source** : [`src/hooks/useEditor.js`](file:///c:/Users/JEAN-NOELLEFEBVRE-SA/CascadeProjects/editor/src/hooks/useEditor.js#L293-L297)
- **Restauration** : Ligne 70
- **Par défaut** : `'system-ui, -apple-system, sans-serif'`

## 🔄 Déclenchement de la sauvegarde

### Sauvegarde automatique du contenu
- **Fichier** : [`src/App.js`](file:///c:/Users/JEAN-NOELLEFEBVRE-SA/CascadeProjects/editor/src/App.js#L52-L83)
- **Déclencheurs** :
  1. À chaque modification du contenu (`useEffect` sur `content`)
  2. Avant fermeture/refresh de la page (événement `beforeunload`)

```javascript
// Sauvegarde à chaque changement de contenu
useEffect(() => {
  const saveForRefresh = () => { /* ... */ };
  if (content) {
    saveForRefresh();
  }
  
  // Sauvegarde avant fermeture
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [content, viewMode]);
```

## 🖼️ Gestion spéciale des images

Les images sont **automatiquement persistées** car :
1. Elles sont insérées dans le DOM de l'éditeur avec leurs URLs
2. Le HTML complet (incluant les balises `<img>`) est sauvegardé
3. Les blob URLs sont stockés en mémoire via `blobStorageRef`

**Note importante** : Les blob URLs peuvent devenir invalides après fermeture complète du navigateur. Pour une persistance complète, il faudrait convertir les blobs en base64 avant sauvegarde.

## 📊 Logs de débogage

Le système inclut des logs console détaillés pour le suivi :

```javascript
console.log('💾 [App.js] Sauvegarde pour refresh:', {...});
console.log('🔍 [useEditor] Vérification sauvegarde refresh...');
console.log('✅ [useEditor] Restauration du contenu sauvegardé!');
```

Préfixes utilisés :
- `💾` : Opération de sauvegarde
- `🔍` : Vérification/recherche
- `✅` : Succès
- `❌` : Erreur
- `📦` : Données trouvées
- `⏱️` : Informations temporelles

## 🔐 Sécurité et limitations

### Limitations de localStorage
- **Taille maximale** : ~5-10 MB selon le navigateur
- **Domaine** : Les données sont liées au domaine (localhost:3001)
- **Persistance** : Tant que le cache du navigateur n'est pas vidé

### Données volatiles (non persistées)
- Position du curseur
- Sélection de texte active
- État de l'image sélectionnée (`selectedImage`)
- Blobs en mémoire (`blobStorageRef`)

## 🚀 Cas d'usage

### ✅ Scénarios fonctionnels
1. **Refresh de page (F5)** : Tout est restauré
2. **Fermeture et réouverture du navigateur** : Contenu + thème restaurés
3. **Changement de mode de vue** : Le mode est sauvegardé
4. **Personnalisation du thème** : Paramètres conservés

### ⚠️ Scénarios à considérer
1. **Vidage du cache** : Toutes les données sont perdues
2. **Navigation privée** : localStorage peut être désactivé
3. **Changement de port** : Les données sont liées au domaine

## 📝 Architecture des fichiers

```
src/
├── App.js                          # Sauvegarde du contenu avant unload
├── hooks/
│   ├── useEditor.js               # Restauration contenu + mode
│   └── useThemeSettings.js        # Gestion persistance thème
└── components/
    └── Editor.js                   # Affichage du contenu restauré
```

## 🔧 Maintenance

Pour modifier le comportement de persistance :
1. **Ajouter une donnée** : Modifier `refreshData` dans `App.js` ligne 54
2. **Changer la durée** : Actuellement persistance infinie (ligne 19, `useEditor.js`)
3. **Nettoyer les données** : `localStorage.removeItem('editor-refresh-backup')`

---

**Version** : 1.0  
**Dernière mise à jour** : 2026-01-05  
**Auteur** : Documentation générée par analyse du code source
