import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer la synthèse vocale (Text-to-Speech)
 * Supporte la lecture, pause, reprise, arrêt et la gestion des voix/vitesse.
 * Fonctionne 100% hors ligne via l'API native window.speechSynthesis.
 */
const useTextToSpeech = (options = {}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [voices, setVoices] = useState([]);

    // Utiliser une ref pour les options afin d'avoir toujours les dernières valeurs dans speak
    // sans avoir à l'ajouter aux dépendances (ce qui recréerait la fonction)
    const optionsRef = useRef(options);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const {
        pitch = 1,
        rate = 1,
        volume = 1,
        voiceName = null
    } = optionsRef.current;

    const utteranceRef = useRef(null);
    const synth = useRef(window.speechSynthesis);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            setIsSupported(true);

            // Charger les voix (asynchrone sur certains navigateurs)
            const loadVoices = () => {
                const availableVoices = window.speechSynthesis.getVoices();
                setVoices(availableVoices);
            };

            loadVoices();

            // Chrome charge les voix de manière asynchrone
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }, []);

    const handleEnd = useCallback(() => {
        setIsSpeaking(false);
        setIsPaused(false);
    }, []);

    const cancel = useCallback(() => {
        if (!isSupported) return;
        synth.current.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
    }, [isSupported]);

    const pause = useCallback(() => {
        if (!isSupported) return;
        synth.current.pause();
        setIsPaused(true);
    }, [isSupported]);

    const resume = useCallback(() => {
        if (!isSupported) return;
        synth.current.resume();
        setIsPaused(false);
    }, [isSupported]);

    const speak = useCallback((text) => {
        if (!isSupported || !text) return;

        // Arrêter toute lecture en cours
        cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // Récupérer les options fraîches depuis la ref
        const currentOptions = optionsRef.current;
        const { pitch = 1, rate = 1, volume = 1, voiceName = null } = currentOptions;

        // Configuration des paramètres
        utterance.pitch = pitch;
        utterance.rate = rate;
        utterance.volume = volume;

        // Sélection de la voix
        if (voiceName && voices.length > 0) {
            const selectedVoice = voices.find(v => v.name === voiceName);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        } else {
            // Fallback intelligent : chercher une voix française par défaut
            const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
            if (frenchVoice) {
                utterance.voice = frenchVoice;
            }
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
        };

        utterance.onend = handleEnd;
        utterance.onerror = (event) => {
            console.error('Erreur TTS:', event);
            handleEnd();
        };

        synth.current.speak(utterance);
    }, [isSupported, cancel, voices, handleEnd]); // Retiré pitch, rate, volume, voiceName des dépendances

    // Nettoyage au démontage
    useEffect(() => {
        return () => {
            if (isSpeaking) {
                cancel();
            }
        };
    }, [cancel, isSpeaking]);

    return {
        isSupported,
        isSpeaking,
        isPaused,
        speak,
        pause,
        resume,
        cancel,
        voices // Exposé pour le futur menu de configuration
    };
};

export default useTextToSpeech;
