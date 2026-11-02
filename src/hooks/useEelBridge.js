import { useEffect } from 'react';
import { htmlToMarkdown, markdownToHtml, isMarkdownContent } from '../utils/markdownConverter';
import { saveImage } from '../utils/imageStore';

/**
 * Nettoie le contenu Markdown injecté pour éviter les défauts d'affichage
 * - Supprime les astérisques isolés (préserve **gras** et *italique*)
 * - Supprime les lignes vides excessives
 * @param {string} content - Le contenu Markdown à nettoyer
 * @returns {string} - Le contenu nettoyé
 */
const cleanIsolatedAsterisks = (content) => {
    if (!content) return '';

    // Préserver temporairement les syntaxes Markdown valides
    const preservedPatterns = [];
    let tempContent = content;

    // 1. Préserver les gras (**texte**)
    tempContent = tempContent.replace(/\*\*([^*]+)\*\*/g, (match) => {
        const marker = `__BOLD_${preservedPatterns.length}__`;
        preservedPatterns.push(match);
        return marker;
    });

    // 2. Préserver les italiques valides (*texte*)
    tempContent = tempContent.replace(/\*([^*\s][^*]*[^*\s])\*/g, (match) => {
        const marker = `__ITALIC_${preservedPatterns.length}__`;
        preservedPatterns.push(match);
        return marker;
    });

    // 3. Supprimer tous les astérisques restants (isolés)
    tempContent = tempContent.replace(/\*/g, '');

    // 4. Supprimer les lignes vides excessives (garder max 1 ligne vide entre les blocs)
    tempContent = tempContent.replace(/\n{3,}/g, '\n\n');

    // 5. Supprimer les lignes vides en début et fin
    tempContent = tempContent.trim();

    // 6. Restaurer les syntaxes Markdown préservées
    tempContent = tempContent.replace(/__(?:BOLD|ITALIC)_(\d+)__/g, (match, index) => {
        return preservedPatterns[parseInt(index)] || '';
    });

    return tempContent;
};

/**
 * Hook pour l'intégration Eel (Python ↔ JavaScript)
 * Expose les fonctions de lecture/écriture du contenu à Python
 * IMPORTANT: Python travaille TOUJOURS en format Markdown
 * 
 * @param {string} content - Contenu actuel de l'éditeur
 * @param {function} setContent - Fonction pour modifier le contenu
 * @param {string} viewMode - Mode de vue actuel ('wysiwyg', 'html', 'markdown')
 * @param {function} notifyExternalUpdate - Callback pour signaler un changement externe (MathJax, etc.)
 */
export const useEelBridge = (content, setContent, viewMode, notifyExternalUpdate) => {
    // Détecter si Eel est disponible (mode desktop)
    const isEelAvailable = typeof window !== 'undefined' && typeof window.eel !== 'undefined';

    // Exposer l'état desktop globalement pour les autres composants
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.isDesktopMode = isEelAvailable;
        }
    }, [isEelAvailable]);

    useEffect(() => {
        if (isEelAvailable) {
            console.log('🔗 Initialisation du pont Eel...');

            // Fonction pour lire le contenu Markdown actuel
            // TOUJOURS retourner du Markdown, peu importe la vue active
            window.readMarkdown = function () {
                console.log('📖 Python demande le contenu Markdown');

                if (!content) return '';

                // Si on est en vue Markdown ou si le contenu est déjà du Markdown
                if (viewMode === 'markdown' || isMarkdownContent(content)) {
                    console.log('✅ Contenu déjà en Markdown');
                    return content;
                }

                // Sinon, convertir HTML vers Markdown
                console.log('🔄 Conversion HTML → Markdown pour Python');
                const markdownContent = htmlToMarkdown(content);
                return markdownContent;
            };

            // Fonction pour écrire du contenu Markdown
            // Python envoie TOUJOURS du Markdown, on adapte selon la vue active
            window.writeMarkdown = function (newContent) {
                console.log('✏️ Python injecte du contenu Markdown:', newContent.substring(0, 50) + '...');

                if (!setContent || typeof setContent !== 'function') {
                    console.warn('⚠️ setContent non disponible');
                    return false;
                }

                // Nettoyer les astérisques isolés du contenu injecté
                const cleanedContent = cleanIsolatedAsterisks(newContent);
                console.log('🧹 Nettoyage des astérisques isolés effectué');

                // Forcer la perte de focus pour permettre la mise à jour (évite les blocages)
                const activeElement = document.activeElement;
                if (activeElement && activeElement.blur) {
                    activeElement.blur();
                }

                // Si on est en vue Markdown, injecter directement
                if (viewMode === 'markdown') {
                    console.log('✅ Injection directe en vue Markdown');
                    setContent(cleanedContent);
                    // Restaurer le focus après injection
                    setTimeout(() => {
                        const editorElement = document.querySelector('.editor-content');
                        if (editorElement) {
                            editorElement.focus();
                        }
                    }, 50);
                    return true;
                }

                // Sinon, convertir Markdown vers HTML pour les vues WYSIWYG/HTML
                console.log('🔄 Conversion Markdown → HTML pour vue', viewMode);
                const htmlContent = markdownToHtml(cleanedContent);
                setContent(htmlContent);

                // Forcer la mise à jour du DOM de l'éditeur WYSIWYG
                setTimeout(() => {
                    const editorElement = document.querySelector('.editor-content');
                    if (editorElement && viewMode === 'wysiwyg') {
                        // Mise à jour explicite du contenu WYSIWYG
                        editorElement.innerHTML = htmlContent;
                        console.log('🔄 Mise à jour forcée du DOM WYSIWYG');

                        // Déclencher un événement input pour synchroniser l'état React
                        const inputEvent = new Event('input', { bubbles: true });
                        editorElement.dispatchEvent(inputEvent);

                        // Restaurer le focus
                        editorElement.focus();
                    } else if (editorElement) {
                        editorElement.focus();
                    }
                }, 100);
                return true;
            };

            // Récupérer le document complet (texte + images) pour sauvegarde Python
            // IMPORTANT : fonction SYNCHRONE (pas async) — Eel ne gère pas les Promises
            window.readDocumentData = function () {
                console.log('💾 [readDocumentData] Python demande le document complet...');

                try {
                    // Récupérer le HTML actuel (toujours partir du HTML, quel que soit le viewMode)
                    let htmlContent = content;
                    if (viewMode === 'markdown' || isMarkdownContent(content)) {
                        htmlContent = markdownToHtml(content);
                    }

                    // Extraire les données des images LIVE depuis le DOM (déjà chargées → synchrone)
                    const editorElement = document.querySelector('.editor-content');
                    const liveImages = editorElement ? editorElement.querySelectorAll('img') : [];
                    console.log(`🔍 [readDocumentData] ${liveImages.length} image(s) live dans le DOM`);

                    // Map src → {base64, mimeType} depuis les images rendues
                    const srcToData = {};
                    for (const img of liveImages) {
                        const src = img.getAttribute('src');
                        if (!src) continue;

                        try {
                            // data: URL → extraire le base64 directement (pas besoin de canvas)
                            if (src.startsWith('data:')) {
                                const matches = src.match(/^data:([^;]+);base64,(.+)$/);
                                if (matches) {
                                    srcToData[src] = { base64: matches[2], mimeType: matches[1] };
                                }
                                continue;
                            }

                            // blob: URL ou autre → canvas synchrone (l'image est déjà chargée)
                            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.naturalWidth;
                                canvas.height = img.naturalHeight;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                const mimeType = 'image/png';
                                const dataUrl = canvas.toDataURL(mimeType);
                                const base64 = dataUrl.split(',')[1];
                                srcToData[src] = { base64, mimeType };
                            } else {
                                console.warn(`⚠️ [readDocumentData] Image non chargée, ignorée: ${src.substring(0, 50)}`);
                            }
                        } catch (imgError) {
                            console.warn(`⚠️ [readDocumentData] Impossible d'extraire l'image:`, imgError);
                        }
                    }

                    // Parser le HTML pour remplacer les src par des chemins relatifs
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    const parsedImages = doc.querySelectorAll('img');

                    const imageList = [];
                    let imageIndex = 0;

                    for (const img of parsedImages) {
                        const src = img.getAttribute('src');
                        if (!src) continue;

                        const imgData = srcToData[src];
                        if (!imgData) {
                            console.warn(`⚠️ [readDocumentData] Image sans données live, ignorée: ${src.substring(0, 50)}`);
                            continue;
                        }

                        // Générer un nom de fichier avec timestamp
                        const extension = imgData.mimeType.split('/')[1] || 'png';
                        const now = new Date();
                        const timestamp = now.getFullYear().toString() +
                            String(now.getMonth() + 1).padStart(2, '0') +
                            String(now.getDate()).padStart(2, '0') + '_' +
                            String(now.getHours()).padStart(2, '0') +
                            String(now.getMinutes()).padStart(2, '0') +
                            String(now.getSeconds()).padStart(2, '0');
                        const baseName = (img.alt || 'image').replace(/\.[^/.]+$/, '');
                        const filename = `${baseName}_${timestamp}_${imageIndex}.${extension}`;

                        imageList.push({ filename, data: imgData.base64, mimeType: imgData.mimeType });

                        // Remplacer le src dans le HTML parsé par le chemin relatif
                        img.setAttribute('src', `./images/${filename}`);

                        console.log(`✅ [readDocumentData] Image ${imageIndex}: ${filename}`);
                        imageIndex++;
                    }

                    // Convertir le HTML modifié en Markdown
                    const markdown = htmlToMarkdown(doc.body.innerHTML);

                    console.log(`✅ [readDocumentData] Document prêt: ${markdown.length} chars, ${imageList.length} image(s)`);
                    return { markdown, images: imageList };

                } catch (error) {
                    console.error('❌ [readDocumentData] Erreur:', error);
                    return { markdown: '', images: [] };
                }
            };

            // Charger un document complet (texte + images) depuis Python
            // IMPORTANT : fonction SYNCHRONE (pas async) — Eel ne gère pas les Promises
            window.writeDocumentData = function (data) {
                console.log('📂 [writeDocumentData] Python envoie un document complet...');

                try {
                    if (!data || !data.markdown) {
                        console.warn('⚠️ [writeDocumentData] Données invalides ou vides');
                        if (setContent) setContent('');
                        return false;
                    }

                    console.log(`📄 [writeDocumentData] Markdown: ${data.markdown.length} chars, ${(data.images || []).length} image(s)`);

                    // Construire le mapping filename → blobUrl et garder les blobs en mémoire
                    const filenameToBlob = {};
                    const filenameToActualBlob = {};

                    for (const image of (data.images || [])) {
                        try {
                            // Décoder le base64 en binaire
                            const binaryString = atob(image.data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const blob = new Blob([bytes], { type: image.mimeType });

                            // Créer une blob URL pour l'affichage
                            const blobUrl = URL.createObjectURL(blob);
                            filenameToBlob[image.filename] = blobUrl;
                            filenameToActualBlob[image.filename] = blob;

                            console.log(`✅ [writeDocumentData] Image décodée: ${image.filename} (${Math.round(blob.size / 1024)}KB)`);
                        } catch (imgError) {
                            console.warn(`⚠️ [writeDocumentData] Image ignorée (base64 invalide): ${image.filename}`, imgError);
                        }
                    }

                    // Convertir le Markdown en HTML
                    let htmlContent = markdownToHtml(data.markdown);

                    // Remplacer les chemins ./images/filename par les blob URLs
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlContent;

                    const htmlImages = tempDiv.querySelectorAll('img');
                    for (const img of htmlImages) {
                        const src = img.getAttribute('src') || '';
                        // Extraire le filename depuis ./images/filename
                        const match = src.match(/^\.\/images\/(.+)$/);
                        if (match) {
                            const filename = match[1];
                            const blobUrl = filenameToBlob[filename];

                            if (blobUrl) {
                                img.setAttribute('src', blobUrl);

                                // Sauvegarder en IndexedDB (fire-and-forget, pas de await)
                                let imageId = img.getAttribute('data-image-id');
                                if (!imageId) {
                                    imageId = crypto.randomUUID();
                                    img.setAttribute('data-image-id', imageId);
                                }

                                // Utiliser directement le blob déjà en mémoire (pas de fetch)
                                const blob = filenameToActualBlob[filename];
                                if (blob) {
                                    saveImage(imageId, blob).then(() => {
                                        console.log(`💾 [writeDocumentData] Image sauvegardée IndexedDB: ${imageId} (${filename})`);
                                    }).catch((dbError) => {
                                        console.warn(`⚠️ [writeDocumentData] Échec IndexedDB pour ${filename}:`, dbError);
                                    });
                                }

                                console.log(`🔗 [writeDocumentData] ${filename} → ${blobUrl}`);
                            } else {
                                console.warn(`⚠️ [writeDocumentData] Image non trouvée dans les données: ${filename}`);
                            }
                        }
                    }

                    htmlContent = tempDiv.innerHTML;

                    // Forcer la perte de focus pour permettre la mise à jour
                    const activeElement = document.activeElement;
                    if (activeElement && activeElement.blur) {
                        activeElement.blur();
                    }

                    // Injecter dans l'éditeur
                    setContent(htmlContent);

                    // Forcer la mise à jour du DOM WYSIWYG
                    setTimeout(() => {
                        const editorElement = document.querySelector('.editor-content');
                        if (editorElement) {
                            editorElement.innerHTML = htmlContent;
                            console.log('🔄 [writeDocumentData] DOM WYSIWYG mis à jour');

                            const inputEvent = new Event('input', { bubbles: true });
                            editorElement.dispatchEvent(inputEvent);
                            editorElement.focus();
                        }

                        // Notifier le changement externe (MathJax, etc.)
                        if (notifyExternalUpdate) {
                            notifyExternalUpdate();
                        }
                    }, 100);

                    console.log('✅ [writeDocumentData] Document chargé avec succès');
                    return true;

                } catch (error) {
                    console.error('❌ [writeDocumentData] Erreur:', error);
                    return false;
                }
            };

            // Exposer les fonctions à Python
            try {
                window.eel.expose(window.readMarkdown, 'readMarkdown');
                window.eel.expose(window.writeMarkdown, 'writeMarkdown');
                window.eel.expose(window.readDocumentData, 'readDocumentData');
                window.eel.expose(window.writeDocumentData, 'writeDocumentData');
                console.log('✅ Fonctions exposées à Python : readMarkdown, writeMarkdown, readDocumentData, writeDocumentData');
            } catch (error) {
                console.warn('⚠️ Erreur exposition Eel:', error);
            }
        }
    }, [content, setContent, viewMode, notifyExternalUpdate]);

    // Signaler à Python l'ouverture et la fermeture de l'éditeur (on_editor_open / on_editor_close)
    // Déclaré APRÈS l'effet d'exposition : les fonctions existent quand Python reçoit le signal
    // et charge un document. Avant l'ouverture du WebSocket, eel.js met l'appel en file d'attente.
    useEffect(() => {
        if (!isEelAvailable) return undefined;

        if (typeof window.eel.on_editor_open === 'function') {
            window.eel.on_editor_open();
            console.log('📡 Python notifié : éditeur ouvert');
        }

        // Au mieux : le WebSocket peut se fermer avant l'envoi. Python remet de toute façon
        // son état à zéro quand eel.start() rend la main.
        const notifierFermeture = () => {
            if (typeof window.eel.on_editor_close === 'function') {
                window.eel.on_editor_close();
            }
        };
        window.addEventListener('beforeunload', notifierFermeture);

        // Python demande la fermeture de la fenêtre quand on ferme le panneau de contrôle.
        // window.close() déclenche beforeunload : sauvegarde locale et on_editor_close() comme
        // pour une fermeture manuelle. Autorisé car la fenêtre --app n'a qu'une page d'historique.
        window.closeEditor = () => window.close();
        try {
            window.eel.expose(window.closeEditor, 'closeEditor');
        } catch (error) {
            console.warn('⚠️ Erreur exposition Eel (closeEditor):', error);
        }

        return () => {
            window.removeEventListener('beforeunload', notifierFermeture);
            delete window.closeEditor;
        };
    }, [isEelAvailable]);

    // Cleanup lors du démontage
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined') {
                delete window.readMarkdown;
                delete window.writeMarkdown;
                delete window.readDocumentData;
                delete window.writeDocumentData;
            }
        };
    }, []);
};
