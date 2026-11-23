import { useEffect, useRef, useState } from 'react';
import type { CopilotLanguage } from '../i18n/copilotLanguages';

interface SpeechResultEvent {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
const browser = window as typeof window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;

export function useVoiceAssistant({ language, onTranscriptComplete }: {
  language: CopilotLanguage;
  onTranscriptComplete: (transcript: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const onTranscript = useRef(onTranscriptComplete);
  const speechLanguage = language === 'auto' || language === 'en' ? 'en-IN'
    : language === 'hinglish' ? 'hi-IN' : `${language}-IN`;

  useEffect(() => { onTranscript.current = onTranscriptComplete; }, [onTranscriptComplete]);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const instance = new SpeechRecognition();
    instance.lang = speechLanguage;
    instance.continuous = false;
    instance.interimResults = false;
    instance.onstart = () => { setError(''); setListening(true); };
    instance.onend = () => setListening(false);
    instance.onresult = (event) => {
      const text = Array.from(event.results).filter((result) => result.isFinal)
        .map((result) => result[0].transcript).join(' ').trim();
      if (text) onTranscript.current(text);
    };
    instance.onerror = ({ error }) => {
      if (error !== 'aborted') setError(error === 'not-allowed'
        ? 'Microphone permission is needed for voice input.'
        : 'Voice input is unavailable for this session. You can type your question.');
      setListening(false);
    };
    recognition.current = instance;
    return () => {
      instance.onstart = instance.onend = instance.onresult = instance.onerror = null;
      instance.abort();
      recognition.current = null;
      setListening(false);
    };
  }, [speechLanguage]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  return {
    isListening: listening, isSpeaking: speaking, errorMessage: error,
    supportsInput: !!SpeechRecognition, supportsOutput: 'speechSynthesis' in window,
    startListening() {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      try { recognition.current?.start(); } catch {
        setError('Voice input could not start. You can type your question.');
      }
    },
    stopListening() { recognition.current?.stop(); },
    speak(text: string) {
      const synthesis = window.speechSynthesis;
      if (!synthesis) return;
      synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/\[E\d+(?:, E\d+)*\]/g, ''));
      utterance.lang = speechLanguage;
      const voice = synthesis.getVoices().find((item) =>
        item.lang.toLowerCase().startsWith(speechLanguage.split('-')[0].toLowerCase()));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      synthesis.speak(utterance);
    },
    stopSpeaking() {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    },
  };
}
