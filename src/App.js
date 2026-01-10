import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditor } from './hooks/useEditor';
import { useEelBridge } from './hooks/useEelBridge';
import { useThemeSettings } from './hooks/useThemeSettings';
import { useMathJax } from './hooks/useMathJax';
import { useConfig } from './hooks/useConfig';
import useTextToSpeech from './hooks/useTextToSpeech';
// Removed unused imports
// Removed PromptoDYS imports - using simple project management
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import StatusBar from './components/StatusBar';
import ThemeSettings from './components/ThemeSettings';
import SettingsModal from './components/Settings/SettingsModal';

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
    selectedMath,
    setSelectedMath,
    handleMathClick,
    handleEditorClick,
    restoreSelection,
    saveSelection
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

  // Hook pour configuration générale de l'application
  const { config, setConfigValue, isLoading: configLoading } = useConfig();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Hook Text-to-Speech
  const {
    isSupported: isTtsSupported,
    isSpeaking,
    isPaused,
    speak,
    pause,
    resume,
    cancel,
    highlightInfo
  } = useTextToSpeech({
    voiceName: settings.voiceName,
    rate: settings.voiceRate,
    pitch: settings.voicePitch
  });

  // Gestionnaires TTS
  const handleSpeak = useCallback(() => {
    if (isPaused) {
      resume();
      return;
    }

    if (isSpeaking) {
      pause();
      return;
    }

    const selection = window.getSelection();
    const textToRead = selection.toString().trim();

    if (textToRead) {
      speak(textToRead);
    }
  }, [isPaused, isSpeaking, resume, pause, speak]);

  const handleStopSpeak = useCallback(() => {
    cancel();
  }, [cancel]);

  // Log du mode développeur
  useEffect(() => {
    if (!configLoading && config.developer_mode) {
      console.log('🐛 [App] Mode développeur activé');
      console.log('📋 [App] Configuration complète:', config);
    }
  }, [config, configLoading]);

  // Forcer le mode WYSIWYG si developer_mode est désactivé et qu'on est en mode markdown/html
  useEffect(() => {
    if (!configLoading && !config.developer_mode && (viewMode === 'markdown' || viewMode === 'html')) {
      console.log('⚠️ [App] Mode développeur désactivé - Retour au mode WYSIWYG');
      changeViewMode('wysiwyg');
    }
  }, [config.developer_mode, configLoading, viewMode, changeViewMode]);

  // ⚡ Intégration MathJax en local
  const mathJaxReady = useMathJax();

  // 🔔 Signal de mise à jour externe (pour déclencher MathJax uniquement sur evt)
  const [lastExternalUpdate, setLastExternalUpdate] = useState(0);

  const notifyExternalUpdate = useCallback(() => {
    console.log('🔔 [App] Notification de mise à jour externe reçue');
    setLastExternalUpdate(prev => prev + 1);
  }, []);

  // État de restauration supprimé - éditeur volatil uniquement

  // ⚡ Intégration Eel pour support desktop
  useEelBridge(content, setContent, viewMode, notifyExternalUpdate);

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
            selectedMath={selectedMath}
            onMathClick={handleMathClick}
            setSelectedMath={setSelectedMath}
            onEditorClick={handleEditorClick}
            onDeleteSelectedImage={null}
            ignoreSelectionChangeRef={ignoreSelectionChangeRef}
            storeBlobForUrl={storeBlobForUrl}
            mathJaxReady={mathJaxReady}
            externalUpdateTrigger={lastExternalUpdate}
            highlightInfo={highlightInfo}
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
          onConfigModalToggle={() => setIsConfigModalOpen(true)}
          developerMode={config.developer_mode}
          ignoreSelectionChangeRef={ignoreSelectionChangeRef}
          selectedImage={selectedImage}
          selectedMath={selectedMath}
          restoreSelection={restoreSelection}
          saveSelection={saveSelection}
          storeBlobForUrl={storeBlobForUrl}
          getBlobFromUrl={getBlobFromUrl}
          getAllBlobs={getAllBlobs}
          onContentLoad={notifyExternalUpdate}
        />
      </div>

      {/* StatusBar tout en bas */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-0 z-10" style={{ backgroundColor: 'var(--dys-bg-color)' }}>
        <StatusBar
          currentFormat={currentFormat}
          content={content}
          dysSettings={settings}
          isTtsSupported={isTtsSupported}
          isSpeaking={isSpeaking}
          isPaused={isPaused}
          handleSpeak={handleSpeak}
          handleStopSpeak={handleStopSpeak}
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

      {/* Modal de Configuration Générale */}
      <SettingsModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onConfigChange={setConfigValue}
      />
    </div>
  );
};

export default App;
