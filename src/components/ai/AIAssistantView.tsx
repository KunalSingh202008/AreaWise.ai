import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  BookOpen,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Square,
  AlertCircle,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { AIMessage, Locality } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import { VoiceVisualizer } from '../voice/VoiceVisualizer';

interface AIAssistantViewProps {
  localities: Locality[];
  selectedLocality: Locality;
  onSelectLocality: (id: string) => void;
  initialPrompt?: string;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  localities,
  selectedLocality,
  onSelectLocality,
  initialPrompt = '',
}) => {
  const { language, t } = useLanguage();

  const getWelcomeContent = () => {
    if (language === 'hi') {
      return `नमस्ते! मैं **एरियावाइज एआई (AreaWise AI)** हूँ — वाराणसी के इलाकों का निष्पक्ष भू-स्थानिक विश्लेषक।

वर्तमान में आपका चयनित इलाका: **${selectedLocality.hindiName || selectedLocality.name} (${selectedLocality.city}, पिन ${selectedLocality.pincode})** है।

मैं वास्तविक सरकारी सेंसरों (CPCB वायु गुणवत्ता, ISRO भुवन सैटेलाइट ग्रीन कवर, और यूपी जल निगम SCADA) के आधार पर उत्तर देता हूँ।

आप माइक बटन दबाकर बोल सकते हैं या नीचे लिखकर पूछ सकते हैं!`;
    }
    if (language === 'hinglish') {
      return `Namaste! Main **AreaWise AI** hoon — Varanasi ke areas ka independent research assistant.

Aapka active locality hai: **${selectedLocality.name} (PIN ${selectedLocality.pincode})**.

Main verified CPCB air monitors, ISRO green canopy, aur municipal records ke proof ke sath answer deta hoon. Koi fake broker claim nahi.

Aap mic button daba kar bol sakte hain ya neeche type kar sakte hain!`;
    }
    return `Hello! I am **AreaWise AI**, an independent neighborhood intelligence assistant for Indian cities.

Active Target Locality: **${selectedLocality.name}, ${selectedLocality.city} (PIN ${selectedLocality.pincode})**.

I provide strictly evidence-grounded analysis retrieved from statutory air sensors (CPCB CAAQMS), satellite canopy telemetry (ISRO Bhuvan), and municipal water audits.

Click the microphone to speak or type your question below!`;
  };

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: getWelcomeContent(),
      spokenScript:
        language === 'hi'
          ? `नमस्ते! आप ${selectedLocality.hindiName || selectedLocality.name} के बारे में क्या जानना चाहते हैं?`
          : language === 'hinglish'
          ? `Namaste! Aapne ${selectedLocality.name} select kiya hai. Is area ke baare mein kya poochna chahte hain?`
          : `Hello! Ask any question about ${selectedLocality.name}, Varanasi.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [autoVoiceResponse, setAutoVoiceResponse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hook up voice assistant
  const {
    isListening,
    isSpeaking,
    transcript,
    errorMessage: voiceError,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoiceAssistant({
    language,
    onTranscriptComplete: (text) => {
      if (text) {
        handleSendMessage(text);
      }
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isListening]);

  // Suggested Questions per Language
  const getSuggestedQuestions = () => {
    if (language === 'hi') {
      return [
        `${selectedLocality.hindiName || selectedLocality.name} में पारिवारिक जीवन और स्कूल कैसे हैं?`,
        `यहाँ 2 किमी के दायरे में कौन से अस्पताल और इमरजेंसी सुविधाएं हैं?`,
        `वायु गुणवत्ता (AQI) और पेयजल आपूर्ति की क्या स्थिति है?`,
        `${selectedLocality.name} की महमूरगंज से तुलना करें।`,
      ];
    }
    if (language === 'hinglish') {
      return [
        `${selectedLocality.name} mein family ke rehne ke liye mahaul kaisa hai?`,
        `Nearby 2km radius mein best hospitals kaun se hain?`,
        `Yahan waterlogging ya traffic ka koi major issue hai?`,
        `${selectedLocality.name} aur Lanka ko compare karo.`,
      ];
    }
    return [
      `Is ${selectedLocality.name} suitable for a family with school children?`,
      `What hospitals and emergency facilities are within 2.0 km?`,
      `What are the verified air quality and civic water supply metrics?`,
      `Compare ${selectedLocality.name} with Mahmoorganj.`,
    ];
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMessage: AIMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          localityId: selectedLocality.id,
          language,
        }),
      });

      const data = await response.json();

      const assistantMessage: AIMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'No response returned from evidence engine.',
        spokenScript: data.spokenScript,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: data.citations || [],
        warningNote: data.warningNote,
        keyFindings: data.keyFindings || [],
        dataFreshness: data.dataFreshness,
        limitations: data.limitations || [],
        suggestedNextSteps: data.suggestedNextSteps || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Automatically speak response if voice mode enabled
      if (autoVoiceResponse && data.spokenScript) {
        speak(data.spokenScript, language);
      }
    } catch (err: any) {
      console.error('Error querying AI assistant:', err);
      const errorMessage: AIMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to communicate with the evidence retrieval engine. Please retry in a moment.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-8rem)]">
      {/* Header with Active Locality Selector & Voice Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              AreaWise AI Assistant
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono">
              RAG Evidence Grounded
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Target Locality:</span>
            <select
              value={selectedLocality.id}
              onChange={(e) => onSelectLocality(e.target.value)}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              {localities.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.hindiName ? `(${loc.hindiName})` : ''} - PIN {loc.pincode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audio Mute / Stop Controls */}
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 animate-pulse"
            >
              <Square className="w-3 h-3 fill-current" />
              {t.voice.stopSpeech}
            </button>
          )}

          <button
            onClick={() => setAutoVoiceResponse(!autoVoiceResponse)}
            title={autoVoiceResponse ? 'Voice Readout Enabled' : 'Voice Readout Muted'}
            className={`p-2 rounded-lg border transition-colors ${
              autoVoiceResponse
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {autoVoiceResponse ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Voice Visualizer Banner */}
      {(isListening || isSpeaking) && (
        <div className="my-2 p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-lg text-xs">
          <div className="flex items-center gap-2">
            <VoiceVisualizer isListening={isListening} isSpeaking={isSpeaking} />
            <span className="font-semibold">
              {isListening ? t.voice.micListening : t.voice.speaking}
            </span>
          </div>
          {isListening && (
            <button
              onClick={stopListening}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
            >
              {t.voice.micStop}
            </button>
          )}
        </div>
      )}

      {/* Voice Error Notification */}
      {voiceError && (
        <div className="my-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-3xl rounded-2xl p-5 text-xs sm:text-sm leading-relaxed space-y-3 ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs'
              }`}
            >
              <div className="whitespace-pre-line prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm">
                {msg.content}
              </div>

              {/* Citations Box for Assistant */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-2">
                  <div className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {t.dashboard.statutorySources}:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.citations.map((cite, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-0.5"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {cite.source}
                        </div>
                        <div className="text-slate-500 flex items-center justify-between text-[10px]">
                          <span>{cite.locality} · {cite.metric}</span>
                          <span className="font-mono text-slate-400">{cite.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spoken Audio Replay Control */}
              {msg.spokenScript && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                  <span className="italic truncate max-w-[280px]">"{msg.spokenScript}"</span>
                  <button
                    onClick={() => speak(msg.spokenScript!, language)}
                    className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    {t.voice.replay}
                  </button>
                </div>
              )}

              {msg.warningNote && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {msg.warningNote}
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-400 mt-1 px-2 font-mono">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 max-w-md shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Retrieving verified CPCB air logs, ISRO canopy data, and facilities for {selectedLocality.name}...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Strip */}
      <div className="py-2 overflow-x-auto flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">Suggested:</span>
        {getSuggestedQuestions().map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition-colors border border-slate-200 dark:border-slate-700"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form with Microphone Button */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="mt-3 relative shrink-0 flex items-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-1.5"
      >
        {/* Microphone Voice Button */}
        {voiceSupported ? (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            title={isListening ? t.voice.micStop : t.voice.micStart}
            className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        ) : null}

        <input
          type="text"
          value={inputPrompt || (isListening ? transcript : '')}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder={
            isListening
              ? t.voice.micListening
              : language === 'hi'
              ? `${selectedLocality.name} के बारे में कुछ भी पूछें...`
              : language === 'hinglish'
              ? `${selectedLocality.name} ke baare mein kuch bhi poochhein...`
              : `Ask about schools, hospitals, transit, air quality in ${selectedLocality.name}...`
          }
          disabled={isLoading}
          className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
        />

        <button
          type="submit"
          disabled={(!inputPrompt.trim() && !transcript) || isLoading}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
