import React, { createContext, useContext } from 'react';

// Créer le contexte
const EditorContext = createContext();

// Hook personnalisé pour utiliser le contexte
export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};

// Provider component
export const EditorProvider = ({ children, value }) => {
  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

export default EditorContext;
