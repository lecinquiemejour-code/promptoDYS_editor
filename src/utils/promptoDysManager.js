/**
 * Gestionnaire ultra-minimaliste pour les URLs d'images PromptoDYS
 * Utilisé uniquement pour assurer la compatibilité d'affichage des images
 * dont le chemin relatif est ./assets/
 */

let currentProjectDirectory = null;
let currentProjectName = null;

/**
 * Récupère le document PromptoDYS actuel (pour compatibilité avec Editor.js)
 */
export const getCurrentProject = () => {
  return {
    directory: currentProjectDirectory,
    name: currentProjectName
  };
};

/**
 * Convertit une URL relative PromptoDYS en Blob URL pour affichage
 */
export const convertPromptoDysUrlToBlob = async (relativeUrl, documentDirectory) => {
  if (!relativeUrl || !documentDirectory || !relativeUrl.startsWith('./assets/')) {
    return relativeUrl;
  }

  try {
    const fileName = relativeUrl.replace('./assets/', '');
    const assetsHandle = await documentDirectory.getDirectoryHandle('assets');
    const fileHandle = await assetsHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (error) {
    console.error(`❌ Erreur conversion Blob URL pour ${relativeUrl}:`, error);
    return relativeUrl;
  }
};

/**
 * Convertit toutes les URLs relatives PromptoDYS en Blob URLs dans un contenu HTML
 */
export const convertAllPromptoDysUrlsToBlobs = async (htmlContent, documentDirectory) => {
  if (!htmlContent || !documentDirectory) {
    return htmlContent;
  }

  const imageRegex = /<img[^>]+src=["']\.\/assets\/([^"']+)["'][^>]*>/g;
  const matches = [...htmlContent.matchAll(imageRegex)];

  if (matches.length === 0) return htmlContent;

  let updatedContent = htmlContent;
  for (const match of matches) {
    const fullMatch = match[0];
    const fileName = match[1];
    const relativeUrl = `./assets/${fileName}`;
    const blobUrl = await convertPromptoDysUrlToBlob(relativeUrl, documentDirectory);

    if (blobUrl !== relativeUrl) {
      const updatedImg = fullMatch.replace(relativeUrl, blobUrl);
      updatedContent = updatedContent.replace(fullMatch, updatedImg);
    }
  }
  return updatedContent;
};
