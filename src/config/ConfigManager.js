import yaml from 'js-yaml';

/**
 * Gestionnaire de configuration pour PromptoDYS Editor
 * Gère le chargement du fichier YAML externe et la persistance dans localStorage
 */

const CONFIG_STORAGE_KEY = 'promptodys_config';
const CONFIG_FILE_PATH = '/config.yaml';

// Configuration par défaut si aucun fichier n'est trouvé
const DEFAULT_CONFIG = {
  developer_mode: false
};

class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.listeners = [];
  }

  /**
   * Charge la configuration depuis localStorage ou le fichier YAML
   * @returns {Promise<Object>} Configuration chargée
   */
  async loadConfig() {
    console.log('[ConfigManager] 🔄 Chargement de la configuration...');

    // 1. Essayer de charger depuis localStorage en premier
    const storedConfig = this.loadFromLocalStorage();
    if (storedConfig) {
      console.log('[ConfigManager] ✅ Configuration chargée depuis localStorage:', storedConfig);
      this.config = storedConfig;
      return this.config;
    }

    // 2. Sinon, essayer de charger depuis le fichier YAML
    try {
      const yamlConfig = await this.loadFromYAML();
      if (yamlConfig) {
        console.log('[ConfigManager] ✅ Configuration chargée depuis YAML:', yamlConfig);
        this.config = yamlConfig;
        // Sauvegarder dans localStorage pour la prochaine fois
        this.saveToLocalStorage(this.config);
        return this.config;
      }
    } catch (error) {
      console.warn('[ConfigManager] ⚠️ Erreur lors du chargement du fichier YAML:', error);
    }

    // 3. Utiliser la configuration par défaut
    console.log('[ConfigManager] 📋 Utilisation de la configuration par défaut:', DEFAULT_CONFIG);
    this.config = { ...DEFAULT_CONFIG };
    this.saveToLocalStorage(this.config);
    return this.config;
  }

  /**
   * Charge la configuration depuis localStorage
   * @returns {Object|null} Configuration ou null si non trouvée
   */
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ConfigManager] ❌ Erreur lors de la lecture de localStorage:', error);
    }
    return null;
  }

  /**
   * Charge la configuration depuis le fichier YAML
   * @returns {Promise<Object|null>} Configuration ou null si non trouvée
   */
  async loadFromYAML() {
    try {
      const response = await fetch(CONFIG_FILE_PATH);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const yamlText = await response.text();
      const config = yaml.load(yamlText);
      return config;
    } catch (error) {
      console.warn('[ConfigManager] ⚠️ Impossible de charger config.yaml:', error.message);
      return null;
    }
  }

  /**
   * Sauvegarde la configuration dans localStorage
   * @param {Object} config - Configuration à sauvegarder
   */
  saveToLocalStorage(config) {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      console.log('[ConfigManager] 💾 Configuration sauvegardée dans localStorage');
    } catch (error) {
      console.error('[ConfigManager] ❌ Erreur lors de la sauvegarde dans localStorage:', error);
    }
  }

  /**
   * Met à jour une valeur de configuration
   * @param {string} key - Clé de configuration
   * @param {*} value - Nouvelle valeur
   */
  set(key, value) {
    console.log(`[ConfigManager] 🔧 Mise à jour: ${key} = ${value}`);
    this.config[key] = value;
    this.saveToLocalStorage(this.config);
    this.notifyListeners();
  }

  /**
   * Récupère une valeur de configuration
   * @param {string} key - Clé de configuration
   * @param {*} defaultValue - Valeur par défaut si non trouvée
   * @returns {*} Valeur de configuration
   */
  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Récupère toute la configuration
   * @returns {Object} Configuration complète
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Réinitialise la configuration aux valeurs par défaut
   */
  reset() {
    console.log('[ConfigManager] 🔄 Réinitialisation de la configuration...');
    this.config = { ...DEFAULT_CONFIG };
    this.saveToLocalStorage(this.config);
    this.notifyListeners();
  }

  /**
   * Ajoute un listener pour les changements de configuration
   * @param {Function} callback - Fonction à appeler lors des changements
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Retire un listener
   * @param {Function} callback - Fonction à retirer
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notifie tous les listeners des changements
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.config);
      } catch (error) {
        console.error('[ConfigManager] ❌ Erreur dans un listener:', error);
      }
    });
  }
}

// Instance singleton
const configManager = new ConfigManager();

export default configManager;
