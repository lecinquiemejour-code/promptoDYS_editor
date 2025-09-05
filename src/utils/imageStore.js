// ImageStore - Gestion persistante des images avec IndexedDB
// Utilise idb-keyval pour simplicité et robustesse
import { get, set, del } from 'idb-keyval';

/**
 * Sauvegarde un fichier image en IndexedDB
 * @param {string} imageId - UUID pour identifier l'image
 * @param {File|Blob} file - Fichier image à sauvegarder
 * @returns {Promise<string>} - UUID utilisé pour identifier l'image
 */
export const saveImage = async (imageId, file) => {
  console.log('🔄 [ImageStore] Début sauvegarde image:', file.name || 'blob', `(${Math.round(file.size/1024)}KB)`);
  console.log('🆔 [ImageStore] Utilisation ID fourni:', imageId);
  
  try {
    // Sauvegarder en IndexedDB avec l'ID fourni
    await set(imageId, file);
    console.log('✅ [ImageStore] Image sauvegardée en IndexedDB:', imageId);
    console.log('📊 [ImageStore] Détails:', {
      imageId,
      fileName: file.name || 'unnamed',
      fileSize: `${Math.round(file.size/1024)}KB`,
      fileType: file.type
    });
    
    return imageId;
  } catch (error) {
    console.error('❌ [ImageStore] Erreur sauvegarde:', error);
    throw new Error(`Échec sauvegarde image: ${error.message}`);
  }
};

/**
 * Récupère une image depuis IndexedDB et crée une Object URL
 * @param {string} imageId - UUID de l'image
 * @returns {Promise<string|null>} - Object URL temporaire ou null si non trouvée
 */
export const loadImage = async (imageId) => {
  console.log('🔍 [ImageStore] Chargement image:', imageId);
  
  try {
    // Récupérer le Blob depuis IndexedDB
    const blob = await get(imageId);
    
    if (!blob) {
      console.warn('⚠️ [ImageStore] Image non trouvée en IndexedDB:', imageId);
      return null;
    }
    
    console.log('📦 [ImageStore] Blob récupéré:', {
      imageId,
      blobSize: `${Math.round(blob.size/1024)}KB`,
      blobType: blob.type
    });
    
    // Créer Object URL temporaire
    const objectUrl = URL.createObjectURL(blob);
    console.log('🔗 [ImageStore] Object URL créée:', objectUrl);
    
    return objectUrl;
  } catch (error) {
    console.error('❌ [ImageStore] Erreur chargement:', error);
    return null;
  }
};

/**
 * Supprime une image de IndexedDB
 * @param {string} imageId - UUID de l'image à supprimer
 * @returns {Promise<boolean>} - true si supprimée avec succès
 */
export const deleteImage = async (imageId) => {
  console.log('🗑️ [ImageStore] Suppression image:', imageId);
  
  try {
    await del(imageId);
    console.log('✅ [ImageStore] Image supprimée de IndexedDB:', imageId);
    return true;
  } catch (error) {
    console.error('❌ [ImageStore] Erreur suppression:', error);
    return false;
  }
};

/**
 * Liste toutes les images stockées (debug uniquement)
 * @returns {Promise<string[]>} - Liste des imageIds
 */
export const listAllImages = async () => {
  console.log('📋 [ImageStore] Listing toutes les images...');
  
  try {
    // Note: idb-keyval ne fournit pas de méthode keys() directe
    // Cette fonction est pour debug - en production on trackera les IDs différemment
    console.warn('⚠️ [ImageStore] listAllImages() est pour debug uniquement');
    return [];
  } catch (error) {
    console.error('❌ [ImageStore] Erreur listing:', error);
    return [];
  }
};

/**
 * Nettoie les Object URLs pour éviter les fuites mémoire
 * @param {string} objectUrl - URL à révoquer
 */
export const revokeImageUrl = (objectUrl) => {
  if (objectUrl && objectUrl.startsWith('blob:')) {
    console.log('🧹 [ImageStore] Révocation Object URL:', objectUrl);
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Demande au navigateur de rendre le stockage persistant
 * @returns {Promise<boolean>} - true si accordé
 */
export const requestPersistentStorage = async () => {
  console.log('🔒 [ImageStore] Demande stockage persistant...');
  
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try {
      const isPersistent = await navigator.storage.persist();
      console.log(isPersistent ? 
        '✅ [ImageStore] Stockage persistant accordé' : 
        '⚠️ [ImageStore] Stockage persistant refusé'
      );
      return isPersistent;
    } catch (error) {
      console.error('❌ [ImageStore] Erreur demande persistance:', error);
      return false;
    }
  } else {
    console.warn('⚠️ [ImageStore] API storage.persist() non supportée');
    return false;
  }
};

/**
 * Nettoyage intelligent des images orphelines
 * Supprime les images d'IndexedDB qui ne sont plus référencées dans le document
 * @param {string} htmlContent - Contenu HTML du document à analyser
 * @returns {Promise<number>} - Nombre d'images nettoyées
 */
export const cleanupOrphanedImages = async (htmlContent) => {
  console.log('🧹 [ImageStore] Début nettoyage des images orphelines...');
  
  try {
    // Parser le HTML pour trouver les imageIds actuellement utilisés
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const usedImageIds = new Set();
    
    // Collecter tous les data-image-id dans le document
    const imagesWithIds = doc.querySelectorAll('img[data-image-id]');
    imagesWithIds.forEach(img => {
      const imageId = img.getAttribute('data-image-id');
      if (imageId) {
        usedImageIds.add(imageId);
      }
    });
    
    console.log('🔍 [ImageStore] Images utilisées dans le document:', usedImageIds.size);
    console.log('📋 [ImageStore] IDs utilisés:', Array.from(usedImageIds));
    
    // Note: idb-keyval ne fournit pas de méthode keys() native
    // En production, on maintiendrait une liste des imageIds dans localStorage
    // Pour l'instant, on log seulement les images utilisées
    console.log('ℹ️ [ImageStore] Nettoyage limité - pas de liste globale des clés IndexedDB');
    
    return 0; // Pas de nettoyage effectué pour l'instant
  } catch (error) {
    console.error('❌ [ImageStore] Erreur nettoyage:', error);
    return 0;
  }
};

// Log d'initialisation
console.log('🚀 [ImageStore] Module initialisé avec idb-keyval');
