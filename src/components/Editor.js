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
  editorRef,
  selectedMath,
  onMathClick,
  setSelectedMath,
  highlightInfo
}, ref) => {


  // Utilise editorRef passée en props (pas de ref locale)
  const isInitializedRef = useRef(false);
  const previousContentRef = useRef('');
  const [highlightRect, setHighlightRect] = React.useState(null);
  const [trailingHighlights, setTrailingHighlights] = React.useState([]);
  const previousRectRef = useRef(null);
  const selectionRangeRef = useRef(null);

  // Sauvegarder la sélection au début de la lecture
  useEffect(() => {
    if (highlightInfo && highlightInfo.charIndex === 0) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        selectionRangeRef.current = sel.getRangeAt(0).cloneRange();
        // Faire disparaître la sélection native (le bloc bleu) pour ne laisser que notre surlignage
        sel.removeAllRanges();
      }
    }
    if (!highlightInfo) {
      setHighlightRect(null);
      selectionRangeRef.current = null;
    }
  }, [highlightInfo]);

  // Gestion des calculs de position et de la persistance
  useEffect(() => {
    // 1. Sauvegarder l'ancien rect dans l'historique (persistance)
    if (previousRectRef.current) {
      const id = Date.now() + Math.random();
      const rect = previousRectRef.current;
      setTrailingHighlights(prev => [...prev, { id, rect }]);

      // Auto-nettoyage après 2s (durée de l'animation)
      setTimeout(() => {
        setTrailingHighlights(prev => prev.filter(i => i.id !== id));
      }, 2000);
    }

    if (!highlightInfo) {
      setHighlightRect(null);
      previousRectRef.current = null;
      // On ne vide PAS trailingHighlights ici, on les laisse s'estomper naturellement
    }
  }, [highlightInfo]); // Déclenché à chaque changement de mot

  // Calculer la position du mot en cours
  useEffect(() => {
    if (highlightInfo && selectionRangeRef.current && editorRef.current) {
      try {
        const range = document.createRange();
        const startNode = selectionRangeRef.current.startContainer;
        const startOffset = selectionRangeRef.current.startOffset;

        // Cette partie est complexe car on doit traverser les noeuds de texte
        // Pour simplifier : on va utiliser le texte du range initial
        // et créer un sous-range pour le mot

        // Approche simplifiée : On utilise la sélection actuelle pour trouver le point de départ
        // Puis on avance de charIndex caractères

        let currentChar = 0;
        let targetNode = null;
        let targetOffset = 0;

        // Fonction intelligente pour trouver la position en tenant compte des retours à la ligne implicites
        const findPos = (root, targetIndex) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, false);
          let node;
          let currentIdx = 0;
          let started = false;

          let lastBlockParent = null;
          let lastNodeText = '';

          while (node = walker.nextNode()) {
            // 1. Gérer les noeuds TEXTE
            if (node.nodeType === Node.TEXT_NODE) {
              const textContent = node.textContent;
              const currentBlockParent = node.parentElement;

              // Détection de changement de bloc pour ajout éventuel de saut de ligne virtuel
              if (started && lastBlockParent && currentBlockParent !== lastBlockParent) {
                const oldBlock = lastBlockParent.closest('p, div, li, h1, h2, h3, h4, h5, h6');
                const newBlock = currentBlockParent.closest('p, div, li, h1, h2, h3, h4, h5, h6');

                // Si on change vraiment de bloc visuel
                if (oldBlock !== newBlock) {
                  // RÈGLE CRITIQUE : Ne PAS ajouter +1 si le texte en contient déjà un
                  // Le navigateur ecrase les espaces mais avec pre-wrap ils comptent
                  const lastEndedWithNl = lastNodeText.endsWith('\n');
                  const currentStartsWithNl = textContent.startsWith('\n');

                  if (!lastEndedWithNl && !currentStartsWithNl) {
                    currentIdx += 1; // +1 pour le saut de ligne implicite (ex: entre deux <p>)
                  }
                }
              }

              lastBlockParent = currentBlockParent;
              lastNodeText = textContent;

              // Logique de démarrage
              if (!started) {
                if (node === selectionRangeRef.current.startContainer) {
                  started = true;
                  // Pour le premier noeud, on ne compte que la partie sélectionnée
                  const len = textContent.length - selectionRangeRef.current.startOffset;

                  if (currentIdx + len > targetIndex) {
                    return { node, offset: selectionRangeRef.current.startOffset + (targetIndex - currentIdx) };
                  }

                  currentIdx += len;
                  continue;
                }
                continue;
              }

              // Logique standard
              const len = textContent.length;

              // Si on dépasse targetIndex, c'est que la cible est DANS ce noeud (ou qu'on l'a légèrement dépassée à cause du +1)
              if (currentIdx + len > targetIndex) {
                let offset = targetIndex - currentIdx;

                // CORRECTION CRITIQUE : Gestion du "Overshoot"
                // Si on a ajouté un +1 artificiel en trop (changement de bloc), on peut se retrouver avec un offset de -1.
                // Dans ce cas, on "clamp" à 0 pour pointer sur le début du mot.
                if (offset < 0) {
                  if (offset >= -2) { // Tolérance de 2 caractères
                    // console.log('🔧 Overshoot corrigé dans findPos (clamped to 0)');
                    offset = 0;
                  } else {
                    // Si c'est vraiment trop loin, c'est qu'on a raté le noeud avant ? 
                    // On laisse faire, le resync s'en chargera peut-être ou ça retournera un offset invalide.
                  }
                }

                return { node, offset };
              }

              // Si on atteint pile la fin
              if (currentIdx + len === targetIndex) {
                return { node, offset: len };
              }

              currentIdx += len;
            }

            // 2. Gérer les <br> explicites
            else if (node.nodeName === 'BR') {
              if (started) {
                // Un BR est toujours un saut de ligne
                currentIdx += 1;

                // Pour l'historique
                lastBlockParent = node.parentElement;
                lastNodeText = '\n'; // On simule un saut de ligne textuel

                if (currentIdx === targetIndex) {
                  return { node: node.parentNode, offset: Array.from(node.parentNode.childNodes).indexOf(node) + 1 };
                }
              }
            }
          }
          return null;
        };

        // Fonction pour lire le texte à une position donnée pour vérification
        const getTextAtPos = (pos, length) => {
          if (!pos) return '';
          const range = document.createRange();
          range.setStart(pos.node, pos.offset);
          // Attention: setEnd peut dépasser le noeud si length est grand
          // Version simplifiée : on regarde juste le début du noeud
          if (pos.node.nodeType === Node.TEXT_NODE) {
            return pos.node.textContent.substr(pos.offset, length);
          }
          return '';
        };

        let startPos = findPos(editorRef.current, highlightInfo.charIndex);

        // --- LOGIQUE DE RESYNCHRONISATION ---
        // Si on a le mot attendu, on vérifie qu'on est au bon endroit
        if (highlightInfo.word && startPos) {
          const foundText = getTextAtPos(startPos, highlightInfo.word.length);
          // On nettoie les textes pour la comparaison (casse, espaces)
          const cleanFound = foundText.trim().toLowerCase();
          const cleanExpected = highlightInfo.word.trim().toLowerCase();

          // Si ça ne matche pas, on cherche autour !
          if (!cleanFound.startsWith(cleanExpected)) {
            console.log(`⚠️ TTS Décalage détecté! Attendu: "${cleanExpected}", Trouvé: "${cleanFound}"`);

            // Recherche locale +/- 10 caractères
            for (let offset = -10; offset <= 10; offset++) {
              if (offset === 0) continue;
              const tryPos = findPos(editorRef.current, highlightInfo.charIndex + offset);
              if (tryPos) {
                const tryText = getTextAtPos(tryPos, highlightInfo.word.length);
                if (tryText.trim().toLowerCase().startsWith(cleanExpected)) {
                  console.log(`✅ TTS Resync réussi à offset ${offset}`);
                  startPos = tryPos;
                  // On corrige aussi la fin
                  break;
                }
              }
            }
          }
        }

        // Calcul de la fin basé sur la position (potentiellement corrigée)
        // On ne recule pas findPos complet pour la fin, on avance juste
        // MAIS pour être propre, on recalcule findPos relatif ou on avance manuellement
        // Simplification: on refait findPos avec le même décalage si on a corrigé
        // Mais on n'a pas stocké l'offset corrigé. Recalculons endPos simplement.
        // Si startPos est bon, endPos est startPos + length.

        // Approche robuste pour endPos : on part de startPos et on avance de length
        let endPos = null;
        if (startPos) {
          // On utilise une logique locale pour trouver la fin
          // C'est plus sûr que de rappeler findPos globalement
          const range = document.createRange();
          range.setStart(startPos.node, startPos.offset);

          // On cherche le endContainer/endOffset en avançant de 'length' caractères
          let remaining = highlightInfo.length;
          let currentNode = startPos.node;
          let currentOffset = startPos.offset;

          while (remaining > 0 && currentNode) {
            if (currentNode.nodeType === Node.TEXT_NODE) {
              const available = currentNode.textContent.length - currentOffset;
              if (available >= remaining) {
                endPos = { node: currentNode, offset: currentOffset + remaining };
                remaining = 0;
              } else {
                remaining -= available;
                // Passer au noeud suivant (TreeWalker ou logique simple nextSibling)
                // Ici c'est dur de naviguer sans walker.
                // Fallback : On utilise findPos global avec l'offset corrigé ?
                // Non on ne connait pas l'offset corrigé exact en nombre global
              }
            }
            if (remaining > 0) {
              // Navigation manuelle vers le prochain noeud texte
              // C'est complexe.
              // SOLUTION SIMPLE : On refait findPos avec l'index corrigé si on l'avait trouvé
              break;
            }
          }
        }

        // Si la boucle manuelle échoue (cas multi-noeuds complexe), on fallback sur findPos global
        if (!endPos) {
          // On suppose que le décalage trouvé pour le début s'applique à la fin
          // (C'est souvent le cas si c'est un décalage de structure)
          // Mais on n'a pas stocké "offset" dans la boucle for.
          endPos = findPos(editorRef.current, highlightInfo.charIndex + highlightInfo.length);
        }

        if (startPos && endPos) {
          range.setStart(startPos.node, startPos.offset);
          range.setEnd(endPos.node, endPos.offset);

          const rects = range.getClientRects();
          if (rects.length > 0) {
            const editorRect = editorRef.current.getBoundingClientRect();
            // ... (calculs de scroll si nécessaire, simplifiés ici car getBoundingClientRect est relatif au viewport, 
            // mais on veut relatif à l'éditeur qui est overflow:auto ? Non, le div overlay est absolu dans le relative container)

            // Correction calcul offset
            // Si le div parent (editor-content wrapper) est relative, top/left doivent être relatifs à ce parent.
            // editorRect est le rect du textarea/div contentEditable.

            const r = rects[0];
            const newRect = {
              top: r.top - editorRect.top, // + editorRef.current.scrollTop si besoin, mais ici c'est sticky
              left: r.left - editorRect.left, // + editorRef.current.scrollLeft
              width: r.width,
              height: r.height
            };

            setHighlightRect(newRect);
            previousRectRef.current = newRect; // Stocker pour le prochain cycle
          }
        } else {
          // Si pas de highlight, effacer les trailing highlights aussi
          setTrailingHighlights([]);
        }
      } catch (e) {
        console.warn('Erreur calcul highlight:', e);
      }
    } else {
      // Si highlightInfo est null, effacer tous les highlights
      setHighlightRect(null);
      setTrailingHighlights([]);
    }
  }, [highlightInfo, editorRef]);

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
        // Utiliser la fonction renderMath passée en props si disponible (depuis useMathJax)
        if (mathJaxReady && mathJaxReady.renderMath) {
          mathJaxReady.renderMath(editorRef.current, (enrichedCount) => {
            if (enrichedCount > 0) {
              console.log(`🔄 [Editor] MathJax enrichi (${enrichedCount}), update state triggered`);
              // Déclencher un événement input pour mettre à jour l'état React "content"
              // avec le nouveau DOM contenant les attributs data-tex
              if (onInput) {
                onInput({ target: { innerHTML: editorRef.current.innerHTML } });
              }
            }
          });
        } else if (window.MathJax && window.MathJax.typesetPromise) {
          // Fallback ancien code si renderMath n'est pas dispo
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

  // NOUVEAU: Effet pour rattraper le rendu MathJax si nécessaire (Start-up ou Changement contenu)
  // Ne se déclenche QUE si MathJax est prêt ET qu'il reste des formules non rendues ($...$)
  useEffect(() => {
    if (viewMode === 'wysiwyg' && editorRef.current && mathJaxReady?.isReady && mathJaxReady.renderMath) {
      // On vérifie s'il y a des maths non rendus
      const html = editorRef.current.innerHTML;
      if (html.includes('$') && !html.includes('mjx-container')) {
        console.log('🔄 [Editor] MathJax Check - Rendu de rattrapage nécessaire');
        mathJaxReady.renderMath(editorRef.current, (enrichedCount) => {
          if (enrichedCount > 0) {
            if (onInput) onInput({ target: { innerHTML: editorRef.current.innerHTML } });
          }
        });
      }
    }
  }, [mathJaxReady?.isReady, viewMode, content]); // Ajout de content pour vérifier à chaque changement de fichier



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

          // Si c'est une action "Couper", on supprime l'image
          if (e.type === 'cut') {
            const wrapper = selectedImage.closest('.resizable-image');
            const elementToRemove = wrapper || selectedImage;
            const parent = elementToRemove.parentElement;
            elementToRemove.remove();

            // Nettoyer le parent si c'était une image-line devenue vide
            if (parent && parent.classList.contains('image-line') && parent.innerHTML.trim() === '') {
              parent.remove();
            }

            if (onImageClick) onImageClick(null);
            if (onInput) onInput({ target: { innerHTML: editorRef.current.innerHTML } });
            console.log('✂️ Image coupée (supprimée)');
          }
          return;
        } catch (error) {
          console.warn('Erreur copie image:', error);
        }
      }

      // Priorité 1.5: Si une formule mathématique est sélectionnée, copier le TeX
      if (selectedMath) {
        try {
          const tex = selectedMath.getAttribute('data-tex') || '';
          const isDisplay = selectedMath.getAttribute('data-display') === 'true';
          const delimiter = isDisplay ? '$$' : '$';
          const mathString = `${delimiter}${tex}${delimiter}`;

          e.clipboardData.setData('text/plain', mathString);
          e.preventDefault();
          console.log('✅ Formule mathématique copiée:', mathString);

          // Si c'est une action "Couper", on supprime l'élément
          if (e.type === 'cut') {
            selectedMath.remove();
            setSelectedMath(null);
            if (onInput) onInput({ target: { innerHTML: editorRef.current.innerHTML } });
            console.log('✂️ Formule mathématique coupée (supprimée)');
          }
          return;
        } catch (error) {
          console.warn('Erreur copie math:', error);
        }
      }

      // Priorité 2: Sélection de texte classique
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedContent = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(selectedContent);

        // Convertir HTML en texte intelligemment
        // Remplacer d'abord les mjx-container par leur code TeX original
        const mathContainers = tempDiv.querySelectorAll('mjx-container[data-tex]');
        mathContainers.forEach(container => {
          const tex = container.getAttribute('data-tex') || '';
          const isDisplay = container.getAttribute('data-display') === 'true';
          const delimiter = isDisplay ? '$$' : '$';
          // Remplacer le contenu du conteneur par le texte TeX brut avant stripping
          container.textContent = `${delimiter}${tex}${delimiter}`;
        });

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
  }, [viewMode, selectedImage, selectedMath, onInput, editorRef]);


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

        // Forcer le rendu MathJax après un collage pour transformer les $...$ en formules
        if (mathJaxReady?.isReady && mathJaxReady.renderMath) {
          console.log('🔄 [handlePaste] Déclenchement rendu MathJax post-collage');
          mathJaxReady.renderMath(editorRef.current);
        }

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

  // Gestionnaire pour les touches (Delete/Backspace) quand un bloc est sélectionné
  const handleKeyDown = useCallback((e) => {
    if (viewMode === 'wysiwyg' && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (selectedImage) {
        const wrapper = selectedImage.closest('.resizable-image');
        const elementToRemove = wrapper || selectedImage;
        const parent = elementToRemove.parentElement;

        console.log('🗑️ Suppression de l\'image');
        elementToRemove.remove();

        // Nettoyer le parent si c'était une image-line devenue vide
        if (parent && parent.classList.contains('image-line') && parent.innerHTML.trim() === '') {
          parent.remove();
        }

        onImageClick(null);
        e.preventDefault();
        if (onInput) onInput({ target: { innerHTML: editorRef.current.innerHTML } });
      } else if (selectedMath) {
        console.log('🗑️ Suppression de la formule mathématique');
        selectedMath.remove();
        setSelectedMath(null);
        e.preventDefault();
        if (onInput) onInput({ target: { innerHTML: editorRef.current.innerHTML } });

        // Rafraîchir MathJax au cas où
        if (mathJaxReady?.isReady && mathJaxReady.renderMath) {
          setTimeout(() => mathJaxReady.renderMath(editorRef.current), 10);
        }
      }
    }
  }, [viewMode, selectedImage, selectedMath, onInput, onImageClick, setSelectedMath, mathJaxReady, editorRef]);

  // Gestionnaire unifié pour le clic dans l'éditeur
  const handleClick = useCallback((e) => {
    // Détection clic sur MathJax
    const mathContainer = e.target.closest('mjx-container[data-tex]');
    if (mathContainer) {
      console.log('🎯 Clic sur MathJax détecté');
      onMathClick(mathContainer);
      e.stopPropagation();
      return;
    }

    // Sinon passer au gestionnaire par défaut
    onEditorClick(e);
  }, [onMathClick, onEditorClick]);

  // Gestionnaire spécifique pour le clic DROIT (contextmenu)
  const handleContextMenu = useCallback((e) => {
    const mathContainer = e.target.closest('mjx-container[data-tex]');
    if (mathContainer) {
      console.log('🖱️ Clic droit sur MathJax détecté');
      onMathClick(mathContainer);
      // On ne fait pas preventDefault ici pour laisser le menu contextuel s'ouvrir
    }
  }, [onMathClick]);

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
      editorRef.current.addEventListener('cut', handleCopy); // Cut utilise la même logique que Copy + Delete
      editorRef.current.addEventListener('keydown', handleKeyDown);
      editorRef.current.addEventListener('paste', handlePaste);
      editorRef.current.addEventListener('paste', debugPaste); // DEBUG GLOBAL
      editorRef.current.addEventListener('click', handleClick);
      editorRef.current.addEventListener('contextmenu', handleContextMenu);

      console.log('✅ [DEBUG] Events attachés à editorRef.current');

      return () => {
        console.log('🗑️ [DEBUG] Nettoyage events');
        document.removeEventListener('selectionchange', handleSelectionChange);
        editorRef.current?.removeEventListener('copy', handleCopy);
        editorRef.current?.removeEventListener('cut', handleCopy);
        editorRef.current?.removeEventListener('keydown', handleKeyDown);
        editorRef.current?.removeEventListener('paste', handlePaste);
        editorRef.current?.removeEventListener('paste', debugPaste);
        editorRef.current?.removeEventListener('click', handleClick);
        editorRef.current?.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [viewMode, handleSelectionChange, handleCopy, handleKeyDown, handleClick, handleContextMenu]);

  // Effect pour appliquer le style de sélection d'image et math
  useEffect(() => {
    if (viewMode === 'wysiwyg' && editorRef.current) {
      // Nettoyage images
      const allImages = editorRef.current.querySelectorAll('img');
      allImages.forEach(img => {
        const wrapper = img.closest('.resizable-image');
        if (wrapper) wrapper.classList.remove('image-selected');
      });

      // Nettoyage maths
      const allMaths = editorRef.current.querySelectorAll('mjx-container');
      allMaths.forEach(math => {
        math.classList.remove('math-selected');
      });

      // Appliquer sélection image
      if (selectedImage) {
        const wrapper = selectedImage.closest('.resizable-image');
        if (wrapper) wrapper.classList.add('image-selected');
      }

      // Appliquer sélection math
      if (selectedMath) {
        selectedMath.classList.add('math-selected');
      }
    }
  }, [selectedImage, selectedMath, viewMode, content]);

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
            .resize-handle.se { bottom: -2px; right: -2px; cursor: se-resize; }
            
            @keyframes fadeOutHighlight {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
          <div
            className="editor-content"
            style={{ position: 'relative' }}
          >
            <div
              className="editor-content"
              ref={(el) => { editorRef.current = el; }}
              // ... props inchangées ...
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
            {/* Trailing Highlights (Persistance) */}
            {trailingHighlights.map(h => (
              <div
                key={h.id}
                style={{
                  position: 'absolute',
                  top: h.rect.top,
                  left: h.rect.left,
                  width: h.rect.width,
                  height: h.rect.height,
                  backgroundColor: 'transparent',
                  borderBottom: '4px solid #FF8C00',
                  borderRadius: '0px',
                  pointerEvents: 'none',
                  zIndex: 4, // Derrière le courant
                  animation: 'fadeOutHighlight 2s ease-out forwards' // Animation CSS
                }}
              />
            ))}

            {/* Overlay de surlignage TTS (Courant) */}
            {highlightRect && (
              <div
                style={{
                  position: 'absolute',
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  backgroundColor: 'transparent', // Plus de fond plein
                  borderBottom: '4px solid #FF8C00', // Soulignement orange épais
                  borderRadius: '0px', // Pas de coins arrondis pour une ligne
                  pointerEvents: 'none',
                  zIndex: 5,
                  transition: 'all 0.1s ease-out'
                }}
              />
            )}
          </div>
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
