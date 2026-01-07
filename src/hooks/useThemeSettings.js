import { useState, useEffect } from 'react';

export const useThemeSettings = () => {
  // Valeurs par défaut du thème
  const defaultSettings = {
    backgroundColor: '#fffef7', // Ivoire
    textColor: '#1e3a8a',       // Bleu marine
    fontFamily: 'Verdana',      // Police recommandée pour l'accessibilité
    fontSize: 14,               // Taille minimale recommandée
    fontSize: 14,               // Taille minimale recommandée
    lineHeight: 1.5,            // Interlignage optimal pour la lisibilité
    // Paramètres vocaux
    voiceName: null,            // Nom de la voix système préférée
    voiceRate: 1,               // Vitesse de lecture (0.5 - 2)
    voicePitch: 1               // Tonalité (0 - 2)
  };

  // Options disponibles
  const backgroundOptions = [
    { name: 'Ivoire', value: '#fffef7' },
    { name: 'Bleu pâle', value: '#f0f7ff' },
    { name: 'Vert menthe', value: '#f0fdf4' },
    { name: 'Pêche', value: '#fefbf3' },
    { name: 'Gris très pâle', value: '#fafafa' }
  ];

  const textOptions = [
    { name: 'Bleu marine', value: '#1e3a8a' },
    { name: 'Gris foncé', value: '#374151' },
    { name: 'Brun foncé', value: '#92400e' }
  ];

  const fontOptions = [
    { name: 'Standard (Système)', value: 'system' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Verdana', value: 'Verdana' },
    { name: 'Tahoma', value: 'Tahoma' },
    { name: 'Calibri', value: 'Calibri' },
    { name: 'Helvetica', value: 'Helvetica' },
    { name: 'OpenDyslexic', value: 'OpenDyslexic' },
    { name: 'Lexend', value: 'Lexend' }
  ];

  // Thèmes prédéfinis
  const presetThemes = [
    { name: '🌙 Dark Pro', backgroundColor: '#2d3748', textColor: '#f7fafc' },
    { name: '🌌 Dark Blue', backgroundColor: '#1a365d', textColor: '#e2e8f0' },
    { name: '🍫 Dark Warm', backgroundColor: '#3c2415', textColor: '#faf5f0' },
    { name: '☀️ Clear Classic', backgroundColor: '#ffffff', textColor: '#2d3748' },
    { name: '🌸 Clear Soft', backgroundColor: '#f8f4f0', textColor: '#5a4037' },
    { name: '💎 Clear Blue', backgroundColor: '#f0f8ff', textColor: '#1e3a8a' }
  ];

  // État des paramètres
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('dysThemeSettings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sauvegarde automatique
  useEffect(() => {
    localStorage.setItem('dysThemeSettings', JSON.stringify(settings));
    applyThemeToDocument();
  }, [settings]);

  // Application du thème au document
  const applyThemeToDocument = () => {
    const root = document.documentElement;

    // Variables CSS personnalisées
    root.style.setProperty('--dys-bg-color', settings.backgroundColor);
    root.style.setProperty('--dys-text-color', settings.textColor);
    root.style.setProperty('--dys-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--dys-line-height', settings.lineHeight.toString());

    // Gestion des polices
    let fontStack = '';
    if (settings.fontFamily === 'system') {
      fontStack = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`;
    } else if (settings.fontFamily === 'OpenDyslexic' || settings.fontFamily === 'Lexend') {
      fontStack = `'${settings.fontFamily}', Arial, Verdana, sans-serif`;
    } else {
      fontStack = `'${settings.fontFamily}', Arial, sans-serif`;
    }
    root.style.setProperty('--dys-font-family', fontStack);
  };

  // Fonctions de mise à jour
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };

  const applyPresetTheme = (theme) => {
    setSettings(prev => ({
      ...prev,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor
    }));
  };

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  return {
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
  };
};
