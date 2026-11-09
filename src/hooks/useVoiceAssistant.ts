import { useState, useEffect, useRef, useCallback } from 'react';
import { SupportedLanguage } from '../types';

interface UseVoiceAssistantOptions {
  language: SupportedLanguage;
  onTranscriptComplete?: (transcript: string) => void;
}

export function useVoiceAssistant({ language, onTranscriptComplete }: UseVoiceAssistantOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check speech support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      const hasSynthesis = 'speechSynthesis' in window;
      setIsSupported(Boolean(hasRecognition && hasSynthesis));
    }
  }, []);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;

    // Set recognition language
    if (language === 'hi' || language === 'hinglish') {
      recognition.lang = 'hi-IN';
    } else {
      recognition.lang = 'en-IN';
    }

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMessage(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        setErrorMessage('No speech detected. Please speak clearly.');
      } else {
        setErrorMessage(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcript.trim() && onTranscriptComplete) {
        onTranscriptComplete(transcript.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [language, transcript, onTranscriptComplete]);

  const startListening = useCallback(() => {
    setErrorMessage(null);
    setTranscript('');
    stopSpeaking();

    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not available.');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      console.warn('Failed to start speech recognition:', err);
      // If already started, try aborting then starting
      try {
        recognitionRef.current.abort();
        setTimeout(() => recognitionRef.current?.start(), 100);
      } catch {}
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string, overrideLang?: SupportedLanguage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Cancel ongoing speech
    window.speechSynthesis.cancel();

    // Clean text of markdown stars, hashes, and links for smooth voice reading
    const cleanText = text
      .replace(/[#*_`>~-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const activeLang = overrideLang || language;

    if (activeLang === 'hi' || activeLang === 'hinglish') {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    // Voice selection
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferredVoice = voices.find(
        (v) =>
          (activeLang === 'hi' || activeLang === 'hinglish')
            ? (v.lang.includes('hi') || v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('india'))
            : (v.lang.includes('en-IN') || v.name.toLowerCase().includes('india'))
      );
      if (preferredVoice) utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    errorMessage,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
