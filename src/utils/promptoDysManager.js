/**
 * Gestionnaire pour le système de fichiers PromptoDYS
 * Gère l'organisation des documents et images dans une structure cohérente
 */

/**
 * Vérifie si la File System Access API est disponible
 */
export const isFileSystemAccessSupported = () => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

/**
 * Génère un nom de dossier basé sur un timestamp
 * Format: Document_YYYYMMDD_HHMM
 */
export const generateTimestampFolderName = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `Document_${year}${month}${day}_${hours}${minutes}`;
};

/**
 * Génère un nom de fichier image unique avec timestamp
 */
export const generateImageFileName = (originalName, extension) => {
  const now = new Date();
  const timestamp = now.getFullYear().toString() + 
                   String(now.getMonth() + 1).padStart(2, '0') +
                   String(now.getDate()).padStart(2, '0') + '_' +
                   String(now.getHours()).padStart(2, '0') +
                   String(now.getMinutes()).padStart(2, '0') +
                   String(now.getSeconds()).padStart(2, '0');
  
  const baseName = originalName.replace(/\.[^/.]+$/, "") || 'image';
  return `${baseName}_${timestamp}.${extension}`;
};

/**
 * État global du répertoire de travail actuel
 */
let currentProjectDirectory = null;
let currentProjectName = null;

/**
 * Définit le document PromptoDYS actuel
 */
export const setCurrentProject = (documentHandle, documentName) => {
  currentProjectDirectory = documentHandle;
  currentProjectName = documentName;
  
  // Sauvegarder en localStorage pour persistance
  if (documentName) {
    localStorage.setItem('currentPromptoDysProject', documentName);
    localStorage.setItem('promptoDysConnected', 'true');
    console.log('💾 Document sauvé en localStorage:', documentName);
  }
};

/**
 * Récupère le document PromptoDYS actuel
 */
export const getCurrentProject = () => {
  return {
    directory: currentProjectDirectory,
    name: currentProjectName
  };
};

/**
 * Récupère le nom du dernier workspace PromptoDYS utilisé
 */
export const getLastWorkspaceName = () => {
  try {
    const savedWorkspace = localStorage.getItem('promptoDysWorkspaceHandle');
    if (savedWorkspace) {
      const workspace = JSON.parse(savedWorkspace);
      return workspace.name || null;
    }
  } catch (error) {
    console.error('❌ Erreur récupération nom workspace:', error);
  }
  return null;
};

/**
 * Initialise le workspace PromptoDYS
 * Demande à l'utilisateur de sélectionner le dossier PromptoDYS
 */
export const initializePromptoDysWorkspace = async (skipDialog = false) => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API non supportée');
  }

  // Si skipDialog est true, essayer de restaurer le workspace existant
  if (skipDialog) {
    console.log('🔍 Tentative restauration workspace silencieuse...');
    // Pour skipDialog, on ne peut pas demander de nouvelle sélection
    // On retourne null pour signaler l'échec de restauration silencieuse
    return null;
  }

  try {
    // Demander à l'utilisateur de sélectionner le dossier PromptoDYS
    console.log('🗂️ Sélection du dossier PromptoDYS...');
    const promptoDysHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    // Sauvegarder la référence du workspace (sans créer de document)
    localStorage.setItem('promptoDysWorkspaceHandle', JSON.stringify({
      name: promptoDysHandle.name,
      timestamp: new Date().toISOString()
    }));

    console.log('✅ Workspace PromptoDYS configuré:', promptoDysHandle.name);
    return promptoDysHandle;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Sélection du dossier PromptoDYS annulée.');
    } else {
      console.error('❌ Erreur initialisation PromptoDYS:', error);
      throw error;
    }
  }
};

/**
 * Crée un nouveau document PromptoDYS avec un nom timestamp
 */
export const createPromptoDysDocument = async (promptoDysDirectory) => {
  if (!promptoDysDirectory) {
    // Tenter de récupérer le workspace depuis initializePromptoDysWorkspace
    try {
      const workspace = await initializePromptoDysWorkspace();
      promptoDysDirectory = workspace;
    } catch (error) {
      console.error('❌ Impossible d\'initialiser le workspace:', error);
      return null;
    }
  }

  try {
    const documentName = generateTimestampFolderName();
    
    // Créer le dossier du document
    const documentHandle = await promptoDysDirectory.getDirectoryHandle(documentName, {
      create: true
    });
    
    // Créer le dossier assets
    await documentHandle.getDirectoryHandle('assets', {
      create: true
    });
    
    // Définir comme document actuel
    setCurrentProject(documentHandle, documentName);
    
    console.log('✅ Nouveau document PromptoDYS créé:', documentName);
    return documentHandle;
  } catch (error) {
    console.error('❌ Erreur création document PromptoDYS:', error);
    return null;
  }
};

/**
 * Crée ou récupère un document PromptoDYS avec un nom personnalisé
 */
export const createOrGetPromptoDysDocument = async (promptoDysDirectory, documentName) => {
  if (!promptoDysDirectory) {
    // Tenter de récupérer le workspace depuis initializePromptoDysWorkspace
    try {
      const workspace = await initializePromptoDysWorkspace();
      promptoDysDirectory = workspace;
    } catch (error) {
      console.error('❌ Impossible d\'initialiser le workspace:', error);
      return null;
    }
  }

  try {
    // Créer ou récupérer le dossier du document
    const documentHandle = await promptoDysDirectory.getDirectoryHandle(documentName, {
      create: true
    });
    
    // Créer le dossier assets s'il n'existe pas
    await documentHandle.getDirectoryHandle('assets', {
      create: true
    });
    
    // Définir comme document actuel
    setCurrentProject(documentHandle, documentName);
    
    console.log('✅ Document PromptoDYS configuré:', documentName);
    return documentHandle;
  } catch (error) {
    console.error('❌ Erreur configuration document PromptoDYS:', error);
    return null;
  }
};

/**
 * Sauvegarde une image dans le dossier assets du document actuel
 */
export const saveImageToPromptoDys = async (imageFile, documentDirectory) => {
  if (!documentDirectory) return null;

  try {
    // Obtenir le dossier assets
    const assetsHandle = await documentDirectory.getDirectoryHandle('assets', {
      create: true
    });
    
    // Générer un nom de fichier unique
    const fileExtension = imageFile.name.split('.').pop().toLowerCase();
    const fileName = generateImageFileName(imageFile.name, fileExtension);
    
    // Créer le fichier image
    const fileHandle = await assetsHandle.getFileHandle(fileName, {
      create: true
    });
    
    // Écrire les données
    const writable = await fileHandle.createWritable();
    await writable.write(imageFile);
    await writable.close();
    
    console.log('✅ Image sauvegardée:', fileName);
    
    // Retourner le chemin relatif pour Markdown
    const relativePath = `./assets/${fileName}`;
    
    console.log('📁 Image sauvée avec chemin relatif:', relativePath);
    return relativePath;
  } catch (error) {
    console.error('❌ Erreur sauvegarde image:', error);
    return null;
  }
};

/**
 * Sauvegarde le fichier Markdown dans le document PromptoDYS
 */
export const saveMarkdownToPromptoDys = async (content, documentDirectory, fileName) => {
  if (!documentDirectory) return false;

  try {
    const mdFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    
    const fileHandle = await documentDirectory.getFileHandle(mdFileName, {
      create: true
    });
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    console.log('✅ Fichier Markdown sauvegardé:', mdFileName);
    return true;
  } catch (error) {
    console.error('❌ Erreur sauvegarde Markdown:', error);
    return false;
  }
};

/**
 * Liste les documents PromptoDYS disponibles
 */
export const listPromptoDysDocuments = async (promptoDysDirectory) => {
  if (!promptoDysDirectory) return [];

  try {
    const documents = [];
    
    for await (const [name, handle] of promptoDysDirectory.entries()) {
      if (handle.kind === 'directory' && name.startsWith('Document_')) {
        // Vérifier s'il y a un fichier .md dans le dossier
        try {
          let hasMarkdown = false;
          for await (const [fileName, fileHandle] of handle.entries()) {
            if (fileHandle.kind === 'file' && fileName.endsWith('.md')) {
              hasMarkdown = true;
              break;
            }
          }
          
          if (hasMarkdown) {
            documents.push({
              name,
              handle,
              displayName: name.replace('Document_', '').replace(/_/g, '/')
            });
          }
        } catch (error) {
          // Ignorer les dossiers inaccessibles
        }
      }
    }
    
    // Trier par nom (plus récent en premier)
    return documents.sort((a, b) => b.name.localeCompare(a.name));
  } catch (error) {
    console.error('❌ Erreur liste documents:', error);
    return [];
  }
};

/**
 * Réinitialise le document actuel (pour nouveau document)
 */
export const resetCurrentDocument = () => {
  currentProjectDirectory = null;
  currentProjectName = null;
  localStorage.removeItem('currentPromptoDysProject');
  localStorage.removeItem('promptoDysConnected');
  console.log('🔄 Document PromptoDYS réinitialisé');
};

/**
 * Vérifie si PromptoDYS était connecté précédemment
 */
export const isPromptoDysConnected = () => {
  return localStorage.getItem('promptoDysConnected') === 'true';
};

/**
 * Tente de restaurer le workspace et document depuis localStorage
 */
export const restorePromptoDysState = async () => {
  if (!isPromptoDysConnected()) {
    return { workspace: null, document: null };
  }

  try {
    // Restaurer le workspace
    const workspace = await initializePromptoDysWorkspace();
    if (!workspace) {
      return { workspace: null, document: null };
    }

    // Restaurer le document actuel
    const savedDocumentName = localStorage.getItem('currentPromptoDysProject');
    if (savedDocumentName) {
      try {
        const documentHandle = await workspace.getDirectoryHandle(savedDocumentName);
        setCurrentProject(documentHandle, savedDocumentName);
        console.log('✅ Document PromptoDYS restauré:', savedDocumentName);
        return { workspace, document: documentHandle };
      } catch (error) {
        console.warn('⚠️ Document sauvé introuvable, en créer un nouveau:', savedDocumentName);
      }
    }

    return { workspace, document: null };
  } catch (error) {
    console.error('❌ Erreur restauration PromptoDYS:', error);
    // Nettoyer localStorage si restauration échoue
    localStorage.removeItem('promptoDysConnected');
    localStorage.removeItem('currentPromptoDysProject');
    return { workspace: null, document: null };
  }
};

/**
 * Crée automatiquement un document après connexion workspace
 */
export const ensureCurrentDocument = async (workspace) => {
  if (!workspace) return null;
  
  // Vérifier si on a déjà un document actuel
  const current = getCurrentProject();
  if (current.directory) {
    return current.directory;
  }

  // Créer un nouveau document
  return await createPromptoDysDocument(workspace);
};

/**
 * Obtient une référence au workspace PromptoDYS principal
 */
export const getPromptoDysWorkspace = async () => {
  try {
    return await initializePromptoDysWorkspace();
  } catch (error) {
    console.error('❌ Impossible d\'obtenir le workspace PromptoDYS:', error);
    return null;
  }
};

/**
 * Convertit une URL relative PromptoDYS en Blob URL pour affichage
 */
export const convertPromptoDysUrlToBlob = async (relativeUrl, documentDirectory) => {
  if (!relativeUrl || !documentDirectory || !relativeUrl.startsWith('./assets/')) {
    return relativeUrl; // Retourner l'URL originale si pas une URL PromptoDYS
  }

  try {
    // Extraire le nom de fichier depuis l'URL relative
    const fileName = relativeUrl.replace('./assets/', '');
    
    // Accéder au dossier assets
    const assetsHandle = await documentDirectory.getDirectoryHandle('assets');
    
    // Récupérer le fichier
    const fileHandle = await assetsHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    
    // Créer une Blob URL temporaire
    const blobUrl = URL.createObjectURL(file);
    
    console.log(`✅ Blob URL créée: ${fileName} -> ${blobUrl}`);
    return blobUrl;
  } catch (error) {
    console.error(`❌ Erreur conversion Blob URL pour ${relativeUrl}:`, error);
    return relativeUrl; // Fallback sur l'URL originale
  }
};

/**
 * Convertit toutes les URLs relatives PromptoDYS en Blob URLs dans un contenu HTML
 */
export const convertAllPromptoDysUrlsToBlobs = async (htmlContent, documentDirectory) => {
  if (!htmlContent || !documentDirectory) {
    return htmlContent;
  }

  // Regex pour trouver toutes les URLs d'images PromptoDYS
  const imageRegex = /<img[^>]+src=["']\.\/assets\/([^"']+)["'][^>]*>/g;
  const matches = [...htmlContent.matchAll(imageRegex)];
  
  if (matches.length === 0) {
    return htmlContent; // Pas d'images PromptoDYS trouvées
  }

  let updatedContent = htmlContent;
  
  // Traiter chaque image trouvée
  for (const match of matches) {
    const fullMatch = match[0];
    const fileName = match[1];
    const relativeUrl = `./assets/${fileName}`;
    
    // Convertir en Blob URL
    const blobUrl = await convertPromptoDysUrlToBlob(relativeUrl, documentDirectory);
    
    // Remplacer dans le contenu si la conversion a réussi
    if (blobUrl !== relativeUrl) {
      const updatedImg = fullMatch.replace(relativeUrl, blobUrl);
      updatedContent = updatedContent.replace(fullMatch, updatedImg);
    }
  }
  
  return updatedContent;
};

/**
 * Vérifie si PromptoDYS est supporté
 */
export const isPromptoDysSupported = () => {
  return isFileSystemAccessSupported();
};
