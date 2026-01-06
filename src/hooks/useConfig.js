import { useState, useEffect } from 'react';
import configManager from '../config/ConfigManager';

/**
 * Hook React pour accéder et modifier la configuration
 * @returns {Object} { config, setConfigValue, resetConfig, isLoading }
 */
export function useConfig() {
    const [config, setConfig] = useState(configManager.getAll());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Charger la configuration au montage du composant
        const loadConfig = async () => {
            console.log('[useConfig] 🔄 Initialisation de la configuration...');
            await configManager.loadConfig();
            setConfig(configManager.getAll());
            setIsLoading(false);
            console.log('[useConfig] ✅ Configuration initialisée');
        };

        loadConfig();

        // Écouter les changements de configuration
        const handleConfigChange = (newConfig) => {
            console.log('[useConfig] 🔔 Configuration mise à jour:', newConfig);
            setConfig({ ...newConfig });
        };

        configManager.addListener(handleConfigChange);

        // Nettoyage à la destruction du composant
        return () => {
            configManager.removeListener(handleConfigChange);
        };
    }, []);

    /**
     * Met à jour une valeur de configuration
     * @param {string} key - Clé de configuration
     * @param {*} value - Nouvelle valeur
     */
    const setConfigValue = (key, value) => {
        console.log(`[useConfig] 🔧 Mise à jour de ${key} = ${value}`);
        configManager.set(key, value);
    };

    /**
     * Réinitialise la configuration aux valeurs par défaut
     */
    const resetConfig = () => {
        console.log('[useConfig] 🔄 Réinitialisation de la configuration');
        configManager.reset();
    };

    return {
        config,
        setConfigValue,
        resetConfig,
        isLoading
    };
}
