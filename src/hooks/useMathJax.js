import { useEffect, useState, useCallback } from 'react';

// Hook pour initialiser MathJax en local
export const useMathJax = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Configuration MathJax déjà définie dans window.MathJax via index.html

    // Import dynamique de MathJax depuis node_modules
    import('mathjax/es5/tex-mml-chtml.js')
      .then(() => {
        // MathJax chargé avec succès
        if (window.MathJax && window.MathJax.typesetPromise) {
          console.log('✅ [useMathJax] MathJax chargé et prêt');
          setIsReady(true);
          // Force le re-rendu initial si nécessaire
          window.MathJax.typesetPromise();
        }
      })
      .catch(error => {
        console.warn('MathJax local non disponible, formules affichées en texte brut:', error);
      });
  }, []);

  // Fonction pour re-rendre les formules après mise à jour du contenu
  const renderMath = useCallback((container, onRenderComplete) => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      // Définir la cible : soit un conteneur spécifique, soit tout le document
      const target = container ? [container] : null;

      window.MathJax.typesetPromise(target)
        .then(() => {
          // Enrichissement POST-RENDU : Injecter le code TeX orignal dans le DOM
          // pour permettre la sauvegarde correcte en Markdown
          try {
            // Récupérer les éléments mathématiques dans le conteneur cible
            const mathItems = window.MathJax.startup.document.getMathItemsWithin(container || document.body);
            let enrichedCount = 0;

            mathItems.forEach(item => {
              // item.start.node est le noeud DOM (souvent un TextNode ou un élément mjx-container)
              // item.typesetRoot est l'élément rendu final (mjx-container)
              const element = item.typesetRoot;

              if (element) {
                // Récupérer le code TeX original
                const tex = item.math;
                // Identifier si c'est du display ($$) ou inline ($)
                const isDisplay = item.display;

                // Injecter dans des attributs data- pour le convertisseur MD
                element.setAttribute('data-tex', tex);
                element.setAttribute('data-display', isDisplay);
                enrichedCount++;
              }
            });

            if (enrichedCount > 0) {
              console.log(`✅ [MathJax] ${enrichedCount} formules enrichies avec data-tex`);
            }

            // Notifier la fin du rendu et de l'enrichissement
            if (onRenderComplete) {
              onRenderComplete(enrichedCount);
            }

          } catch (err) {
            console.warn('⚠️ [MathJax] Erreur lors de l\'enrichissement data-tex:', err);
          }
        })
        .catch(error => {
          console.warn('Erreur lors du rendu MathJax:', error);
        });
    }
  }, []);

  return { renderMath, isReady };
};
