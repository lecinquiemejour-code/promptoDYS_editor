import React from 'react';
import './SettingsModal.css';

/**
 * Modal de paramètres pour la configuration de l'éditeur
 */
function SettingsModal({ isOpen, onClose, config, onConfigChange }) {
    if (!isOpen) return null;

    /**
     * Gère le changement de toggle pour le mode développeur
     */
    const handleDeveloperModeToggle = () => {
        const newValue = !config.developer_mode;
        console.log('[SettingsModal] 🔄 Toggle mode développeur:', newValue);
        onConfigChange('developer_mode', newValue);
    };

    /**
     * Ferme le modal et sauvegarde
     */
    const handleSave = () => {
        console.log('[SettingsModal] 💾 Configuration sauvegardée');
        onClose();
    };

    /**
     * Gère la fermeture en cliquant sur le backdrop
     */
    const handleBackdropClick = (e) => {
        if (e.target.classList.contains('settings-modal-backdrop')) {
            onClose();
        }
    };

    return (
        <div className="settings-modal-backdrop" onClick={handleBackdropClick}>
            <div className="settings-modal">
                {/* Header */}
                <div className="settings-modal-header">
                    <h2>⚙️ Configuration</h2>
                    <button className="settings-close-btn" onClick={onClose} aria-label="Fermer">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="settings-modal-body">
                    {/* Mode Développeur */}
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <label htmlFor="developer-mode-toggle" className="settings-label">
                                🐛 Mode Développeur
                            </label>
                            <p className="settings-description">
                                Active les fonctionnalités de débogage et logs détaillés dans la console
                            </p>
                        </div>
                        <div className="settings-item-control">
                            <label className="toggle-switch">
                                <input
                                    id="developer-mode-toggle"
                                    type="checkbox"
                                    checked={config.developer_mode || false}
                                    onChange={handleDeveloperModeToggle}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="settings-modal-footer">
                    <button className="settings-save-btn" onClick={handleSave}>
                        💾 Sauvegarder
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
