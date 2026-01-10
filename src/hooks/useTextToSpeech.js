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
    const [highlightInfo, setHighlightInfo] = useState(null); // { charIndex, length }

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
    const charIndexRef = useRef(0);
    const textRef = useRef('');

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            setIsSupported(true);

            // Charger les voix (asynchrone sur certains navigateurs)
            const loadVoices = () => {
                const availableVoices = window.speechSynthesis.getVoices();
                console.log('--- TOUTES LES VOIX DÉTECTÉES PAR LE NAVIGATEUR ---');
                availableVoices.forEach((v, i) => {
                    console.log(`[${i}] ${v.name} (${v.lang}) - Local: ${v.localService} - Default: ${v.default}`);
                });
                console.log('--------------------------------------------------');
                setVoices(availableVoices);
            };

            loadVoices();

            // Chrome charge les voix de manière asynchrone
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }, []);

    // Effet pour appliquer les changements en temps réel
    useEffect(() => {
        if (isSpeaking && !isPaused && textRef.current) {
            // Si on parle, on relance la lecture avec les nouveaux paramètres
            // en partant de la position actuelle
            const currentPosition = charIndexRef.current;

            // Petit délai pour laisser le temps à l'annulation de se faire proprement
            synth.current.cancel();

            // Relancer avec un léger délai pour éviter les conflits
            setTimeout(() => {
                speak(textRef.current, currentPosition);
            }, 50);
        }
    }, [options.voiceName, options.rate, options.pitch]); // Dépendances explicites pour le redémarrage

    const handleEnd = useCallback(() => {
        setIsSpeaking(false);
        setIsPaused(false);
        // Petit délai pour laisser le dernier mot surligné visible
        setTimeout(() => {
            setHighlightInfo(null);
        }, 500);
        charIndexRef.current = 0; // Réinitialiser à la fin
    }, []);

    const cancel = useCallback(() => {
        if (!isSupported) return;
        synth.current.cancel();
        setIsSpeaking(true); // Temporairement pour forcer l'annulation propre si on redémarre
        setIsSpeaking(false);
        setIsPaused(false);
        setHighlightInfo(null);
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

    const speak = useCallback((text, startOffset = 0) => {
        if (!isSupported || !text) return;

        // Sauvegarder le texte en cours
        textRef.current = text;

        // Arrêter toute lecture en cours
        cancel();

        // Récupérer les options fraîches depuis la ref
        const currentOptions = optionsRef.current;
        const { pitch = 1, rate = 1, volume = 1, voiceName = null } = currentOptions;

        // Gérer le texte partiel si on redémarre au milieu
        const textToRead = startOffset > 0 ? text.substring(startOffset) : text;

        const utterance = new SpeechSynthesisUtterance(textToRead);
        utteranceRef.current = utterance;

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
            const frenchVoice = voices.find(v => v.lang.toLowerCase().startsWith('fr'));
            if (frenchVoice) {
                utterance.voice = frenchVoice;
            }
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
        };

        utterance.onboundary = (event) => {
            // Mettre à jour la position globale
            // startOffset est le décalage initial si on a redémarré
            const globalIndex = startOffset + event.charIndex;
            charIndexRef.current = globalIndex;

            // Extraire le mot pour la vérification
            const remainingText = text.substring(globalIndex);
            // Regex "Glouton intelligent" : Prend tout mais s'arrête au dernier caractère alphanumérique
            // Ex: "07/11/2025---" -> "07/11/2025"
            // Ex: "l'énergie" -> "l'énergie"
            // Ex: "fin." -> "fin"
            const wordMatch = remainingText.match(/^[^\s]*[a-zA-Z0-9\u00C0-\u024F]/);
            const wordLength = wordMatch ? wordMatch[0].length : 1;
            const wordText = wordMatch ? wordMatch[0] : '';

            setHighlightInfo({
                charIndex: globalIndex,
                length: wordLength,
                word: wordText // Nouveau champ pour resync
            });
        };

        utterance.onend = handleEnd;
        utterance.onerror = (event) => {
            console.error('Erreur TTS:', event);
            handleEnd();
        };

        synth.current.speak(utterance);
    }, [isSupported, cancel, voices, handleEnd]);

    // Nettoyage au démontage
    useEffect(() => {
        return () => {
            if (isSpeaking) {
                cancel();
            }
        };
    }, [cancel, isSpeaking]);

    const refreshVoices = useCallback(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const availableVoices = window.speechSynthesis.getVoices();
            console.log('--- RECHARGE MANUELLE DES VOIX ---');
            availableVoices.forEach((v, i) => {
                console.log(`[${i}] ${v.name} (${v.lang}) - Local: ${v.localService}`);
            });
            setVoices(availableVoices);
        }
    }, []);

    return {
        isSupported,
        isSpeaking,
        isPaused,
        speak,
        pause,
        resume,
        cancel,
        refreshVoices, // Nouvelle fonction exposée
        voices,
        highlightInfo
    };
};

export default useTextToSpeech;
