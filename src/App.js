import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditor } from './hooks/useEditor';
import { useEelBridge } from './hooks/useEelBridge';
import { useThemeSettings } from './hooks/useThemeSettings';
import { useMathJax } from './hooks/useMathJax';
// Removed unused imports
// Removed PromptoDYS imports - using simple project management
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import StatusBar from './components/StatusBar';
import ThemeSettings from './components/ThemeSettings';

const App = () => {
  // 🟢 DEMO GIT: Ce commentaire est un "changement" pour tester le commit

  const {
    content,
    setContent,
    viewMode,
    changeViewMode,
    isWysiwyg,
    currentFormat,
    setCurrentFormat,
    editorRef,
    handleInput,
    updateCurrentFormat,
    ignoreSelectionChangeRef,
    selectedImage,
    setSelectedImage,
    handleImageClick,
    handleEditorClick
  } = useEditor();

  // Gestionnaire de blobs pour les images
  const blobStorageRef = useRef(new Map());

  const storeBlobForUrl = useCallback((blobUrl, file) => {
    console.log('💾 [App] Stockage blob pour URL:', blobUrl, 'File:', file?.name, 'Size:', file?.size);
    blobStorageRef.current.set(blobUrl, file);
    console.log('📊 [App] Total blobs stockés:', blobStorageRef.current.size);
  }, []);

  const getBlobFromUrl = useCallback((blobUrl) => {
    return blobStorageRef.current.get(blobUrl);
  }, []);

  const getAllBlobs = useCallback(() => {
    return blobStorageRef.current;
  }, []);

  // Sauvegarde automatique pour refresh F5
  useEffect(() => {
    const saveForRefresh = () => {
      const refreshData = {
        content: content,
        viewMode: viewMode,
        timestamp: Date.now()
      };
      console.log('💾 [App.js] Sauvegarde pour refresh:', {
        contentLength: content?.length,
        viewMode: viewMode,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('editor-refresh-backup', JSON.stringify(refreshData));
    };

    // Sauvegarder à chaque changement de contenu
    if (content) {
      console.log('📝 [App.js] Contenu modifié, sauvegarde...');
      saveForRefresh();
    }

    // Nettoyer avant de quitter
    const handleBeforeUnload = () => {
      console.log('🚪 [App.js] beforeunload - Sauvegarde finale avant refresh');
      saveForRefresh();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [content, viewMode]);


  // Hook pour paramètres de thème
  const {
    settings,
    backgroundOptions,
    textOptions,
    fontOptions,
    presetThemes,
    isSettingsOpen,
    updateSetting,
    resetToDefaults,
    applyPresetTheme,
    toggleSettings
  } = useThemeSettings();

  // ⚡ Intégration MathJax en local
  useMathJax();

  // État de restauration supprimé - éditeur volatil uniquement

  // ⚡ Intégration Eel pour support desktop
  useEelBridge(content, setContent, viewMode);

  return (
    <div className="h-screen w-full relative transition-colors duration-200" style={{ backgroundColor: 'var(--dys-bg-color)' }}>
      {/* Removed PromptoDYS error messages */}


      {/* Zone d'édition principale avec scroll indépendant */}
      <div className="editor-container">
        <div className="editor-scroll">
          <Editor
            viewMode={viewMode}
            content={content}
            editorRef={editorRef}
            onInput={handleInput}
            onSelectionChange={updateCurrentFormat}
            currentFormat={currentFormat}
            selectedImage={selectedImage}
            onImageClick={handleImageClick}
            onEditorClick={handleEditorClick}
            onDeleteSelectedImage={null}
            ignoreSelectionChangeRef={ignoreSelectionChangeRef}
            storeBlobForUrl={storeBlobForUrl}
          />
        </div>
      </div>

      {/* Toolbar fixée en bas */}
      <div className="fixed bottom-8 left-0 right-0 px-5 py-2 z-10" style={{ backgroundColor: 'var(--dys-bg-color)' }}>
        <Toolbar
          content={content}
          setContent={setContent}
          viewMode={viewMode}
          onViewModeChange={changeViewMode}
          currentFormat={currentFormat}
          onFormatChange={setCurrentFormat}
          editorRef={editorRef}
          onThemeSettingsToggle={toggleSettings}
          ignoreSelectionChangeRef={ignoreSelectionChangeRef}
          storeBlobForUrl={storeBlobForUrl}
          getBlobFromUrl={getBlobFromUrl}
          getAllBlobs={getAllBlobs}
        />
      </div>

      {/* StatusBar tout en bas */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-1 z-10" style={{ backgroundColor: 'var(--dys-bg-color)' }}>
        <StatusBar
          currentFormat={currentFormat}
          content={content}
          dysSettings={settings}
        />
      </div>

      {/* Modal ThemeSettings */}
      <ThemeSettings
        settings={settings}
        isSettingsOpen={isSettingsOpen}
        toggleSettings={toggleSettings}
        backgroundOptions={backgroundOptions}
        textOptions={textOptions}
        fontOptions={fontOptions}
        presetThemes={presetThemes}
        updateSetting={updateSetting}
        resetToDefaults={resetToDefaults}
        applyPresetTheme={applyPresetTheme}
      />
    </div>
  );
};

export default App;
