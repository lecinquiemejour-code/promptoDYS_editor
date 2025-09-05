import { useEffect } from 'react';

// Hook pour initialiser MathJax en local
export const useMathJax = () => {
  useEffect(() => {
    // Configuration MathJax déjà définie dans window.MathJax via index.html
    
    // Import dynamique de MathJax depuis node_modules
    import('mathjax/es5/tex-mml-chtml.js')
      .then(() => {
        // MathJax chargé avec succès
        if (window.MathJax && window.MathJax.typesetPromise) {
          // Force le re-rendu initial si nécessaire
          window.MathJax.typesetPromise();
        }
      })
      .catch(error => {
        console.warn('MathJax local non disponible, formules affichées en texte brut:', error);
      });
  }, []);

  // Fonction pour re-rendre les formules après mise à jour du contenu
  const renderMath = () => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(error => {
        console.warn('Erreur lors du rendu MathJax:', error);
      });
    }
  };

  return { renderMath };
};
