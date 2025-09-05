import { useState, useRef, useCallback, useEffect } from 'react';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdownConverter';

export const useEditor = () => {
  // Vérifier d'abord s'il y a une sauvegarde de refresh
  const getInitialContent = () => {
    console.log('🔍 [useEditor] Vérification sauvegarde refresh...');
    try {
      const refreshData = localStorage.getItem('editor-refresh-backup');
      console.log('📦 [useEditor] Données refresh trouvées:', refreshData ? 'OUI' : 'NON');
      
      if (refreshData) {
        const parsed = JSON.parse(refreshData);
        const timeDiff = Date.now() - parsed.timestamp;
        console.log('⏱️ [useEditor] Temps écoulé depuis sauvegarde:', timeDiff, 'ms');
        console.log('📄 [useEditor] Contenu sauvegardé:', parsed.content?.substring(0, 100) + '...');
        
        // Restaurer toujours si contenu disponible (persistance infinie)
        if (parsed.content) {
          console.log('✅ [useEditor] Restauration du contenu sauvegardé!');
          return parsed.content;
        } else {
          console.log('❌ [useEditor] Pas de contenu sauvegardé');
        }
      }
    } catch (error) {
      console.error('❌ [useEditor] Erreur lors de la restauration du contenu:', error);
    }
    
    // Contenu par défaut si pas de sauvegarde récente
    console.log('📝 [useEditor] Utilisation du contenu par défaut');
    return '<p>Bienvenue dans votre éditeur WYSIWYG</p><p>Commencez à écrire votre <strong>document</strong> ici.</p><p>Le contenu est automatiquement sauvegardé.</p>';
  };

  const [content, setContent] = useState(getInitialContent());
  
  // Remplacer isWysiwyg par viewMode avec 3 options
  const [viewMode, setViewMode] = useState(() => {
    console.log('🔍 [useEditor] Vérification mode view pour refresh...');
    try {
      const refreshData = localStorage.getItem('editor-refresh-backup');
      if (refreshData) {
        const parsed = JSON.parse(refreshData);
        const timeDiff = Date.now() - parsed.timestamp;
        console.log('⏱️ [useEditor] Mode - Temps écoulé:', timeDiff, 'ms');
        console.log('👁️ [useEditor] Mode sauvegardé:', parsed.viewMode);
        
        // Restaurer toujours le mode si disponible (persistance infinie)
        if (parsed.viewMode) {
          console.log('✅ [useEditor] Restauration du mode:', parsed.viewMode);
          // Ne pas supprimer ici - laisser un délai pour éviter le double appel
          setTimeout(() => {
            console.log('🗑️ [useEditor] Nettoyage de la sauvegarde refresh');
            localStorage.removeItem('editor-refresh-backup');
          }, 1000);
          return parsed.viewMode;
        }
      }
    } catch (error) {
      console.error('❌ [useEditor] Erreur lors de la restauration du mode:', error);
    }
    
    // Force le mode 'wysiwyg' par défaut - toujours démarrer en mode visuel
    console.log('📝 [useEditor] Utilisation du mode par défaut: wysiwyg');
    return 'wysiwyg';
  });
  
  const [currentFormat, setCurrentFormat] = useState(() => {
    // Récupérer la police sauvegardée depuis localStorage
    const savedFont = localStorage.getItem('editor-font') || 'system-ui, -apple-system, sans-serif';
    return {
      bold: false,
      italic: false,
      color: '#000000',
      fontSize: '16px',
      fontFamily: savedFont,
      heading: null,
      list: null
    };
  });

  // État pour gérer l'image sélectionnée
  const [selectedImage, setSelectedImage] = useState(null);

  // Mémoriser le dernier formatage appliqué pour les débuts de ligne
  const lastAppliedFormatRef = useRef(null);
  
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const ignoreSelectionChangeRef = useRef(false);

  // Sauvegarder la sélection
  const saveSelection = useCallback(() => {
    if (window.getSelection && editorRef.current) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        selectionRef.current = selection.getRangeAt(0).cloneRange();
      }
    }
  }, []);

  // Restaurer la sélection
  const restoreSelection = useCallback(() => {
    if (selectionRef.current && editorRef.current) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
      editorRef.current.focus();
    }
  }, []);

  // Détecter l'état de formatage à la position du curseur
  const updateCurrentFormat = useCallback(() => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    let element = range.startContainer;

    // Si c'est un nœud texte, prendre le parent
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }

    // Si pas d'élément ou curseur en début de ligne, utiliser l'état mémorisé
    if (!element || element === editorRef.current) {
      if (lastAppliedFormatRef.current) {
        setCurrentFormat(lastAppliedFormatRef.current);
        return;
      }
    }

    // Si on vient d'appliquer un formatage Normal, le préserver
    if (lastAppliedFormatRef.current && 
        lastAppliedFormatRef.current.heading === null && 
        lastAppliedFormatRef.current.bold === false &&
        lastAppliedFormatRef.current.italic === false) {
      setCurrentFormat(lastAppliedFormatRef.current);
      return;
    }

    // Parcourir vers le haut pour trouver les styles
    let currentElement = element;
    const newFormat = {
      bold: false,
      italic: false,
      color: '#000000',
      fontSize: '16px',
      fontFamily: 'system-ui',
      heading: null,
      list: null
    };

    while (currentElement && currentElement !== editorRef.current) {
      const computedStyle = window.getComputedStyle(currentElement);
      const tagName = currentElement.tagName?.toLowerCase();


      // Vérifier les balises de formatage
      if (tagName === 'strong' || tagName === 'b' || computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 700) {
        newFormat.bold = true;
      }
      if (tagName === 'em' || tagName === 'i' || computedStyle.fontStyle === 'italic') {
        newFormat.italic = true;
      }
      if (tagName?.match(/^h[1-6]$/)) {
        newFormat.heading = tagName;
      }
      if (tagName === 'li') {
        // Trouver le parent ul ou ol
        let listParent = currentElement.parentElement;
        while (listParent && !['ul', 'ol'].includes(listParent.tagName?.toLowerCase())) {
          listParent = listParent.parentElement;
        }
        if (listParent) {
          const parentTag = listParent.tagName.toLowerCase();
          const listStyle = listParent.style.listStyleType;
          if (parentTag === 'ul') {
            newFormat.list = listStyle === 'lower-alpha' ? 'letter' : 'bullet';
          } else if (parentTag === 'ol') {
            newFormat.list = listStyle === 'lower-alpha' ? 'letter' : 'number';
          }
        }
      }
      if (tagName === 'ul') {
        const listStyle = currentElement.style.listStyleType;
        newFormat.list = listStyle === 'lower-alpha' ? 'letter' : 'bullet';
      }
      if (tagName === 'ol') {
        const listStyle = currentElement.style.listStyleType;
        newFormat.list = listStyle === 'lower-alpha' ? 'letter' : 'number';
      }

      // Vérifier les styles inline et computed
      if (currentElement.style?.color) {
        newFormat.color = currentElement.style.color;
      } else if (computedStyle.color && computedStyle.color !== 'rgb(0, 0, 0)') {
        newFormat.color = computedStyle.color;
      }
      if (currentElement.style?.fontSize) {
        newFormat.fontSize = currentElement.style.fontSize;
      }

      currentElement = currentElement.parentElement;
    }

    // Convertir rgb en hex si nécessaire
    if (newFormat.color.startsWith('rgb')) {
      newFormat.color = rgbToHex(newFormat.color);
    }

    setCurrentFormat(newFormat);
  }, []);

  // Convertir RGB en HEX
  const rgbToHex = (rgb) => {
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '#000000';
    
    const r = parseInt(result[0]);
    const g = parseInt(result[1]);
    const b = parseInt(result[2]);
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  // Gérer les changements de contenu
  const handleInput = useCallback((e) => {
    if (viewMode === 'wysiwyg') {
      setContent(e.target.innerHTML);
      // Laisser selectionchange gérer la synchronisation
    } else {
      setContent(e.target.value);
    }
  }, [viewMode]);

  // Gérer les changements de sélection
  const handleSelectionChange = useCallback(() => {
    console.log('🎯 HANDLESELECTIONCHANGE appelé - ignoreFlag:', ignoreSelectionChangeRef.current);
    if (ignoreSelectionChangeRef.current) {
      console.log('❌ selectionchange IGNORED - flag active');
      return;
    }
    if (viewMode === 'wysiwyg' && document.activeElement === editorRef.current) {
      console.log('✅ selectionchange PROCESSING - va appeler updateCurrentFormat');
      updateCurrentFormat();
      saveSelection();
      console.log('🔄 updateCurrentFormat et saveSelection appelés');
    } else {
      console.log('⚠️ selectionchange SKIP - viewMode:', viewMode, 'activeElement:', document.activeElement === editorRef.current);
    }
  }, [viewMode, updateCurrentFormat, saveSelection]);

  // Fonction pour changer de vue avec conversion automatique
  const changeViewMode = useCallback((newMode) => {
    if (newMode === viewMode) return;
    
    let newContent = content;
    
    // Conversions entre les vues
    if (viewMode === 'wysiwyg' && newMode === 'markdown') {
      newContent = htmlToMarkdown(content);
    } else if (viewMode === 'markdown' && newMode === 'wysiwyg') {
      newContent = markdownToHtml(content);
    } else if (viewMode === 'html' && newMode === 'markdown') {
      newContent = htmlToMarkdown(content);
    } else if (viewMode === 'markdown' && newMode === 'html') {
      newContent = markdownToHtml(content);
    }
    // wysiwyg -> html : nettoyer les data-attributes
    if (viewMode === 'wysiwyg' && newMode === 'html') {
      newContent = content.replace(/ data-type="[^"]*"/g, '')
                         .replace(/ data-number="[^"]*"/g, '')
                         .replace(/ data-letter="[^"]*"/g, '');
    }
    // html -> wysiwyg : pas de conversion nécessaire
    
    setContent(newContent);
    setViewMode(newMode);
  }, [viewMode, content]);

  // Écouter les changements de sélection
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Sauvegarder la police sélectionnée dans localStorage
  useEffect(() => {
    if (currentFormat.fontFamily) {
      localStorage.setItem('editor-font', currentFormat.fontFamily);
    }
  }, [currentFormat.fontFamily]);

  // Fonction pour sauvegarder l'état appliqué
  const saveAppliedFormat = useCallback((format) => {
    lastAppliedFormatRef.current = { ...format };
  }, []);

  // Gestionnaire pour sélectionner une image
  const handleImageClick = useCallback((imageElement) => {
    if (viewMode === 'wysiwyg') {
      setSelectedImage(imageElement);
      // Déselectionner le texte pour éviter les conflits
      window.getSelection().removeAllRanges();
    }
  }, [viewMode]);

  // Gestionnaire pour désélectionner l'image si clic ailleurs
  const handleEditorClick = useCallback((e) => {
    if (viewMode === 'wysiwyg' && selectedImage) {
      // Si le clic n'est pas sur l'image sélectionnée, la désélectionner
      if (e.target !== selectedImage && !selectedImage.contains(e.target)) {
        setSelectedImage(null);
      }
    }
  }, [viewMode, selectedImage]);


  return {
    content,
    setContent,
    viewMode,
    setViewMode,
    changeViewMode,
    // Compatibilité avec l'ancien système
    isWysiwyg: viewMode === 'wysiwyg',
    setIsWysiwyg: (value) => changeViewMode(value ? 'wysiwyg' : 'html'),
    currentFormat,
    setCurrentFormat,
    editorRef,
    handleInput,
    saveSelection,
    restoreSelection,
    updateCurrentFormat,
    saveAppliedFormat,
    ignoreSelectionChangeRef,
    // Gestion de sélection d'images
    selectedImage,
    setSelectedImage,
    handleImageClick,
    handleEditorClick
  };
};
