import React from 'react';
import useTextToSpeech from '../hooks/useTextToSpeech';

const ThemeSettings = ({
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
}) => {
  // Récupérer les voix disponibles via le hook TTS
  const { voices } = useTextToSpeech();

  if (!isSettingsOpen) return null;

  const styles = {
    floatingPanel: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '400px',
      minWidth: '350px',
      maxWidth: '600px',
      minHeight: '100px',
      maxHeight: '80vh',
      resize: 'both',
      overflow: 'auto',
      zIndex: 1000,
      cursor: 'default'
    },
    modal: {
      backgroundColor: 'white',
      padding: '6px',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      border: '2px solid #e5e7eb',
      fontSize: '14px',
      lineHeight: '1.5'
    },
    dragHandle: {
      backgroundColor: '#f3f4f6',
      padding: '3px',
      borderRadius: '8px 8px 0 0',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '14px',
      fontWeight: '600',
      color: '#374151'
    },
    panel: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '6px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '6px',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '2px'
    },
    title: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#1f2937',
      margin: 0
    },
    closeButton: {
      backgroundColor: '#f3f4f6',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      cursor: 'pointer',
      padding: '3px 6px',
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      transition: 'all 0.2s ease',
      position: 'relative',
      fontSize: '12px',
      fontWeight: '500',
      color: '#374151'
    },
    section: {
      marginBottom: '4px'
    },
    sectionTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '2px'
    },
    optionGroup: {
      display: 'flex',
      gap: '3px',
      flexWrap: 'wrap'
    },
    colorButton: {
      width: '25px',
      height: '25px',
      borderRadius: '5px',
      border: '2px solid transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '9px',
      fontWeight: '500'
    },
    activeColorButton: {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)'
    },
    select: {
      width: '100%',
      padding: '3px 6px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: 'white'
    },
    sliderContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    slider: {
      flex: 1,
      height: '3px',
      borderRadius: '1.5px',
      background: '#e5e7eb',
      outline: 'none',
      cursor: 'pointer'
    },
    sliderValue: {
      fontSize: '11px',
      fontWeight: '500',
      color: '#374151',
      minWidth: '25px',
      textAlign: 'center'
    },
    presetButton: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: '2px solid transparent',
      cursor: 'pointer',
      fontSize: '9px',
      fontWeight: '600',
      textAlign: 'center',
      minWidth: '70px',
      transition: 'all 0.2s ease'
    },
    activePresetButton: {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)'
    },
    presetGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '3px'
    }
  };

  return (
    <div style={styles.floatingPanel}>
      <div style={styles.modal}>
        <div style={styles.dragHandle}>
          <span>⚙️ Paramètres du thème</span>
          <button
            onClick={toggleSettings}
            style={styles.closeButton}
            title="Fermer les paramètres du thème"
          >
            ❌ Fermer
          </button>
        </div>

        {/* Section Thèmes prédéfinis */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Thèmes prédéfinis</div>
          <div style={styles.presetGrid}>
            {presetThemes.map(theme => {
              const isActive = settings.backgroundColor === theme.backgroundColor &&
                settings.textColor === theme.textColor;
              return (
                <button
                  key={theme.name}
                  style={{
                    ...styles.presetButton,
                    backgroundColor: theme.backgroundColor,
                    color: theme.textColor,
                    border: `2px solid ${theme.textColor}`,
                    ...(isActive ? styles.activePresetButton : {})
                  }}
                  onClick={() => applyPresetTheme(theme)}
                  title={`Appliquer le thème ${theme.name}`}
                >
                  {theme.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Couleur de fond */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Couleur d'arrière-plan</div>
          <div style={styles.optionGroup}>
            {backgroundOptions.map(option => (
              <button
                key={option.value}
                style={{
                  ...styles.colorButton,
                  backgroundColor: option.value,
                  color: option.value === '#fafafa' ? '#374151' : '#1f2937',
                  ...(settings.backgroundColor === option.value ? styles.activeColorButton : {})
                }}
                onClick={() => updateSetting('backgroundColor', option.value)}
                title={option.name}
              >
                {option.name.charAt(0)}
              </button>
            ))}
          </div>
        </div>

        {/* Section Couleur de texte */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Couleur du texte</div>
          <div style={styles.optionGroup}>
            {textOptions.map(option => (
              <button
                key={option.value}
                style={{
                  ...styles.colorButton,
                  backgroundColor: option.value,
                  color: 'white',
                  ...(settings.textColor === option.value ? styles.activeColorButton : {})
                }}
                onClick={() => updateSetting('textColor', option.value)}
                title={option.name}
              >
                Aa
              </button>
            ))}
          </div>
        </div>

        {/* Section Police */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Police de caractères</div>
          <select
            style={styles.select}
            value={settings.fontFamily}
            onChange={e => updateSetting('fontFamily', e.target.value)}
          >
            {fontOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section Taille de police */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Taille de police</div>
          <div style={styles.sliderContainer}>
            <input
              type="range"
              min="12"
              max="24"
              step="1"
              value={settings.fontSize}
              onChange={e => updateSetting('fontSize', parseInt(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderValue}>{settings.fontSize}px</div>
          </div>
        </div>

        {/* Section Interlignage */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Espacement des lignes</div>
          <div style={styles.sliderContainer}>
            <input
              type="range"
              min="1.2"
              max="2.0"
              step="0.1"
              value={settings.lineHeight}
              onChange={e => updateSetting('lineHeight', parseFloat(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderValue}>{settings.lineHeight.toFixed(1)}</div>
          </div>
        </div>

        {/* Section Espacement entre mots */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Espacement entre les mots</div>
          <div style={styles.sliderContainer}>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={settings.wordSpacing}
              onChange={e => updateSetting('wordSpacing', parseFloat(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderValue}>{settings.wordSpacing}px</div>
          </div>
        </div>

        {/* Section Paramètres de Lecture Vocale */}
        <div style={styles.section}>
          <div style={{ ...styles.sectionTitle, marginTop: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
            🗣️ Lecture Vocale
          </div>

          {/* Sélection de la voix */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Voix</div>
            <select
              style={styles.select}
              value={settings.voiceName || ''}
              onChange={e => updateSetting('voiceName', e.target.value)}
            >
              <option value="">Par défaut (Automatique)</option>
              {voices
                .filter(v => v.lang.startsWith('fr') || v.lang.startsWith('en')) // Filtrer pour FR et EN principalement
                .map(voice => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
            </select>
          </div>

          {/* Vitesse de lecture */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
              <span>Vitesse</span>
              <span>x{settings.voiceRate}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={settings.voiceRate}
              onChange={e => updateSetting('voiceRate', parseFloat(e.target.value))}
              style={{ ...styles.slider, width: '100%' }}
            />
          </div>

          {/* Tonalité */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
              <span>Tonalité</span>
              <span>{settings.voicePitch}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={settings.voicePitch}
              onChange={e => updateSetting('voicePitch', parseFloat(e.target.value))}
              style={{ ...styles.slider, width: '100%' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default ThemeSettings;
