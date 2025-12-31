import React, { useState } from 'react';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownConverter';
import { saveImage, loadImage } from '../utils/imageStore';
// Removed PromptoDYS imports - using simplified project management

const Toolbar = ({ 
  content, 
  setContent, 
  viewMode, 
  onViewModeChange, 
  currentFormat, 
  onFormatChange, 
  editorRef,
  onThemeSettingsToggle,
  ignoreSelectionChangeRef,
  storeBlobForUrl,
  getBlobFromUrl,
  getAllBlobs
}) => {
  // IndexedDB supprimé - éditeur volatil uniquement

  // États pour la modal de sauvegarde
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [documentName, setDocumentName] = useState('MonDocument');
  const [isSaving, setIsSaving] = useState(false);

  // États pour les couleurs et formats
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // État pour la modal d'export OneNote
  const [showOneNoteExportModal, setShowOneNoteExportModal] = useState(false);
  
  // États pour la modal d'import HTML
  const [showImportHtmlModal, setShowImportHtmlModal] = useState(false);
  const [importedFileName, setImportedFileName] = useState('');

  // Vérifier le support File System Access API
  const isFileSystemAccessSupported = () => {
    return 'showDirectoryPicker' in window && 'showOpenFilePicker' in window;
  };

  // Fonctions pour les fichiers Markdown
  const handleCopyMarkdown = async () => {
    const editor = document.querySelector('.editor-scroll .prose');
    if (!editor) return;
    
    const markdown = htmlToMarkdown(content);
    
    try {
      await navigator.clipboard.writeText(markdown);
      console.log('Markdown copié dans le presse-papier');
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  // Créer un blob unique pour éviter les conflits d'URL
  const createUniqueBlob = (file, storeBlobForUrl) => {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const uniqueName = `${uniqueId}_${file.name}`;
    const uniqueFile = new File([file], uniqueName, { type: file.type });
    const blobUrl = URL.createObjectURL(uniqueFile);
    
    console.log('🔗 URL blob unique créée:', blobUrl);
    
    // Stocker le blob pour récupération ultérieure
    if (storeBlobForUrl) {
      storeBlobForUrl(blobUrl, uniqueFile);
    }
    
    return { blobUrl, uniqueFile };
  };

  // Générer un nom de fichier unique avec timestamp
  const generateImageFileName = (originalName, extension) => {
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

  // Fonction pour convertir une image blob/URL en base64
  const convertImageToBase64 = async (imageUrl) => {
    try {
      // Si c'est une URL blob:, récupérer le blob stocké ou fetch
      let blob;
      if (imageUrl.startsWith('blob:') && getBlobFromUrl) {
        const storedFile = getBlobFromUrl(imageUrl);
        if (storedFile) {
          blob = storedFile;
        } else {
          const response = await fetch(imageUrl);
          blob = await response.blob();
        }
      } else {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Erreur conversion image base64:', error);
      return imageUrl; // Retourner l'URL originale en cas d'erreur
    }
  };

  // Fonction pour extraire le texte brut avec retours à la ligne préservés
  const extractPlainTextWithLineBreaks = (html) => {
    console.log('📝 [OneNote Export] Extraction texte brut avec retours à la ligne...');
    
    // Créer un parser temporaire
    const tempParser = new DOMParser();
    const tempDoc = tempParser.parseFromString(html, 'text/html');
    
    // Fonction récursive pour extraire le texte avec les retours à la ligne
    const extractTextContent = (element) => {
      let text = '';
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          // Préserver les retours à la ligne dans le texte
          text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          
          // Ajouter des retours à la ligne avant/après certaines balises
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            text += '\n' + extractTextContent(node) + '\n';
          } else if (['p', 'div'].includes(tagName)) {
            text += extractTextContent(node) + '\n';
          } else if (tagName === 'br') {
            text += '\n';
          } else if (tagName === 'li') {
            text += '• ' + extractTextContent(node) + '\n';
          } else {
            text += extractTextContent(node);
          }
        }
      }
      return text;
    };
    
    const plainText = extractTextContent(tempDoc.body)
      .replace(/\n\n+/g, '\n\n') // Réduire les retours multiples
      .trim();
    
    console.log('📝 [OneNote Export] Texte brut extrait:', plainText.substring(0, 100) + '...');
    return plainText;
  };

  // Fonction pour formater le HTML spécifiquement pour OneNote
  const formatHtmlForOneNote = (html) => {
    console.log('🔧 [OneNote Export] Formatage HTML pour OneNote...');
    
    return html
      // NOUVEAU : Convertir les retours à la ligne bruts en <br> dans le texte
      .replace(/([^>])\n([^<])/g, '$1<br>\n$2')
      
      // Normaliser les div en paragraphes pour OneNote
      .replace(/<div([^>]*)>/gi, '<p$1>')
      .replace(/<\/div>/gi, '</p>')
      
      // Convertir les BR isolés en fins de paragraphes
      .replace(/<br\s*\/?>\ s*<br\s*\/?>/gi, '</p><p>')
      .replace(/<br\s*\/?>/gi, '<br>')
      
      // Nettoyer les paragraphes vides
      .replace(/<p[^>]*>\s*<\/p>/gi, '<p>&nbsp;</p>')
      
      // Ajouter des retours à la ligne après les balises fermantes pour la lisibilité
      .replace(/<\/(h[1-6]|p|ul|ol|li)>/gi, '</$1>\n')
      
      // Nettoyer les espaces et retours à la ligne multiples
      .replace(/\n\s*\n/g, '\n')
      .trim();
  };

  // Fonction pour parser et importer un fichier HTML/MHTML
  const handleImportHTML = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📥 [HTML Import] Début import fichier:', file.name, '| Type:', file.type, '| Taille:', file.size);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          console.log('📄 [HTML Import] Contenu lu, longueur:', fileContent.length);
          
          let htmlContent = '';
          
          // Détecter le format du fichier
          if (file.name.toLowerCase().endsWith('.mht') || file.name.toLowerCase().endsWith('.mhtml') || 
              fileContent.includes('Content-Type: multipart/related')) {
            // Format MHTML (OneNote) - extraire la partie HTML principale
            console.log('🔍 [HTML Import] Format MHTML détecté');
            htmlContent = parseMHTMLContent(fileContent);
          } else {
            // Format HTML standard
            console.log('🔍 [HTML Import] Format HTML standard détecté');
            htmlContent = parseHTMLContent(fileContent);
          }
          
          if (!htmlContent || htmlContent.trim() === '') {
            throw new Error('Aucun contenu HTML valide trouvé dans le fichier');
          }
          
          console.log('✅ [HTML Import] HTML extrait, longueur:', htmlContent.length);
          console.log('📝 [HTML Import] Aperçu HTML:', htmlContent.substring(0, 300) + '...');
          
          // Nettoyer et injecter le contenu dans l'éditeur
          const cleanedHTML = cleanImportedHTML(htmlContent);
          
          if (editorRef.current) {
            editorRef.current.innerHTML = cleanedHTML;
            // Déclencher l'événement de changement pour mettre à jour l'état
            const inputEvent = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(inputEvent);
          }
          
          // Basculer en mode WYSIWYG après l'import
          onViewModeChange('wysiwyg');
          
          // Afficher la modal de confirmation
          setImportedFileName(file.name);
          setShowImportHtmlModal(true);
          
          console.log('✅ [HTML Import] Import terminé avec succès');
          
        } catch (error) {
          console.error('❌ [HTML Import] Erreur traitement fichier:', error);
          alert(`❌ Erreur lors de l'import du fichier:\n${error.message}`);
        }
      };
      
      reader.onerror = () => {
        console.error('❌ [HTML Import] Erreur lecture fichier');
        alert('❌ Erreur lors de la lecture du fichier');
      };
      
      reader.readAsText(file, 'utf-8');
      
    } catch (error) {
      console.error('❌ [HTML Import] Erreur générale:', error);
      alert(`❌ Erreur lors de l'import:\n${error.message}`);
    }
    
    // Reset l'input pour permettre de recharger le même fichier
    event.target.value = '';
  };

  // Parser pour contenu MHTML (OneNote)
  const parseMHTMLContent = (mhtmlContent) => {
    console.log('🔍 [MHTML Parser] Analyse du contenu MHTML...');
    
    // Les fichiers MHTML contiennent plusieurs parties séparées par des boundaries
    // La partie HTML principale est généralement la première partie avec Content-Type: text/html
    
    const lines = mhtmlContent.split('\n');
    let inHTMLPart = false;
    let htmlLines = [];
    let foundContentType = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Détecter le début d'une partie HTML
      if (line.toLowerCase().includes('content-type: text/html')) {
        console.log('📍 [MHTML Parser] Partie HTML trouvée à la ligne', i);
        inHTMLPart = true;
        foundContentType = true;
        continue;
      }
      
      // Détecter les boundaries (fin de partie)
      if (line.startsWith('------') || (line.startsWith('--') && line.length > 10)) {
        if (inHTMLPart) {
          console.log('📍 [MHTML Parser] Fin de partie HTML à la ligne', i);
          break; // On a trouvé la partie HTML, on s'arrête
        }
        inHTMLPart = false;
        continue;
      }
      
      // Si on est dans la partie HTML et qu'on a passé l'en-tête
      if (inHTMLPart && foundContentType) {
        // Ignorer les en-têtes jusqu'à la ligne vide
        if (line.trim() === '' && htmlLines.length === 0) {
          continue; // Première ligne vide = fin des en-têtes
        }
        if (htmlLines.length > 0 || line.trim() !== '') {
          htmlLines.push(line);
        }
      }
    }
    
    const extractedHTML = htmlLines.join('\n').trim();
    console.log('📄 [MHTML Parser] HTML extrait, longueur:', extractedHTML.length);
    
    return extractedHTML;
  };

  // Parser pour contenu HTML standard
  const parseHTMLContent = (htmlContent) => {
    console.log('🔍 [HTML Parser] Analyse du contenu HTML standard...');
    
    // Pour HTML standard, extraire le contenu du body ou utiliser tel quel
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    
    if (bodyMatch) {
      console.log('📍 [HTML Parser] Contenu <body> trouvé');
      return bodyMatch[1].trim();
    } else {
      console.log('📍 [HTML Parser] Pas de <body>, utilisation du contenu complet');
      return htmlContent.trim();
    }
  };

  // Nettoyer le HTML importé pour l'éditeur
  const cleanImportedHTML = (html) => {
    console.log('🧹 [HTML Import] Nettoyage du HTML importé...');
    
    return html
      // Supprimer les scripts et styles pour la sécurité
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      
      // Supprimer les attributs indésirables mais garder les essentiels
      .replace(/\s*(?:class|id|style)="[^"]*"/gi, '')
      .replace(/\s*on\w+="[^"]*"/gi, '') // Supprimer les event handlers
      
      // Nettoyer les espaces multiples
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      
      // Assurer une structure propre
      .trim();
  };

  // Fonction pour exporter vers OneNote
  const handleExportToOneNote = async () => {
    try {
      console.log('🔄 [OneNote Export] Début export vers OneNote...');
      
      // Récupérer le HTML actuel
      const htmlContent = editorRef.current?.innerHTML || content;
      
      // Parser le HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Convertir toutes les images en base64
      const images = doc.querySelectorAll('img[src^="blob:"]');
      console.log('🔍 [OneNote Export] Images blob trouvées:', images.length);
      
      for (const img of images) {
        const base64Data = await convertImageToBase64(img.src);
        img.src = base64Data;
        console.log('✅ [OneNote Export] Image convertie en base64');
      }
      
      // Récupérer le HTML traité
      let cleanHtml = doc.body.innerHTML;
      
      // Supprimer les attributs spécifiques à l'éditeur
      cleanHtml = cleanHtml
        .replace(/\s*data-image-id="[^"]*"/gi, '') // Supprimer data-image-id
        .replace(/\s*class="[^"]*"/gi, '') // Supprimer les classes CSS
        .replace(/\s*contenteditable="[^"]*"/gi, '') // Supprimer contenteditable
        .replace(/\s*style="[^"]*resizable[^"]*"/gi, '') // Supprimer styles redimensionnement
        .replace(/\s*draggable="[^"]*"/gi, '') // Supprimer draggable
        .replace(/\s*data-resizable="[^"]*"/gi, ''); // Supprimer data-resizable
      
      // NOUVEAU : Formatage spécial OneNote pour préserver les retours à la ligne
      cleanHtml = formatHtmlForOneNote(cleanHtml);
      
      console.log('🧹 [OneNote Export] HTML nettoyé et formaté pour OneNote');
      console.log('📋 [OneNote Export] HTML final:', cleanHtml.substring(0, 200) + '...');
      
      // NOUVEAU : Extraire aussi le texte brut avec retours à la ligne (Option 3A)
      const plainText = extractPlainTextWithLineBreaks(cleanHtml);
      console.log('📝 [OneNote Export] Texte brut final:', plainText.substring(0, 200) + '...');
      
      // Créer l'élément ClipboardItem avec DOUBLE FORMAT (HTML + texte brut)
      const htmlBlob = new Blob([cleanHtml], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      });
      
      // Copier dans le presse-papier
      await navigator.clipboard.write([clipboardItem]);
      
      console.log('✅ [OneNote Export] Contenu copié dans le presse-papier');
      
      // Afficher la modal de confirmation
      setShowOneNoteExportModal(true);
      
    } catch (error) {
      console.error('❌ [OneNote Export] Erreur:', error);
      alert(`❌ Erreur lors de l'export OneNote:\n${error.message}`);
    }
  };

  // Fonction mutualisée pour traiter les images collées et les rendre uniques
  const processImageBlobs = async (container, storeBlobForUrl) => {
    console.log('🔄 [processImageBlobs] Traitement des images...');
    
    const images = container.querySelectorAll('img[src^="blob:"]');
    console.log('🔍 [processImageBlobs] Images blob trouvées:', images.length);
    
    for (const img of images) {
      const originalUrl = img.src;
      
      try {
        console.log('📥 [processImageBlobs] Traitement de:', originalUrl);
        
        // Récupérer le blob original
        const response = await fetch(originalUrl);
        const blob = await response.blob();
        
        // Créer un nouveau fichier unique à partir du blob
        const filename = `image_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
        const uniqueFile = new File([blob], filename, { type: blob.type });
        
        // Créer un nouveau blob URL unique
        const { blobUrl } = createUniqueBlob(uniqueFile, storeBlobForUrl);
        
        // Remplacer l'URL dans l'image
        img.src = blobUrl;
        console.log('✅ [processImageBlobs] Image mise à jour:', originalUrl, '->', blobUrl);
        
      } catch (error) {
        console.error('❌ [processImageBlobs] Erreur pour:', originalUrl, error);
      }
    }
  };

  // Validation pré-sauvegarde des images blob (mise à jour pour IndexedDB)
  const validateImagesBeforeSave = (htmlContent) => {
    console.log('🔍 [VALIDATION] Début validation des images avant sauvegarde...');
    
    // Parser le HTML avec DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Trouver toutes les images avec src blob: MAIS sans data-image-id (temporaires)
    const allBlobImages = doc.querySelectorAll('img[src^="blob:"]');
    const blobImages = Array.from(allBlobImages).filter(img => !img.hasAttribute('data-image-id'));
    
    // Trouver les images persistantes avec data-image-id
    const persistentImages = doc.querySelectorAll('img[data-image-id]');
    
    console.log('🔍 [VALIDATION] Images blob temporaires (sans data-image-id):', blobImages.length);
    console.log('🔍 [VALIDATION] Images persistantes (avec data-image-id):', persistentImages.length);
    console.log('🔍 [VALIDATION] Total images blob:', allBlobImages.length);
    
    // Les images persistantes sont toujours valides
    if (blobImages.length === 0) {
      console.log('✅ [VALIDATION] Aucune image blob temporaire à valider');
      console.log('✅ [VALIDATION] Images persistantes OK, sauvegarde autorisée');
      return { valid: true, missingBlobs: [], totalImages: blobImages.length + persistentImages.length };
    }
    
    // Récupérer les blobs disponibles en mémoire (ancien système)
    const availableBlobs = getAllBlobs ? getAllBlobs() : new Map();
    const storedBlobUrls = Array.from(availableBlobs.keys());
    console.log('🔍 [VALIDATION] Blobs temporaires en mémoire:', storedBlobUrls.length);
    console.log('🔍 [VALIDATION] URLs temporaires stockées:', storedBlobUrls);
    
    // Vérifier seulement les images blob: temporaires
    const missingBlobs = [];
    blobImages.forEach((img, index) => {
      const imageUrl = img.src;
      
      if (availableBlobs.has(imageUrl)) {
        const storedFile = availableBlobs.get(imageUrl);
        console.log(`✅ [VALIDATION] Blob temporaire trouvé pour image ${index + 1}:`, storedFile?.name, `(${storedFile?.size} bytes)`);
      } else {
        console.log(`❌ [VALIDATION] Blob temporaire MANQUANT pour image ${index + 1}:`, imageUrl);
        missingBlobs.push({
          index: index + 1,
          url: imageUrl,
          alt: img.alt || 'image sans nom'
        });
      }
    });
    
    const isValid = missingBlobs.length === 0;
    
    if (isValid) {
      console.log('✅ [VALIDATION] Validation réussie - toutes les images sont disponibles');
      console.log(`✅ [VALIDATION] Total: ${blobImages.length} blob temporaires + ${persistentImages.length} persistantes`);
    } else {
      console.log(`❌ [VALIDATION] Validation échouée - ${missingBlobs.length}/${blobImages.length} image(s) blob temporaire(s) manquante(s)`);
      console.log('❌ [VALIDATION] Images manquantes détail:', missingBlobs);
    }
    
    return {
      valid: isValid,
      missingBlobs: missingBlobs,
      totalImages: blobImages.length + persistentImages.length
    };
  };

  // Extraire et sauvegarder les images blob
  const extractAndSaveImages = async (htmlContent, documentDir) => {
    console.log('🔍 extractAndSaveImages appelée avec HTML:', htmlContent.substring(0, 200) + '...');
    
    // Parser le HTML avec DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Trouver toutes les images avec src blob:
    const images = doc.querySelectorAll('img[src^="blob:"]');
    
    console.log('🔍 Nombre d\'images trouvées:', images.length);
    images.forEach((img, i) => {
      console.log(`🔍 Image ${i + 1}:`, img.src, '|', img.alt);
    });
    
    if (images.length === 0) {
      console.log('❌ Aucune image trouvée - HTML:', htmlContent);
      return htmlContent; // Pas d'images à traiter
    }

    // Créer le dossier images
    const imagesDir = await documentDir.getDirectoryHandle('images', { create: true });
    
    // Traiter chaque image séparément (pas de déduplication)
    for (const img of images) {
      const imageUrl = img.src;
      const altText = img.alt || 'image';
      
      try {
        let blob;
        
        // Vérifier d'abord si on a le blob en mémoire
        if (imageUrl.startsWith('blob:') && getBlobFromUrl) {
          const storedFile = getBlobFromUrl(imageUrl);
          if (storedFile) {
            console.log('✅ Blob trouvé en mémoire pour:', imageUrl, 'Name:', storedFile?.name, 'Size:', storedFile?.size);
            blob = storedFile;
          } else {
            console.log('⚠️ Blob non trouvé en mémoire pour:', imageUrl);
            console.log('📊 Blobs disponibles en mémoire:', getAllBlobs ? getAllBlobs().size : 'getAllBlobs non disponible');
            if (getAllBlobs) {
              console.log('🔍 URLs des blobs stockés:', Array.from(getAllBlobs().keys()));
            }
            console.log('🔄 Tentative de fetch:', imageUrl);
            const response = await fetch(imageUrl);
            blob = await response.blob();
          }
        } else {
          const response = await fetch(imageUrl);
          blob = await response.blob();
        }
        
        if (!blob) {
          console.error('❌ Impossible de récupérer l\'image:', imageUrl);
          continue;
        }
        
        // Déterminer l'extension du fichier
        const mimeType = blob.type || 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        
        // Utiliser le nom de l'image ou défaut
        const originalName = altText || 'image';
        const fileName = generateImageFileName(originalName, extension);
        
        // Sauvegarder l'image
        const imageHandle = await imagesDir.getFileHandle(fileName, { create: true });
        const writable = await imageHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Mettre à jour le src dans l'HTML pour pointer vers le fichier local
        img.src = `./images/${fileName}`;
        console.log('✅ Image sauvegardée:', fileName);
      } catch (imageError) {
        console.error('❌ Erreur sauvegarde image:', imageError);
      }
    }
    
    // Retourner le HTML modifié depuis le DOM
    return doc.body.innerHTML;
  };

  // Trouver un nom de dossier disponible (gestion des collisions)
  const findAvailableDirectoryName = async (parentDir, baseName) => {
    let finalName = baseName;
    let counter = 1;
    
    while (true) {
      try {
        // Tenter d'accéder au dossier (si ça marche, il existe déjà)
        await parentDir.getDirectoryHandle(finalName);
        // Le dossier existe, essayer le suivant
        finalName = `${baseName} (${counter})`;
        counter++;
      } catch (error) {
        // Le dossier n'existe pas, on peut l'utiliser
        break;
      }
    }
    
    return finalName;
  };

  // Fonction pour effectuer la sauvegarde
  const performSave = async (chosenDocumentName) => {
    try {
      setIsSaving(true);
      console.log('💾 [SAVE] Début du processus de sauvegarde...');
      
      // Récupérer le HTML actuel
      const htmlContent = editorRef.current?.innerHTML || content;
      console.log('💾 [SAVE] HTML récupéré, longueur:', htmlContent.length);
      
      // ÉTAPE 1: Validation pré-sauvegarde des images
      console.log('🔍 [SAVE] Étape 1 - Validation pré-sauvegarde...');
      const validationResult = validateImagesBeforeSave(htmlContent);
      
      if (!validationResult.valid) {
        console.log('❌ [SAVE] Sauvegarde bloquée - images manquantes détectées');
        const missingCount = validationResult.missingBlobs.length;
        const totalCount = validationResult.totalImages;
        
        let errorMessage = `❌ Impossible de sauvegarder le document\n\n`;
        errorMessage += `${missingCount} image(s) sur ${totalCount} ne sont pas disponibles en mémoire.\n\n`;
        errorMessage += `Images concernées :\n`;
        
        validationResult.missingBlobs.forEach(missing => {
          errorMessage += `• Image ${missing.index}: "${missing.alt}"\n`;
        });
        
        errorMessage += `\nVeuillez :\n`;
        errorMessage += `1. Réinsérer les images manquantes\n`;
        errorMessage += `2. Ou supprimer les images corrompues\n`;
        errorMessage += `3. Puis réessayer la sauvegarde`;
        
        alert(errorMessage);
        setIsSaving(false);
        return;
      }
      
      console.log('✅ [SAVE] Validation réussie - poursuite de la sauvegarde');
      
      // ÉTAPE 2: Sélection du dossier de destination
      console.log('💾 [SAVE] Étape 2 - Sélection du dossier de destination...');
      const parentDirectoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      // Trouver un nom de dossier disponible (éviter les collisions)
      const availableDocumentName = await findAvailableDirectoryName(
        parentDirectoryHandle, 
        chosenDocumentName.trim()
      );

      // Créer le dossier du document avec le nom disponible
      const documentDir = await parentDirectoryHandle.getDirectoryHandle(
        availableDocumentName, 
        { create: true }
      );

      // ÉTAPE 3: Extraire et sauvegarder les images (validation déjà passée)
      console.log('💾 [SAVE] Étape 3 - Extraction et sauvegarde des images...');
      const updatedHtmlContent = await extractAndSaveImages(htmlContent, documentDir);
      
      // Convertir en markdown avec les nouveaux chemins d'images
      const markdownContent = htmlToMarkdown(updatedHtmlContent);

      // Sauvegarder le fichier markdown (utiliser le nom disponible)
      const fileName = `${availableDocumentName}.md`;
      const fileHandle = await documentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(markdownContent);
      await writable.close();
      
      const imageCount = (updatedHtmlContent.match(/src=["']\.\/images\/[^"']+["']/g) || []).length;
      const message = imageCount > 0 
        ? `✅ Document sauvegardé avec succès :\n${fileName} + ${imageCount} image(s) dans ${availableDocumentName}/`
        : `✅ Document sauvegardé avec succès :\n${fileName} dans ${availableDocumentName}/`;

      alert(message);
      setShowSaveModal(false);
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      if (error.name === 'AbortError') {
        setShowSaveModal(false);
        return;
      }
      alert(`❌ Erreur lors de la sauvegarde :\n${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Fonction pour ouvrir la modal de sauvegarde
  const handleSaveMarkdown = async () => {
    console.log('🔥 DEBUG: handleSaveMarkdown appelée');
    
    if (!isFileSystemAccessSupported()) {
      console.log('❌ DEBUG: File System Access API non supportée');
      alert('❌ Votre navigateur ne supporte pas l\'accès aux fichiers.');
      return;
    }
    console.log('✅ DEBUG: File System Access API supportée');

    // Ouvrir la modal pour demander le nom du document
    setShowSaveModal(true);
  };

  // Fonction pour confirmer la sauvegarde avec le nom choisi
  const handleConfirmSave = () => {
    if (documentName.trim() === '') return;
    performSave(documentName);
  };

  const handleOpenDocument = async () => {
    if (!isFileSystemAccessSupported()) {
      alert('❌ Votre navigateur ne supporte pas l\'accès aux fichiers.');
      return;
    }

    // Éditeur volatil - pas de persistance

    try {
      // Sélectionner le répertoire du document
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'read'
      });

      // Chercher le fichier .md correspondant au nom du répertoire
      const documentName = directoryHandle.name;
      const fileName = `${documentName}.md`;
      
      try {
        const fileHandle = await directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const content = await file.text();
        let htmlContent = markdownToHtml(content);
        
        // Charger les images locales et les convertir en blob URLs
        htmlContent = await loadLocalImages(htmlContent, directoryHandle);
        
        if (editorRef.current) {
          editorRef.current.innerHTML = htmlContent;
          // Déclencher l'événement de changement pour mettre à jour l'état
          const inputEvent = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(inputEvent);
        }
        
        // Basculer en mode WYSIWYG après le chargement
        onViewModeChange('wysiwyg');
        
        const imageCount = (htmlContent.match(/src=["']blob:[^"']+["']/g) || []).length;
        const message = imageCount > 0 
          ? `✅ Document ouvert avec succès :\n${fileName} + ${imageCount} image(s) chargée(s)`
          : `✅ Document ouvert avec succès :\n${fileName}`;
          
        alert(message);
      } catch (fileError) {
        // Si le fichier n'existe pas, proposer de le créer
        const createFile = window.confirm(`Le fichier ${fileName} n'existe pas dans ce répertoire.\n\nVoulez-vous créer un nouveau document ?`);
        if (createFile) {
          const newContent = '';
          const htmlContent = markdownToHtml(newContent);
          
          if (editorRef.current) {
            editorRef.current.innerHTML = htmlContent;
            const inputEvent = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(inputEvent);
          }
          
          // Basculer en mode WYSIWYG après le chargement
          onViewModeChange('wysiwyg');
          alert(`📝 Nouveau document créé : ${documentName}\n\nUtilisez "Sauvegarder" pour l'enregistrer.`);
        }
      }
    } catch (error) {
      console.error('❌ Erreur ouverture document:', error);
      if (error.name === 'AbortError') {
        // L'utilisateur a annulé
        return;
      }
      alert(`❌ Erreur lors de l'ouverture du document :\n${error.message}`);
    }
  };

  const loadLocalImages = async (htmlContent, documentDir) => {
    // Trouver toutes les images avec src="./images/*"
    const localImageRegex = /<img[^>]+src=["']\.\/(images\/[^"']+)["'][^>]*>/g;
    const matches = [...htmlContent.matchAll(localImageRegex)];
    
    if (matches.length === 0) {
      return htmlContent; // Pas d'images locales
    }

    let updatedHtml = htmlContent;
    
    try {
      // Vérifier si le dossier images existe
      const imagesDir = await documentDir.getDirectoryHandle('images');
      
      for (const match of matches) {
        const [fullMatch, imagePath] = match;
        const fileName = imagePath.split('/')[1]; // Récupérer juste le nom du fichier
        
        try {
          // Charger l'image depuis le dossier
          const imageHandle = await imagesDir.getFileHandle(fileName);
          const imageFile = await imageHandle.getFile();
          
          // Créer une blob URL pour l'affichage
          const blobUrl = URL.createObjectURL(imageFile);
          
          // Remplacer dans le HTML
          updatedHtml = updatedHtml.replace(`"./${imagePath}"`, `"${blobUrl}"`);
          
          console.log('✅ Image locale chargée:', fileName);
        } catch (imageError) {
          console.error('❌ Image introuvable:', fileName, imageError);
        }
      }
    } catch (dirError) {
      console.log('ℹ️ Dossier images non trouvé');
    }
    
    return updatedHtml;
  };

  const handleLoadMarkdown = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const markdownContent = e.target.result;
        const htmlContent = markdownToHtml(markdownContent);
        
        if (editorRef.current) {
          editorRef.current.innerHTML = htmlContent;
          // Déclencher l'événement de changement pour mettre à jour l'état
          const inputEvent = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(inputEvent);
        }
        
        // Basculer en mode WYSIWYG après le chargement
        onViewModeChange('wysiwyg');
        alert('Fichier Markdown chargé avec succès !');
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        alert('Erreur lors du chargement du fichier');
      }
    };
    
    reader.readAsText(file);
    // Reset l'input pour permettre de recharger le même fichier
    event.target.value = '';
  };
  
  // Détecter si le thème actuel est sombre (Dark mode)
  const isDarkMode = () => {
    const savedSettings = localStorage.getItem('dysThemeSettings');
    if (!savedSettings) return false;
    
    const settings = JSON.parse(savedSettings);
    const bg = settings.backgroundColor;
    
    // Convertir hex en RGB pour calculer la luminosité
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculer la luminosité relative (0-255)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    
    // Si luminosité < 128, c'est un thème sombre
    return luminance < 128;
  };
  
  // Tableau de couleurs adaptatif selon le mode
  const colors = [
    { name: isDarkMode() ? 'Blanc' : 'Noir', value: isDarkMode() ? '#ffffff' : '#000000' },
    { name: 'Bleu', value: '#3399ff' },
    { name: 'Vert', value: '#00cc00' },
    { name: 'Rouge', value: '#ff0000' },
    { name: 'Orange', value: '#ff9900' },
    { name: 'Violet', value: '#ff00ff' },
    { name: 'Jaune', value: '#ffff00' },
  ];


  const execCommand = (command, value = null) => {
    console.log('🚀 EXECCOMMAND START:', command, 'currentFormat AVANT:', currentFormat);
    console.log('🔒 ignoreSelectionChangeRef AVANT activation:', ignoreSelectionChangeRef.current);
    
    if (viewMode !== 'wysiwyg' || !editorRef.current) return;
    
    // 🔥 PROTECTION ACTIVÉE AVANT TOUT (même focus)
    ignoreSelectionChangeRef.current = true;
    console.log('🔒 PROTECTION ACTIVÉE - ignoreSelectionChangeRef:', ignoreSelectionChangeRef.current);
    
    editorRef.current.focus();
    
    // Traitement uniforme - État d'abord, DOM après
    const newFormat = { ...currentFormat };
    
    if (command === 'bold') {
      newFormat.bold = !currentFormat.bold;
      document.execCommand('bold', false, null);
    } else if (command === 'italic') {
      newFormat.italic = !currentFormat.italic;
      document.execCommand('italic', false, null);
    } else if (command === 'normal') {
      // État Normal immédiat - FORCE tout à false
      newFormat.bold = false;
      newFormat.italic = false;
      newFormat.color = '#000000';
      newFormat.fontSize = '16px';
      newFormat.fontFamily = 'system-ui';
      newFormat.heading = null;
      newFormat.list = null;
      
      // Force désactivation DOM - toujours exécuter même si déjà off
      if (document.queryCommandState('bold')) {
        document.execCommand('bold', false, null);
      }
      if (document.queryCommandState('italic')) {
        document.execCommand('italic', false, null);
      }
      document.execCommand('removeFormat', false, null);
      document.execCommand('formatBlock', false, 'p');
    } else if (command === 'foreColor') {
      newFormat.color = value;
      document.execCommand('foreColor', false, value);
    } else {
      document.execCommand(command, false, value);
    }
    
    // Mise à jour immédiate de l'état
    console.log('📝 APPEL onFormatChange avec newFormat:', newFormat);
    onFormatChange(newFormat);
    console.log('✅ onFormatChange appelé');
    
    // Pour le bouton Normal, forcer une deuxième mise à jour après DOM
    if (command === 'normal') {
      setTimeout(() => {
        onFormatChange({
          bold: false,
          italic: false,
          color: '#000000',
          fontSize: '16px',
          fontFamily: 'system-ui',
          heading: null,
          list: null
        });
      }, 10);
    }
    
    // Désactiver la protection après délai
    setTimeout(() => {
      console.log('🔓 DÉSACTIVATION PROTECTION après 100ms');
      ignoreSelectionChangeRef.current = false;
      console.log('🔓 ignoreSelectionChangeRef maintenant:', ignoreSelectionChangeRef.current);
    }, 100);
    
    console.log('🚀 EXECCOMMAND END:', command);
  };

  const handleHeading = (level) => {
    if (viewMode !== 'wysiwyg' || !editorRef.current) return;
    
    editorRef.current.focus();
    
    // Nettoyer le formatage existant avant d'appliquer le titre
    document.execCommand('removeFormat', false, null);
    
    // Appliquer le titre
    document.execCommand('formatBlock', false, level);
    
    onFormatChange({ bold: false, italic: false, color: '#000000', fontSize: '16px', fontFamily: 'system-ui', heading: level, list: null });
  };


  const handleRemoveList = () => {
    if (viewMode !== 'wysiwyg' || !editorRef.current) return;
    
    editorRef.current.focus();
    
    // Utiliser la logique toggle native : appeler la même commande que le type de liste actuel
    if (currentFormat.list === 'bullet') {
      document.execCommand('insertUnorderedList', false, null);
    } else if (currentFormat.list === 'number' || currentFormat.list === 'letter') {
      document.execCommand('insertOrderedList', false, null);
    }
    
    // Mettre à jour le format pour refléter la suppression
    onFormatChange({ ...currentFormat, list: null });
  };

  const handleList = (type) => {
    if (viewMode !== 'wysiwyg' || !editorRef.current) return;
    
    editorRef.current.focus();
    
    if (type === 'bullet') {
      document.execCommand('insertUnorderedList', false, null);
    } else if (type === 'number') {
      document.execCommand('insertOrderedList', false, null);
    } else if (type === 'letter') {
      document.execCommand('insertOrderedList', false, null);
      // Appliquer le style alphabétique à la liste créée
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        let element = selection.getRangeAt(0).commonAncestorContainer;
        while (element && element.nodeType !== 1) {
          element = element.parentNode;
        }
        while (element && element.tagName !== 'OL') {
          element = element.parentNode;
        }
        if (element && element.tagName === 'OL') {
          element.style.listStyleType = 'lower-alpha';
        }
      }
    }
    
    onFormatChange({ bold: false, italic: false, color: '#000000', fontSize: '16px', fontFamily: 'system-ui', heading: null, list: type });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide.');
      return;
    }
    
    console.log('🔄 [handleImageUpload] Début upload image:', file.name, file.type, `${Math.round(file.size/1024)}KB`);
    
    // Insérer l'image directement dans l'éditeur
    if (viewMode === 'wysiwyg' && editorRef.current) {
      try {
        console.log('💾 [handleImageUpload] Sauvegarde en IndexedDB...');
        
        // Générer UUID et sauvegarder en IndexedDB
        const imageId = crypto.randomUUID();
        await saveImage(imageId, file);
        
        // Créer Object URL temporaire pour affichage immédiat
        const tempObjectUrl = URL.createObjectURL(file);
        console.log('🔗 [handleImageUpload] Object URL temporaire créée:', tempObjectUrl);
        
        // Insérer avec data-image-id ET Object URL temporaire
        editorRef.current.focus();
        const imgHtml = `<img src="${tempObjectUrl}" data-image-id="${imageId}" width="300px" style="height: auto; margin: 0.5em 0;" alt="${file.name}" />`;
        
        console.log('📝 [handleImageUpload] Insertion HTML avec imageId:', {
          imageId,
          fileName: file.name,
          tempUrl: tempObjectUrl,
          html: imgHtml
        });
        
        document.execCommand('insertHTML', false, imgHtml);
        
        // Forcer re-rendu immédiat pour styles/poignées images ET réhydratation
        setTimeout(async () => {
          if (setContent) {
            console.log('🔄 [handleImageUpload] Force re-rendu pour styles image');
            setContent(editorRef.current.innerHTML);
          }
          
          // Déclencher réhydratation immédiate pour remplacer l'URL temporaire
          if (editorRef.current) {
            console.log('🔄 [handleImageUpload] Déclenchement réhydratation post-upload...');
            const images = editorRef.current.querySelectorAll('img[data-image-id]');
            console.log(`🔍 [handleImageUpload] ${images.length} images à réhydrater trouvées`);
            
            for (const img of images) {
              const imageId = img.getAttribute('data-image-id');
              if (img.src.startsWith('blob:')) {
                console.log('🔄 [handleImageUpload] Réhydratation image:', imageId);
                try {
                  const objectUrl = await loadImage(imageId);
                  if (objectUrl) {
                    console.log('✅ [handleImageUpload] Réhydratation réussie:', img.src, '->', objectUrl);
                    img.src = objectUrl;
                  }
                } catch (error) {
                  console.error('❌ [handleImageUpload] Erreur réhydratation:', error);
                }
              }
            }
          }
        }, 200);
        
        // Réinitialiser le formatage après insertion
        onFormatChange({ bold: false, italic: false, color: '#000000', fontSize: '16px', fontFamily: 'system-ui', heading: null, list: null });
        
        console.log('✅ [handleImageUpload] Image persistante insérée:', {
          fileName: file.name,
          imageId,
          persistedInIndexedDB: true
        });
        
        // Réinitialiser l'input file
        event.target.value = '';
        
      } catch (error) {
        console.error('❌ [handleImageUpload] ERREUR DÉTAILLÉE insertion image:', {
          message: error.message,
          stack: error.stack,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        alert(`Erreur: ${error.message || 'Insertion image échouée'}`);
      }
    } else {
      console.warn('⚠️ Upload ignoré - Mode non-WYSIWYG ou éditeur non disponible');
    }
  };


  const createNewDocument = () => {
    if (editorRef.current) {
      const newContent = '';
      editorRef.current.innerHTML = newContent;
      setContent(newContent);
      const inputEvent = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(inputEvent);
    }
    onViewModeChange('wysiwyg');
  };

  const handleNewDocument = () => {
    // Vérifier s'il y a du contenu à perdre (logique simplifiée)
    const defaultContent = '';
    const isEmpty = !content || 
      content.trim().length === 0 || 
      content.trim() === defaultContent.trim() ||
      content.trim() === '<p><br></p>' ||
      content.trim() === '<p></p>' ||
      content.trim() === '<div><br></div>';
    
    if (!isEmpty) {
      // Il y a du contenu, ouvrir la modal de confirmation
      setShowConfirmModal(true);
    } else {
      // Pas de contenu significatif, créer directement
      createNewDocument();
    }
  };

  return (
    <div className="border-4 border-blue-600 rounded-lg bg-blue-100 py-3 shadow-lg w-full">
      {/* Ligne 1 - Format + Couleurs + Mode */}
      <div className="flex items-center justify-start space-x-6 mb-2 w-full">
        {/* Format buttons */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Format:</span>
          <button
            onClick={() => execCommand('normal')}
            className={`px-2 py-0.5 text-xs rounded ${
              !currentFormat.bold && !currentFormat.italic && !currentFormat.heading && !currentFormat.list
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            Normal
          </button>
          <button
            onClick={() => execCommand('bold')}
            className={`px-2 py-0.5 text-xs rounded font-bold ${
              currentFormat.bold
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            Gras
          </button>
          <button
            onClick={() => execCommand('italic')}
            className={`px-2 py-0.5 text-xs rounded italic ${
              currentFormat.italic
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            Italique
          </button>
        </div>

        {/* Colors (sans libellé) */}
        <div className="flex space-x-1">
          {colors.map((color, index) => (
            <button
              key={index}
              onClick={() => execCommand('foreColor', color.value)}
              className={`w-4 h-4 rounded-full border-2 ${
                currentFormat.color === color.value
                  ? 'border-blue-500 ring-2 ring-blue-300'
                  : 'border-gray-300 hover:border-gray-500'
              }`}
              style={{ backgroundColor: color.value }}
              disabled={viewMode !== 'wysiwyg'}
              title={color.name}
            />
          ))}
        </div>


        {/* Mode selection menu */}
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Mode:</span>
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            className="px-3 py-1 text-sm rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="wysiwyg">📝 Éditeur visuel</option>
            <option value="markdown">#️⃣ Code Markdown</option>
            <option value="html">🌐 Code HTML</option>
          </select>
        </div>

        {/* Fichiers Markdown */}
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Document:</span>
          <div className="relative group">
            <button
              onClick={() => {
                console.log('🔴 DEBUG: Bouton Sauvegarder cliqué!');
                handleSaveMarkdown();
              }}
              className="border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 px-2 py-1 text-xs rounded"
            >
              💾 Sauvegarder
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Sauvegarder le document sur l'ordinateur
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={handleOpenDocument}
              className="border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 px-2 py-1 text-xs rounded"
            >
              📁 Ouvrir
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Ouvrir un Document existant
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 px-2 py-1 text-xs rounded"
            >
              🆕 Nouveau
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Créer un Nouveau Document Vierge
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={handleExportToOneNote}
              className="border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 px-2 py-1 text-xs rounded"
            >
              📋 OneNote
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Export OneNote
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={() => document.getElementById('html-import-input').click()}
              className="border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 px-2 py-1 text-xs rounded"
            >
              📁 Importer HTML
            </button>
            <input
              id="html-import-input"
              type="file"
              accept=".html,.htm,.mht,.mhtml"
              onChange={handleImportHTML}
              className="hidden"
            />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Importer fichier HTML/MHTML (OneNote)
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        </div>


      </div>

      {/* Ligne 2 - Titres + Listes + Édition */}
      <div className="flex items-center justify-start space-x-6 w-full">
        {/* Headings */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Titres:</span>
          <button
            onClick={() => execCommand('normal')}
            className={`px-2 py-0.5 text-xs rounded ${
              !currentFormat.heading && !currentFormat.list
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            Texte
          </button>
          <button
            onClick={() => handleHeading('h3')}
            className={`px-2 py-0.5 text-xs rounded ${
              currentFormat.heading === 'h3'
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            style={{ fontSize: '0.8em' }}
            disabled={viewMode !== 'wysiwyg'}
          >
            Titre 1
          </button>
          <button
            onClick={() => handleHeading('h2')}
            className={`px-2 py-0.5 text-xs rounded ${
              currentFormat.heading === 'h2'
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            Titre 2
          </button>
          <button
            onClick={() => handleHeading('h1')}
            className={`px-2 py-0.5 text-xs rounded ${
              currentFormat.heading === 'h1'
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            style={{ fontSize: '1.2em' }}
            disabled={viewMode !== 'wysiwyg'}
          >
            Titre 3
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Listes:</span>
          <button
            onClick={handleRemoveList}
            className="px-2 py-0.5 text-xs rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500"
            disabled={viewMode !== 'wysiwyg'}
            title="Supprimer la liste"
          >
            ✗
          </button>
          <button
            onClick={() => handleList('bullet')}
            className={`px-2 py-0.5 text-xs rounded ${
              currentFormat.list === 'bullet'
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            • Puces
          </button>
          <button
            onClick={() => handleList('number')}
            className={`px-2 py-0.5 text-xs rounded ${
              currentFormat.list === 'number'
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            1. Numéros
          </button>
          <button
            onClick={() => handleList('letter')}
            className={`px-2 py-0.5 text-xs rounded ${
              currentFormat.list === 'letter'
                ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500'
            }`}
            disabled={viewMode !== 'wysiwyg'}
          >
            a. Lettres
          </button>
        </div>

        {/* Boutons Undo/Redo */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Édition:</span>
          <div className="relative group">
            <button
              onClick={() => document.execCommand('undo', false, null)}
              className="px-2 py-0.5 text-xs rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500"
              disabled={viewMode !== 'wysiwyg'}
            >
              ↶
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Annuler (Ctrl+Z)
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={() => document.execCommand('redo', false, null)}
              className="px-2 py-0.5 text-xs rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500"
              disabled={viewMode !== 'wysiwyg'}
            >
              ↷
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Rétablir (Ctrl+Y)
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={() => document.getElementById('image-input').click()}
              className="px-3 py-1 text-sm rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 font-medium"
              disabled={viewMode !== 'wysiwyg'}
            >
              🖼️ Image
            </button>
            <input
              id="image-input"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Insérer une image
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={onThemeSettingsToggle}
              className="px-3 py-1 text-sm rounded border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-500 font-medium"
            >
              🎨 Thème
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Paramètres du thème
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de sauvegarde */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="system-ui bg-white rounded-lg p-4 w-64 shadow-xl border-4 border-orange-400">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              💾 Sauvegarder le document
            </h3>
            
            <div className="mb-6">
              <label htmlFor="document-name" className="block text-sm font-semibold text-gray-800 mb-3">
                Nom du document :
              </label>
              <input
                id="document-name"
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isSaving) {
                    handleConfirmSave();
                  }
                  if (e.key === 'Escape') {
                    setShowSaveModal(false);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 font-medium"
                placeholder="MonDocument"
                autoFocus
                disabled={isSaving}
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
              />
              <p className="text-sm text-gray-600 mt-2 flex items-center">
                ✨ Un nom unique sera généré automatiquement si nécessaire
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-colors duration-200"
              >
                ❌ Annuler
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving || documentName.trim() === ''}
                className="px-5 py-2.5 text-sm font-semibold text-gray-800 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSaving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de confirmation */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="system-ui bg-white rounded-lg p-4 w-64 shadow-xl border-4 border-orange-400">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              ⚠️ Document non sauvegardé
            </h3>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700">
                Que souhaitez-vous faire ?
              </p>
            </div>
            
            <div className="flex justify-between space-x-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  handleSaveMarkdown();
                }}
                className="px-3 py-2 text-xs font-medium text-gray-800 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
              >
                💾 Sauvegarder puis nouveau
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  createNewDocument();
                }}
                className="px-3 py-2 text-xs font-medium text-gray-800 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
              >
                🗑️ Nouveau sans sauvegarder
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200"
              >
                ↩️ Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal d'export OneNote */}
      {showOneNoteExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="system-ui bg-white rounded-lg p-6 w-80 shadow-xl border-4 border-blue-400">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              ✅ Export OneNote réussi
            </h3>
            
            <div className="mb-6 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm text-gray-700 mb-2">
                Le contenu est maintenant dans le presse-papier,
              </p>
              <p className="text-sm font-medium text-blue-700">
                prêt à être collé dans OneNote !
              </p>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => setShowOneNoteExportModal(false)}
                className="px-6 py-2 text-sm font-medium text-gray-800 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              >
                👍 OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal d'import HTML */}
      {showImportHtmlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="system-ui bg-white rounded-lg p-6 w-80 shadow-xl border-4 border-green-400">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              ✅ Import HTML réussi
            </h3>
            
            <div className="mb-6 text-center">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-sm text-gray-700 mb-2">
                Le contenu de <strong>{importedFileName}</strong>
              </p>
              <p className="text-sm font-medium text-green-700">
                a été importé avec succès dans l'éditeur !
              </p>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => setShowImportHtmlModal(false)}
                className="px-6 py-2 text-sm font-medium text-gray-800 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
              >
                👍 OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
