import React, { useCallback, useEffect, useRef, forwardRef } from 'react';
import { convertAllPromptoDysUrlsToBlobs, getCurrentProject } from '../utils/promptoDysManager';
import { loadImage, saveImage, requestPersistentStorage } from '../utils/imageStore';

const Editor = forwardRef(({
  content,
  setContent,
  viewMode,
  onInput,
  currentFormat,
  onFormatChange,
  mathJaxReady,
  ignoreSelectionChangeRef,
  selectedImage,
  onImageClick,
  onEditorClick,
  onDeleteSelectedImage,
  onSelectionChange,
  storeBlobForUrl,
  editorRef
}, ref) => {


  // Utilise editorRef passée en props (pas de ref locale)
  const isInitializedRef = useRef(false);
  const previousContentRef = useRef('');

  // Fonction pour créer des blobs uniques (mutualisation avec Toolbar)
  const createUniqueBlob = useCallback((file, storeBlobForUrl) => {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const uniqueName = `${uniqueId}_${file.name}`;
    const uniqueFile = new File([file], uniqueName, { type: file.type });
    const blobUrl = URL.createObjectURL(uniqueFile);

    console.log('🎯 [createUniqueBlob] Création blob unique:', uniqueName, '->', blobUrl);
    storeBlobForUrl(blobUrl, uniqueFile);

    return { blobUrl, uniqueFile };
  }, []);

  // Fonction de vérification force de la persistance des images
  const forceVerifyImagePersistence = useCallback(async (container) => {
    console.log('🔍 [forceVerify] Vérification persistance images...');

    const imagesWithId = container.querySelectorAll('img[data-image-id]');
    console.log(`🔍 [forceVerify] ${imagesWithId.length} images avec data-image-id trouvées`);

    for (const img of imagesWithId) {
      const imageId = img.getAttribute('data-image-id');
      try {
        const blob = await loadImage(imageId);
        if (blob) {
          console.log(`✅ [forceVerify] Image ${imageId} OK en IndexedDB (${Math.round(blob.size / 1024)}KB)`);
        } else {
          console.error(`❌ [forceVerify] Image ${imageId} MANQUANTE en IndexedDB`);
          // Re-sauvegarder depuis l'URL actuelle si possible
          if (img.src.startsWith('blob:')) {
            try {
              const response = await fetch(img.src);
              const newBlob = await response.blob();
              await saveImage(imageId, newBlob);
              console.log(`🔄 [forceVerify] Re-sauvegarde OK pour ${imageId}`);
            } catch (error) {
              console.error(`❌ [forceVerify] Échec re-sauvegarde ${imageId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(` [forceVerify] Erreur vérification ${imageId}:`, error);
      }
    }
  }, []);

  // Fonction de réhydratation des images depuis IndexedDB
  const rehydrateImages = useCallback(async (container) => {
    console.log(' [rehydrateImages] Début réhydratation des images...');

    if (!container) {
      console.warn(' [rehydrateImages] Pas de conteneur fourni');
      return;
    }

    // Trouver toutes les images avec data-image-id
    const images = container.querySelectorAll('img[data-image-id]');
    console.log(` [rehydrateImages] ${images.length} images avec data-image-id trouvées`);

    // Traiter chaque image
    for (const img of images) {
      const imageId = img.getAttribute('data-image-id');
      console.log(' [rehydrateImages] Traitement image:', imageId);

      try {
        // Charger l'image depuis IndexedDB
        const objectUrl = await loadImage(imageId);

        if (objectUrl) {
          // Conserver les attributs existants
          const width = img.getAttribute('width');
          const height = img.getAttribute('height');
          const alt = img.getAttribute('alt') || '';

          console.log(' [rehydrateImages] Image chargée:', {
            imageId,
            oldSrc: img.src,
            newSrc: objectUrl,
            width,
            height,
            alt
          });

          // Mettre à jour la source
          img.src = objectUrl;

          console.log(' [rehydrateImages] Image réhydratée avec succès:', imageId);
        } else {
          console.warn(' [rehydrateImages] Image non trouvée en IndexedDB:', imageId);
          // On garde l'image avec son data-image-id pour un essai ultérieur
        }
      } catch (error) {
        console.error(' [rehydrateImages] Erreur réhydratation:', imageId, error);
      }
    }

    console.log(' [rehydrateImages] Réhydratation terminée');
  }, []);

  // Fonction mutualisée pour traiter les images collées et les rendre uniques
  const processImageBlobs = useCallback(async (container, storeBlobForUrl) => {
    console.log(' [processImageBlobs] Traitement des images...');

    // Traiter les images blob: temporaires
    const blobImages = container.querySelectorAll('img[src^="blob:"]');
    console.log('🔍 [processImageBlobs] Images blob trouvées:', blobImages.length);

    for (const img of blobImages) {
      const originalUrl = img.src;

      try {
        console.log('📥 [processImageBlobs] Traitement blob:', originalUrl);

        // Récupérer le blob original
        const response = await fetch(originalUrl);
        const blob = await response.blob();

        // Créer un nouveau File avec un nom unique
        const file = new File([blob], 'pasted-image.png', { type: blob.type });
        const { blobUrl } = createUniqueBlob(file, storeBlobForUrl);

        // Remplacer l'URL dans l'image
        img.src = blobUrl;
        console.log('✅ [processImageBlobs] Image blob mise à jour:', originalUrl, '->', blobUrl);

      } catch (error) {
        console.error('❌ [processImageBlobs] Erreur blob pour:', originalUrl, error);
      }
    }

    // Traiter les images base64 collées (copie d'écran Windows)
    const base64Images = container.querySelectorAll('img[src^="data:image/"]');
    console.log('🔍 [processImageBlobs] Images base64 trouvées:', base64Images.length);

    for (const img of base64Images) {
      const dataUrl = img.src;

      try {
        console.log('📥 [processImageBlobs] Traitement base64 (longueur:', dataUrl.length, 'chars)');

        // Convertir data URL en blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        // Générer nom de fichier unique
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `pasted-screenshot-${timestamp}.png`;

        // Générer ID unique et stocker dans IndexedDB
        const imageId = crypto.randomUUID();
        await saveImage(imageId, blob);

        // Créer blob URL temporaire pour affichage
        const blobUrl = URL.createObjectURL(blob);

        // Stocker le mapping URL->File pour compatibilité
        const file = new File([blob], filename, { type: blob.type });
        if (storeBlobForUrl) {
          storeBlobForUrl(blobUrl, file);
        }

        // Remplacer l'image base64 par blob + data-image-id
        img.src = blobUrl;
        img.setAttribute('data-image-id', imageId);
        img.setAttribute('alt', filename);

        console.log(' [processImageBlobs] Image base64 convertie:', dataUrl.substring(0, 50) + '...', '->', blobUrl, 'ID:', imageId);

      } catch (error) {
        console.error(' [processImageBlobs] Erreur base64 pour:', dataUrl.substring(0, 50), error);
      }
    }

    // OPTION B: Force vérification + double check après processus
    console.log(' [processImageBlobs] OPTION B - Force vérification persistance...');
    await forceVerifyImagePersistence(container);

    // Double réhydratation après 500ms
    setTimeout(async () => {
      console.log(' [processImageBlobs] OPTION B - Double réhydratation...');
      await rehydrateImages(container);
    }, 500);

    console.log(' [processImageBlobs] Traitement terminé');
  }, [forceVerifyImagePersistence, rehydrateImages, createUniqueBlob]);


  // Fonction de migration des anciennes images blob: vers IndexedDB
  const migrateOldBlobImages = useCallback(async (container) => {
    console.log(' [migrateOldBlobImages] Début migration des anciennes images...');

    if (!container) {
      console.warn('⚠️ [migrateOldBlobImages] Pas de conteneur fourni');
      return;
    }

    // Trouver toutes les images avec src blob: SANS data-image-id (anciennes)
    const oldImages = container.querySelectorAll('img[src^="blob:"]:not([data-image-id])');
    console.log(`🔍 [migrateOldBlobImages] ${oldImages.length} anciennes images blob trouvées`);

    if (oldImages.length === 0) {
      console.log('✅ [migrateOldBlobImages] Aucune migration nécessaire');
      return;
    }

    // Traiter chaque ancienne image
    for (const img of oldImages) {
      const oldBlobUrl = img.src;
      console.log('🔄 [migrateOldBlobImages] Migration image:', oldBlobUrl);

      try {
        // Récupérer le blob depuis l'URL
        const response = await fetch(oldBlobUrl);
        if (!response.ok) {
          console.warn('⚠️ [migrateOldBlobImages] Impossible de récupérer le blob:', response.status);
          continue;
        }

        const blob = await response.blob();
        console.log('📦 [migrateOldBlobImages] Blob récupéré:', {
          size: `${Math.round(blob.size / 1024)}KB`,
          type: blob.type
        });

        // Créer un File pour saveImage()
        const fileName = img.alt || `migrated_image_${Date.now()}.png`;
        const file = new File([blob], fileName, { type: blob.type });

        // Générer UUID et sauvegarder en IndexedDB
        const imageId = crypto.randomUUID();
        await saveImage(imageId, file);
        console.log('💾 [migrateOldBlobImages] Image migrée vers IndexedDB:', imageId);

        // Mettre à jour l'élément img avec data-image-id
        img.setAttribute('data-image-id', imageId);

        // Créer nouvelle Object URL
        const newObjectUrl = URL.createObjectURL(blob);
        img.src = newObjectUrl;

        // Révoquer l'ancienne URL si possible
        try {
          URL.revokeObjectURL(oldBlobUrl);
          console.log('🧹 [migrateOldBlobImages] Ancienne URL révoquée:', oldBlobUrl);
        } catch (revokeError) {
          console.warn('⚠️ [migrateOldBlobImages] Impossible de révoquer ancienne URL:', revokeError);
        }

        console.log('✅ [migrateOldBlobImages] Image migrée avec succès:', {
          oldUrl: oldBlobUrl,
          newImageId: imageId,
          fileName
        });

      } catch (error) {
        console.error('❌ [migrateOldBlobImages] Erreur migration:', oldBlobUrl, error);
        // On garde l'ancienne image même en cas d'erreur
      }
    }

    console.log('✅ [migrateOldBlobImages] Migration terminée');

    // Déclencher une sauvegarde du contenu après migration
    if (onInput && container.innerHTML) {
      console.log('💾 [migrateOldBlobImages] Déclenchement sauvegarde après migration...');
      const event = new Event('input', { bubbles: true });
      container.dispatchEvent(event);
    }
  }, [onInput]);

  // Gestionnaire pour l'auto-redimensionnement (toujours déclaré)
  const handleTextareaResize = useCallback((textarea) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(384, textarea.scrollHeight) + 'px';
    }
  }, []);

  // Effect pour la réhydratation des images au chargement
  useEffect(() => {
    console.log(' [Editor] Effect réhydratation - Chargement initial');

    const initImageSystem = async () => {
      console.log(' [Editor] Demande stockage persistant...');
      // Demander le stockage persistant
      await requestPersistentStorage();

      // Réhydrater les images si l'éditeur est prêt
      if (editorRef.current) {
        console.log(' [Editor] Déclenchement réhydratation...');
        await rehydrateImages(editorRef.current);

        console.log(' [Editor] Déclenchement migration anciennes images...');
        await migrateOldBlobImages(editorRef.current);
      } else {
        console.warn(' [Editor] editorRef pas encore prêt pour réhydratation');
      }
    };

    initImageSystem();
  }, [rehydrateImages, migrateOldBlobImages]);

  // Effect pour réhydrater quand le contenu change (nouveau document chargé)
  useEffect(() => {
    if (content && content !== previousContentRef.current && editorRef.current) {
      console.log(' [Editor] Contenu changé - Vérification réhydratation...');
      previousContentRef.current = content;

      // Délai pour laisser le DOM se mettre à jour (plus long en production)
      const rehydrationDelay = process.env.NODE_ENV === 'production' ? 1000 : 100;
      console.log(` [Editor] Délai réhydratation: ${rehydrationDelay}ms (env: ${process.env.NODE_ENV})`);

      setTimeout(async () => {
        await rehydrateImages(editorRef.current);
        await migrateOldBlobImages(editorRef.current);
      }, rehydrationDelay);
    }
  }, [content, rehydrateImages, migrateOldBlobImages]);

  // Fonction pour formater le HTML avec des retours à la ligne et indentation
  const formatHtmlForSource = useCallback((html) => {
    let indentLevel = 0;
    const indentSize = 2; // 2 espaces par niveau

    return html
      .replace(/<br\s*\/?>/gi, '<br>\n')
      .replace(/<\/?(h[1-6]|p|div|ul|ol|li|strong|em|span)[^>]*>/gi, (match) => {
        if (match.startsWith('</')) {
          // Balise fermante : diminuer l'indentation puis ajouter la balise
          indentLevel = Math.max(0, indentLevel - 1);
          return match + '\n';
        } else {
          // Balise ouvrante : ajouter la balise puis augmenter l'indentation
          const result = '\n' + ' '.repeat(indentLevel * indentSize) + match;
          // Augmenter l'indentation pour les balises conteneurs
          if (match.match(/<(ul|ol|li|div|p|h[1-6])[^>]*>/i)) {
            indentLevel++;
          }
          return result;
        }
      })
      .split('\n')
      .map((line, index) => {
        if (index === 0) return line.trim(); // Première ligne sans indentation
        if (line.trim() === '') return ''; // Ligne vide
        if (line.trim().startsWith('</')) {
          // Balise fermante : réduire l'indentation
          const currentIndent = Math.max(0, indentLevel - 1);
          return ' '.repeat(currentIndent * indentSize) + line.trim();
        }
        // Contenu texte : utiliser l'indentation actuelle
        return line.startsWith(' ') ? line : ' '.repeat(indentLevel * indentSize) + line.trim();
      })
      .join('\n')
      .replace(/^\n+/, '') // Supprimer les retours à la ligne en début
      .replace(/\n{2,}/g, '\n') // Supprimer toutes les lignes vides multiples
      .trim();
  }, []);

  // Gestionnaire unifié WYSIWYG - connecté directement à onInput
  const handleWysiwygChange = useCallback((e) => {
    console.log('📝 handleWysiwygChange déclenché');

    if (!editorRef.current) return;

    // Nettoyer les spans vides et les &nbsp; en trop
    const cleanContent = (html) => {
      return html
        .replace(/<span(?![^>]*style="[^"]*color:)[^>]*>\s*<\/span>/g, '') // Supprimer spans vides SAUF les spans colorés
        .replace(/(&nbsp;\s*){2,}/g, '&nbsp;') // Réduire les &nbsp; multiples
        .replace(/<font[^>]*color="([^"]*)"[^>]*>(.*?)<\/font>/g, '<span style="color: $1;">$2</span>') // Convertir font en span
        .replace(/<b\b[^>]*>(.*?)<\/b>/g, '<strong>$1</strong>') // Convertir b en strong
        .replace(/<i\b[^>]*>(.*?)<\/i>/g, '<em>$1</em>'); // Convertir i en em
    };

    const newContent = cleanContent(editorRef.current.innerHTML);
    console.log('🔍 Contenu actuel vs nouveau:', content.length, 'vs', newContent.length);

    // Appel direct vers onInput du hook useEditor
    if (newContent !== content) {
      console.log('✅ WYSIWYG Changement - Appel onInput direct');
      onInput({ target: { innerHTML: newContent } });
    }

    // Déclencher mise à jour du formatage après un délai
    if (onSelectionChange && !ignoreSelectionChangeRef?.current) {
      console.log('🔄 EDITOR handleWysiwygChange - Va appeler onSelectionChange dans 50ms');
      setTimeout(onSelectionChange, 50);
    } else {
      console.log('❌ EDITOR handleWysiwygChange - onSelectionChange BLOQUÉ - ignoreFlag:', ignoreSelectionChangeRef?.current);
    }
  }, [content, onInput, onSelectionChange]);

  // Gestionnaire pour les événements de sélection/curseur
  const handleSelectionChange = useCallback(() => {
    console.log('📍 EDITOR handleSelectionChange - ignoreFlag:', ignoreSelectionChangeRef?.current);
    if (ignoreSelectionChangeRef?.current) {
      console.log('❌ EDITOR handleSelectionChange - BLOQUÉ par ignoreFlag');
      return;
    }
    if (viewMode === 'wysiwyg' && document.activeElement === editorRef.current) {
      console.log('✅ EDITOR handleSelectionChange - VA APPELER onSelectionChange');
      onSelectionChange();
    } else {
      console.log('⚠️ EDITOR handleSelectionChange - SKIP conditions');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, onSelectionChange, ignoreSelectionChangeRef]);


  // Initialiser le contenu uniquement si nécessaire
  useEffect(() => {
    const initializeContent = async () => {
      if (viewMode === 'wysiwyg' && editorRef.current && editorRef.current.innerHTML !== content) {
        // Ne pas modifier le contenu si l'utilisateur interagit activement
        const hasFocus = document.activeElement === editorRef.current;
        const hasSelection = window.getSelection().rangeCount > 0;

        // Éviter les mises à jour pendant l'interaction utilisateur
        if (hasFocus && hasSelection) {
          return; // Ne pas perturber l'utilisateur
        }

        // Convertir les URLs relatives PromptoDYS en Blob URLs pour affichage
        const currentProject = getCurrentProject();
        let displayContent = content;

        if (currentProject.directory) {
          displayContent = await convertAllPromptoDysUrlsToBlobs(content, currentProject.directory);
        }

        // Mise à jour avec le contenu converti
        editorRef.current.innerHTML = displayContent;

        // Re-rendre MathJax après mise à jour du contenu
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([editorRef.current]).catch((err) => {
            console.warn('Erreur MathJax:', err);
          });
        }

        // SOLUTION F5: Forcer le retraitement des poignées après initialisation
        setTimeout(() => {
          console.log('🔄 [F5 Fix] Retraitement forcé des poignées d\'images après initialisation');
          const images = editorRef.current?.querySelectorAll('img');
          if (images && editorRef.current?.addResizeHandlesToImage) {
            images.forEach(img => {
              // Retirer le marqueur data-resizable pour forcer le retraitement
              img.removeAttribute('data-resizable');
              // Retirer le wrapper s'il existe déjà
              const existingWrapper = img.closest('.resizable-image');
              if (existingWrapper && existingWrapper.parentNode) {
                const parent = existingWrapper.parentNode;
                parent.insertBefore(img, existingWrapper);
                existingWrapper.remove();
              }
              // Retraiter l'image
              editorRef.current.addResizeHandlesToImage(img);
            });
            console.log('✅ [F5 Fix] Poignées retraitées pour', images.length, 'image(s)');
          }
        }, 300); // Délai pour s'assurer que tout est bien initialisé
      }
    };

    initializeContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, content]);

  // Gestionnaire pour la copie - convertir HTML en texte propre et gérer les images sélectionnées
  const handleCopy = useCallback((e) => {
    if (viewMode === 'wysiwyg' && editorRef.current) {
      // Priorité 1: Si une image est sélectionnée, copier l'image
      if (selectedImage) {
        try {
          // Créer un élément temporaire avec l'image
          const tempDiv = document.createElement('div');
          const clonedImg = selectedImage.cloneNode(true);
          tempDiv.appendChild(clonedImg);

          // Copier au format HTML pour préserver la structure
          e.clipboardData.setData('text/html', tempDiv.innerHTML);
          // Copier aussi le src comme texte de fallback
          e.clipboardData.setData('text/plain', selectedImage.src);
          e.preventDefault();
          return;
        } catch (error) {
          console.warn('Erreur copie image:', error);
        }
      }

      // Priorité 2: Sélection de texte classique
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedContent = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(selectedContent);

        // Convertir HTML en texte avec retours à la ligne préservés
        const htmlContent = tempDiv.innerHTML;
        const textContent = htmlContent
          .replace(/<div[^>]*>/gi, '')
          .replace(/<\/div>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '') // Supprimer toutes les autres balises
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n+$/, ''); // Supprimer les retours à la ligne en fin

        // Mettre le texte propre dans le presse-papier
        e.clipboardData.setData('text/plain', textContent);
        e.preventDefault();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedImage]);


  // Gestionnaire pour forcer le refresh après coller
  const handlePaste = useCallback((e) => {
    console.log('📋 [DEBUG] handlePaste DÉCLENCHÉ!', { viewMode, hasEditor: !!editorRef.current });

    if (viewMode === 'wysiwyg' && editorRef.current) {
      // 🖼️ APPROCHE CONSERVATRICE : On laisse le paste se faire naturellement
      // Puis on déplace les images dans des lignes dédiées SANS modifier le texte existant

      // Attendre que le contenu soit collé
      setTimeout(async () => {
        console.log('🔄 Refresh forcé après coller');

        // Traiter les images collées pour leur donner des URLs blob uniques
        if (storeBlobForUrl) {
          await processImageBlobs(editorRef.current, storeBlobForUrl);
        }

        console.log('✅ [handlePaste] Images traitées par processImageBlobs');

        // 🖼️ LOGIQUE SIMPLIFIÉE : TOUTE image collée doit être isolée sur sa propre ligne
        // On traite TOUTES les images, pas seulement celles dans les listes/titres
        const allImages = editorRef.current.querySelectorAll('img');
        console.log('🖼️ [handlePaste] Images trouvées:', allImages.length);

        allImages.forEach(img => {
          // Ignorer si déjà dans un conteneur dédié .image-line
          if (img.closest('.image-line')) {
            console.log('🖼️ [handlePaste] Image déjà isolée, ignorée');
            return;
          }

          // D'abord identifier l'élément à déplacer (wrapper ou image nue)
          const wrapper = img.closest('.resizable-image');
          const elementToMove = wrapper || img;

          // Ensuite chercher le parent bloc en partant du PARENT de l'élément à déplacer
          // (pour éviter que blockParent soit l'élément lui-même -> HierarchyRequestError)
          let blockParent = elementToMove.parentElement;
          const blockTags = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SPAN'];

          // Remonter jusqu'à trouver un bloc contenant texte + image
          while (blockParent && blockParent !== editorRef.current) {
            if (blockTags.includes(blockParent.tagName)) {
              break;
            }
            blockParent = blockParent.parentNode;
          }

          // Si dans une liste (LI), remonter jusqu'à UL/OL
          if (blockParent && blockParent.tagName === 'LI') {
            const listParent = blockParent.closest('ul, ol');
            if (listParent) {
              blockParent = listParent;
            }
          }

          console.log('🖼️ [handlePaste] Bloc parent trouvé:', blockParent?.tagName || 'aucun');

          if (blockParent && blockParent !== editorRef.current) {
            // Créer un nouveau paragraphe dédié pour l'image
            const newP = document.createElement('p');
            newP.className = 'image-line';
            newP.style.cssText = 'display: block; margin: 1em 0; text-align: left; list-style: none !important;';

            // 🎯 NOUVELLE STRATÉGIE DE PLACEMENT (Split Block) - COPIÉ DE TOOLBAR.JS
            // Identifier les frères suivants AVANT de déplacer l'élément
            const insertionNextSibling = elementToMove.nextSibling;

            // DÉPLACEMENT DIRECT
            newP.appendChild(elementToMove);

            // Vérifier si le bloc parent devient vide après le déplacement
            const parentText = blockParent.textContent.trim();
            const parentImages = blockParent.querySelectorAll('img');
            const isTextEmpty = parentText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim() === '';
            const isEmptyBlock = isTextEmpty && parentImages.length === 0;

            console.log('🖼️ [handlePaste] Bloc parent vide après déplacement ?', isEmptyBlock, 'Text:', parentText);

            if (isEmptyBlock) {
              console.log('🖼️ [handlePaste] Bloc vide, remplacement');
              blockParent.parentNode.replaceChild(newP, blockParent);
            } else {
              console.log('🖼️ [handlePaste] Bloc non-vide, SPLIT requis');
              // SPLIT BLOCK LOGIC

              // Créer la partie "Après"
              const rightPart = blockParent.cloneNode(false);

              // Déplacer les noeuds frères (qui étaient après l'image) vers rightPart
              let sibling = insertionNextSibling;
              while (sibling) {
                const next = sibling.nextSibling;
                rightPart.appendChild(sibling);
                sibling = next;
              }

              // Insérer imgP APRÈS le blockParent (qui est maintenant la partie gauche)
              if (blockParent.nextSibling) {
                blockParent.parentNode.insertBefore(newP, blockParent.nextSibling);
              } else {
                blockParent.parentNode.appendChild(newP);
              }

              // Insérer rightPart APRÈS imgP
              if (newP.nextSibling) {
                newP.parentNode.insertBefore(rightPart, newP.nextSibling);
              } else {
                newP.parentNode.appendChild(rightPart);
              }

              // Nettoyage si rightPart est vide
              if (rightPart.innerHTML.trim() === '') {
                rightPart.innerHTML = '<br>';
              }
            }

            console.log('✅ [handlePaste] Image isolée après:', blockParent.tagName);
          }
        });

        // Ajouter les poignées aux nouvelles images collées
        const newImages = editorRef.current.querySelectorAll('img:not([data-resizable])');
        newImages.forEach(img => {
          if (editorRef.current.addResizeHandlesToImage) {
            editorRef.current.addResizeHandlesToImage(img);
          }
        });

        // 🧹 NETTOYAGE : Corriger les structures HTML invalides
        // (p.image-line à l'intérieur de h1-h6, ou imbrications invalides)
        const invalidImageLines = editorRef.current.querySelectorAll('h1 .image-line, h2 .image-line, h3 .image-line, h4 .image-line, h5 .image-line, h6 .image-line');
        invalidImageLines.forEach(imageLine => {
          console.log('🧹 [handlePaste] Correction structure invalide - image-line dans heading');
          const heading = imageLine.closest('h1, h2, h3, h4, h5, h6');
          if (heading && heading.parentNode) {
            // Déplacer l'image-line APRÈS le heading
            if (heading.nextSibling) {
              heading.parentNode.insertBefore(imageLine, heading.nextSibling);
            } else {
              heading.parentNode.appendChild(imageLine);
            }
          }
        });

        // Déclencher sauvegarde
        if (onInput) {
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
      }, 100); // setTimeout
    }
    console.log('📋 [DEBUG] handlePaste terminé');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, handleSelectionChange, handleCopy]);

  // Effect pour redimensionner au changement de contenu (toujours déclaré)
  useEffect(() => {
    if (viewMode !== 'wysiwyg' && editorRef.current) {
      handleTextareaResize(editorRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, viewMode, handleTextareaResize]);



  // Effect pour attacher les gestionnaires d'événements
  useEffect(() => {
    console.log('🔗 [DEBUG] Attachement events, viewMode:', viewMode, 'editorRef:', !!editorRef.current);

    if (viewMode === 'wysiwyg' && editorRef.current) {
      // Debug générique pour TOUS les events paste
      const debugPaste = (e) => {
        console.log('🔥 [DEBUG] PASTE EVENT DÉTECTÉ!', {
          target: e.target.tagName,
          currentTarget: e.currentTarget.tagName,
          hasClipboardData: !!e.clipboardData
        });
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      editorRef.current.addEventListener('copy', handleCopy);
      editorRef.current.addEventListener('paste', handlePaste);
      editorRef.current.addEventListener('paste', debugPaste); // DEBUG GLOBAL

      console.log('✅ [DEBUG] Event paste attaché à editorRef.current + debug global');

      return () => {
        console.log('🗑️ [DEBUG] Nettoyage events');
        document.removeEventListener('selectionchange', handleSelectionChange);
        editorRef.current?.removeEventListener('copy', handleCopy);
        editorRef.current?.removeEventListener('paste', handlePaste);
        editorRef.current?.removeEventListener('paste', debugPaste);
      };
    }
  }, [viewMode, handleSelectionChange, handleCopy]);

  // Effect pour appliquer le style de sélection d'image
  useEffect(() => {
    if (viewMode === 'wysiwyg' && editorRef.current) {
      // Supprimer la classe de toutes les images
      const allImages = editorRef.current.querySelectorAll('img');
      allImages.forEach(img => {
        const wrapper = img.closest('.resizable-image');
        if (wrapper) {
          wrapper.classList.remove('image-selected');
        }
      });

      // Ajouter la classe à l'image sélectionnée
      if (selectedImage) {
        const wrapper = selectedImage.closest('.resizable-image');
        if (wrapper) {
          wrapper.classList.add('image-selected');
        }
      }
    }
  }, [selectedImage, viewMode, content]);

  // Gestion des poignées de redimensionnement pour les images
  useEffect(() => {
    if (viewMode === 'wysiwyg' && editorRef.current) {
      const addResizeHandlesToImage = (img) => {
        // Exposer la fonction pour réutilisation
        editorRef.current.addResizeHandlesToImage = addResizeHandlesToImage;
        // Toutes les images sont traitées normalement

        // Vérifier si déjà traité
        if (img.getAttribute('data-resizable') || img.parentElement?.classList.contains('resizable-image')) {
          return;
        }

        // Attendre que l'image soit chargée
        if (!img.complete || img.naturalWidth === 0) {
          img.addEventListener('load', () => addResizeHandlesToImage(img), { once: true });
          return;
        }

        img.setAttribute('data-resizable', 'true');

        // Wrapper l'image dans un conteneur redimensionnable
        const wrapper = document.createElement('div');
        wrapper.className = 'resizable-image';

        // Ajouter gestionnaire de clic pour sélection d'image
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onImageClick) {
            onImageClick(img);
          }
        });

        // Extraire les dimensions depuis le style inline ou les attributs
        let currentWidth, currentHeight;

        // Priorité 1: attributs HTML (ex: width="300px")
        const attrWidth = img.getAttribute('width');
        const attrHeight = img.getAttribute('height');

        // Priorité 2: style inline (ex: style="width: 300px")
        const styleWidth = img.style.width;
        const styleHeight = img.style.height;

        if (attrWidth && attrHeight) {
          currentWidth = parseInt(attrWidth);
          currentHeight = parseInt(attrHeight);
          console.log('📏 Dimensions depuis attributs:', currentWidth, 'x', currentHeight);
        } else if (styleWidth && styleHeight) {
          currentWidth = parseInt(styleWidth);
          currentHeight = parseInt(styleHeight);
          console.log('📏 Dimensions depuis style:', currentWidth, 'x', currentHeight);
        } else {
          // Fallback: dimensions naturelles
          currentWidth = img.naturalWidth || 300;
          currentHeight = img.naturalHeight || 200;
          console.log('📏 Dimensions naturelles:', currentWidth, 'x', currentHeight);
        }

        // Limiter la hauteur maximale à 300px en préservant le ratio d'aspect
        const MAX_HEIGHT = 300;
        if (currentHeight > MAX_HEIGHT) {
          const aspectRatio = currentWidth / currentHeight;
          currentHeight = MAX_HEIGHT;
          currentWidth = Math.round(currentHeight * aspectRatio);
          console.log('🔄 Image redimensionnée pour hauteur max 300px:', currentWidth, 'x', currentHeight);

          // Appliquer les nouvelles dimensions à l'image
          img.setAttribute('width', currentWidth + 'px');
          img.setAttribute('height', currentHeight + 'px');
          img.style.width = currentWidth + 'px';
          img.style.height = currentHeight + 'px';
        }

        wrapper.style.width = currentWidth + 'px';
        wrapper.style.height = currentHeight + 'px';

        // Insérer le wrapper (vérifier que parentNode existe)
        if (!img.parentNode) {
          console.warn('⚠️ Image sans parentNode, impossible d\'ajouter les poignées de redimensionnement');
          return;
        }
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);

        // Créer les 4 poignées
        ['nw', 'ne', 'sw', 'se'].forEach((corner) => {
          const handle = document.createElement('div');
          handle.className = `resize-handle ${corner}`;
          handle.dataset.corner = corner;

          handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = wrapper.offsetWidth;
            const startHeight = wrapper.offsetHeight;
            const aspectRatio = startWidth / startHeight;

            const handleMouseMove = (e) => {
              const deltaX = e.clientX - startX;
              const deltaY = e.clientY - startY;

              let newWidth = startWidth;
              let newHeight = startHeight;

              // Calculer les nouvelles dimensions selon le coin
              switch (corner) {
                case 'se': // Sud-Est
                  newWidth = Math.max(50, startWidth + deltaX);
                  newHeight = newWidth / aspectRatio;
                  break;
                case 'sw': // Sud-Ouest
                  newWidth = Math.max(50, startWidth - deltaX);
                  newHeight = newWidth / aspectRatio;
                  break;
                case 'ne': // Nord-Est
                  newWidth = Math.max(50, startWidth + deltaX);
                  newHeight = newWidth / aspectRatio;
                  break;
                case 'nw': // Nord-Ouest
                  newWidth = Math.max(50, startWidth - deltaX);
                  newHeight = newWidth / aspectRatio;
                  break;
              }

              // Appliquer les nouvelles dimensions
              wrapper.style.width = newWidth + 'px';
              wrapper.style.height = newHeight + 'px';
              img.style.width = '100%';
              img.style.height = '100%';

              // Ajouter les attributs HTML width/height pour persistance lors des conversions
              img.setAttribute('width', Math.round(newWidth) + 'px');
              img.setAttribute('height', Math.round(newHeight) + 'px');
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);

              // Déclencher l'événement de changement pour sauvegarder
              if (onInput) {
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
              }
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          });

          wrapper.appendChild(handle);
        });
      };

      // Observer pour détecter les nouvelles images
      const handleMutation = (mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'IMG') {
              addResizeHandlesToImage(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('img').forEach(addResizeHandlesToImage);
            }
          });
        });
      };

      const observer = new MutationObserver(handleMutation);
      observer.observe(editorRef.current, {
        childList: true,
        subtree: true
      });

      // Traiter les images existantes
      editorRef.current.querySelectorAll('img').forEach(addResizeHandlesToImage);

      return () => observer.disconnect();
    }
  }, [viewMode, onInput, content]);

  // Effect supprimé - La gestion des poignées est maintenant dans l'effect précédent

  // Rendu conditionnel avec switch/case pour garantir une seule vue
  console.log('🔄 Editor.js - Rendu switch/case, viewMode:', viewMode);

  switch (viewMode) {
    case 'wysiwyg':
      console.log('🎯 SWITCH - Vue WYSIWYG');
      return (
        <div key="wysiwyg">
          <style>{`
            .editor-content h1 { 
              font-size: 2em; 
              font-weight: bold; 
              margin: 0.67em 0; 
              line-height: 1.2;
            }
            .editor-content h2 { 
              font-size: 1.5em; 
              font-weight: bold; 
              margin: 0.75em 0; 
              line-height: 1.3;
            }
            .editor-content h3 { 
              font-size: 1.17em; 
              font-weight: bold; 
              margin: 0.83em 0; 
              line-height: 1.4;
            }
            .editor-content p {
              margin: 0.5em 0;
            }
            .editor-content ul {
              margin: 0.5em 0;
              padding-left: 2em;
              list-style-type: disc;
            }
            .editor-content ol {
              margin: 0.5em 0;
              padding-left: 2em;
              list-style-type: decimal;
            }
            .editor-content ol[style*="lower-alpha"] {
              list-style-type: lower-alpha;
            }
            .editor-content li {
              margin: 0.25em 0;
            }
            
            /* Styles pour images redimensionnables */
            .editor-content img {
              max-width: 100%;
              height: auto;
              position: relative;
              cursor: pointer;
            }
            
            .resizable-image {
              position: relative;
              display: inline-block;
              border: 2px solid transparent;
            }
            
            .resizable-image:hover {
              border: 2px solid #3b82f6;
            }
            
            /* Style pour image sélectionnée - SOLUTION RADICALE */
            .image-selected {
              position: relative;
            }
            
            .image-selected::after {
              content: '';
              position: absolute;
              top: -4px;
              left: -4px;
              right: -4px;
              bottom: -4px;
              border: 4px solid #1d4ed8;
              box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.3), 0 0 12px rgba(29, 78, 216, 0.4);
              background: rgba(29, 78, 216, 0.05);
              outline: 2px solid #ffffff;
              outline-offset: 2px;
              pointer-events: none;
              z-index: 1;
            }
            
            .resizable-image img {
              width: 100%;
              height: 100%;
              display: block;
              position: relative;
              z-index: 0;
            }
            
            .resizable-image .resize-handle {
              position: absolute;
              width: 10px;
              height: 10px;
              background: #3b82f6;
              border: 2px solid white;
              border-radius: 50%;
              opacity: 0;
              cursor: nw-resize;
              transition: opacity 0.2s;
            }
            
            .resizable-image:hover .resize-handle,
            .image-selected .resize-handle {
              opacity: 1;
            }
            
            .resize-handle.nw { top: -2px; left: -2px; cursor: nw-resize; }
            .resize-handle.ne { top: -2px; right: -2px; cursor: ne-resize; }
            .resize-handle.sw { bottom: -2px; left: -2px; cursor: sw-resize; }
            .resize-handle.se { bottom: -2px; right: -2px; cursor: se-resize; }
          `}</style>
          <div
            ref={(el) => { editorRef.current = el; }}
            contentEditable="true"
            suppressContentEditableWarning={true}
            spellCheck={false}
            onInput={(e) => {
              console.log('🎯 WYSIWYG onInput déclenché!');
              handleWysiwygChange(e);
            }}
            onKeyUp={(e) => {
              console.log('⌨️ WYSIWYG onKeyUp déclenché! Touche:', e.key);
              handleWysiwygChange(e);
            }}
            onPaste={(e) => {
              console.log('📋 WYSIWYG onPaste déclenché!');
              setTimeout(() => handleWysiwygChange(e), 10); // Délai pour laisser le paste s'appliquer
            }}
            onMouseUp={(e) => {
              console.log('🖱️ WYSIWYG onMouseUp - Sélection changée - ignoreFlag:', ignoreSelectionChangeRef?.current);
              if (onSelectionChange && !ignoreSelectionChangeRef?.current) {
                console.log('✅ EDITOR onMouseUp - VA APPELER onSelectionChange dans 10ms');
                setTimeout(onSelectionChange, 10);
              } else {
                console.log('❌ EDITOR onMouseUp - onSelectionChange BLOQUÉ');
              }
            }}
            onKeyDown={(e) => {
              // Protection contre les événements undefined
              if (!e || !e.key) {
                console.warn('⚠️ Événement onKeyDown invalide:', e);
                return;
              }

              console.log('🔽 WYSIWYG onKeyDown déclenché! Touche:', e.key);

              // Gestion des touches pour les images sélectionnées
              if (selectedImage) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  // Supprimer l'image directement
                  const wrapper = selectedImage.closest('.resizable-image');
                  const elementToRemove = wrapper || selectedImage;
                  elementToRemove.remove();

                  // Désélectionner l'image
                  if (onImageClick) {
                    onImageClick(null);
                  }

                  // Déclencher la sauvegarde
                  if (onInput) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                  }
                  return;
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  // Insérer une nouvelle ligne après l'image sélectionnée
                  const wrapper = selectedImage.closest('.resizable-image');
                  if (wrapper && wrapper.parentNode) {
                    const newParagraph = document.createElement('p');
                    newParagraph.innerHTML = '<br>';
                    wrapper.parentNode.insertBefore(newParagraph, wrapper.nextSibling);

                    console.log('📍 ENTER Image - Création du paragraphe:', newParagraph);

                    // Attendre que tous les événements (onInput, handleWysiwygChange, etc.) se stabilisent
                    setTimeout(() => {
                      console.log('📍 ENTER Image - Positionnement curseur APRÈS stabilisation');

                      const selection = window.getSelection();
                      const range = document.createRange();

                      console.log('📍 ENTER Image - Selection avant (delayed):', selection.rangeCount);

                      // Positionner au début du paragraphe
                      range.setStart(newParagraph, 0);
                      range.collapse(true);

                      console.log('📍 ENTER Image - Range (delayed) startContainer:', range.startContainer);
                      console.log('📍 ENTER Image - Range (delayed) startOffset:', range.startOffset);

                      selection.removeAllRanges();
                      selection.addRange(range);

                      console.log('📍 ENTER Image - Selection (delayed) après:', selection.rangeCount);

                      // Focus pour s'assurer que le curseur est visible
                      editorRef.current?.focus();

                      console.log('📍 ENTER Image - Positionnement terminé avec succès!');
                    }, 100); // Délai pour laisser les événements se stabiliser

                    // Déclencher la sauvegarde
                    if (onInput) {
                      const event = new Event('input', { bubbles: true });
                      editorRef.current.dispatchEvent(event);
                    }

                    // Désélectionner l'image
                    if (onImageClick) {
                      onImageClick(null);
                    }
                  }
                  return;
                }
              }

              // Mise à jour du formatage pour les touches de navigation
              if (e && e.key && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                setTimeout(() => {
                  console.log('🔼 EDITOR onKeyDown Navigation - ignoreFlag:', ignoreSelectionChangeRef?.current);
                  if (onSelectionChange && !ignoreSelectionChangeRef?.current) {
                    console.log('✅ EDITOR Navigation - VA APPELER onSelectionChange');
                    onSelectionChange();
                  } else {
                    console.log('❌ EDITOR Navigation - onSelectionChange BLOQUÉ');
                  }
                }, 10);
              }
            }}
            onFocus={(e) => {
              console.log('🔍 WYSIWYG onFocus - Mise à jour formatage - ignoreFlag:', ignoreSelectionChangeRef?.current);
              if (onSelectionChange && !ignoreSelectionChangeRef?.current) {
                console.log('✅ EDITOR onFocus - VA APPELER onSelectionChange dans 10ms');
                setTimeout(onSelectionChange, 10);
              } else {
                console.log('❌ EDITOR onFocus - onSelectionChange BLOQUÉ');
              }
            }}
            onChange={(e) => {
              console.log('🔄 onChange déclenché!');
            }}
            onClick={onEditorClick}
            style={{
              minHeight: '384px',
              outline: 'none',
              padding: '20px',
              lineHeight: 'var(--dys-line-height)',
              fontFamily: 'var(--dys-font-family)',
              fontSize: 'var(--dys-font-size)',
              color: 'var(--dys-text-color)',
              backgroundColor: 'var(--dys-bg-color)',
              overflow: 'auto',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              border: '2px solid #cbd5e1', // Bordure plus visible (Slate-300)
              borderRadius: '8px',
              boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
            }}
          />
        </div>
      );

    case 'markdown': {
      console.log('📝 SWITCH - Vue MARKDOWN');
      const displayContent = content;

      return (
        <div key="markdown" className="relative">
          <textarea
            ref={(el) => {
              if (editorRef) editorRef.current = el;
            }}
            value={displayContent}
            onChange={(e) => {
              const newValue = e.target.value;
              const originalContent = content;

              if (newValue !== originalContent) {
                onInput({ ...e, target: { ...e.target, value: newValue } });
              }
            }}
            spellCheck={false}
            className="editor-content p-2 w-full h-full border-2 border-slate-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            style={{
              fontFamily: 'var(--dys-font-family)',
              fontSize: 'var(--dys-font-size)',
              lineHeight: 'var(--dys-line-height)',
              color: 'var(--dys-text-color)',
              backgroundColor: 'var(--dys-bg-color)',
              overflow: 'auto',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              paddingBottom: '2rem'
            }}
            placeholder="Écrivez en Markdown...

# Titre 1
## Titre 2
### Titre 3

**Gras** *Italique*

- Liste à puces
1. Liste numérotée
a. Liste alphabétique

$E = mc^2$ (formule inline)
$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$ (formule block)"
          />
        </div>
      );
    }

    case 'html': {
      console.log('🔧 SWITCH - Vue HTML');
      const htmlDisplayContent = formatHtmlForSource(content);

      return (
        <div key="html" className="relative">
          <textarea
            ref={(el) => {
              if (editorRef) editorRef.current = el;
            }}
            value={htmlDisplayContent}
            onChange={(e) => {
              const newValue = e.target.value;
              const originalWithCollapse = formatHtmlForSource(content);

              if (newValue !== originalWithCollapse) {
                onInput({ ...e, target: { ...e.target, value: newValue } });
              }
            }}
            className="editor-content p-2 w-full h-full border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            style={{
              fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
              overflow: 'auto',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              border: '2px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
              paddingBottom: '2rem'
            }}
            placeholder="Code source HTML..."
          />
        </div>
      );
    }

    default:
      console.log('❌ SWITCH - AUCUNE VUE CORRESPONDANTE, viewMode:', viewMode);
      return null;
  }
});

export default Editor;
