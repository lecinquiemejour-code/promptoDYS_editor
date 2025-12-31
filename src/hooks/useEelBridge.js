import { useEffect } from 'react';
import { htmlToMarkdown, markdownToHtml, isMarkdownContent } from '../utils/markdownConverter';

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
 */
export const useEelBridge = (content, setContent, viewMode) => {
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

            // Exposer les fonctions à Python
            try {
                window.eel.expose(window.readMarkdown, 'readMarkdown');
                window.eel.expose(window.writeMarkdown, 'writeMarkdown');
                console.log('✅ Fonctions exposées à Python : readMarkdown, writeMarkdown');
            } catch (error) {
                console.warn('⚠️ Erreur exposition Eel:', error);
            }
        }
    }, [content, setContent, viewMode]);

    // Cleanup lors du démontage
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined') {
                delete window.readMarkdown;
                delete window.writeMarkdown;
            }
        };
    }, []);
};
