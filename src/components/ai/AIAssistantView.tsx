import { useEffect, useRef, useState } from 'react';
import { Mic, Sparkles, Volume2 } from 'lucide-react';
import type { CopilotResponse, EvidenceCitation, Locality } from '../../types';
import { copilotLanguages, type CopilotLanguage } from '../../i18n/copilotLanguages';
import { useLanguage } from '../../context/LanguageContext';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import { authenticatedFetch, useAuth } from '../../context/AuthContext';
import { readJson } from '../../api';
import { PlaceSearch } from '../geography/PlaceSearch';

interface Props {
  selectedLocality: Locality;
  onSelectLocality: (id: string) => void;
  initialPrompt?: string;
  comparisonIds?: string[];
}
interface Message {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  citations?: EvidenceCitation[] | null;
  mode?: CopilotResponse['mode'];
  limitations?: string[];
  providerStatus?: CopilotResponse['providerStatus'];
}
interface SavedChat { id: string; title: string; placeIds: string[] | null }

const evidenceStatus = {
  answered: 'Gemini response',
  not_configured: 'Source results · Gemini is unavailable in this environment',
  sign_in_required: 'Source results · Sign in for a Gemini response',
  unavailable: 'Source results · Gemini could not complete this request',
};

export function AIAssistantView({ selectedLocality, onSelectLocality, initialPrompt = '', comparisonIds }: Props) {
  const { user } = useAuth();
  const { language: appLanguage } = useLanguage();
  const [language, setLanguage] = useState<CopilotLanguage>(appLanguage);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saved, setSaved] = useState<SavedChat[] | null>(null);
  const [saveConversation, setSaveConversation] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const voice = useVoiceAssistant({ language, onTranscriptComplete: (text) => setPrompt(text.slice(0, 2500)) });
  const ids = comparisonIds?.length ? comparisonIds : [selectedLocality.id];

  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  async function send() {
    const question = prompt.trim();
    if (!question || activeRequest.current) return;
    const abort = new AbortController();
    activeRequest.current = abort;
    setError('');
    setLoading(true);
    const id = crypto.randomUUID();
    const recentQuestions = messages.filter((message) => message.role === 'user').slice(-4).map((message) => message.content);
    setMessages((previous) => [...previous, { id, role: 'user', content: question }]);
    setPrompt('');
    try {
      const options: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: question, language, comparisonIds: ids, recentQuestions,
          saveConversation: !!user && saveConversation,
          conversationId: saveConversation ? conversationId : undefined,
        }),
        signal: abort.signal,
      };
      const response = await (user ? authenticatedFetch('/api/v1/ai/ask', options) : fetch('/api/v1/ai/ask', options))
        .then((result) => readJson<CopilotResponse>(result));
      if (abort.signal.aborted) return;
      setMessages((previous) => [...previous, {
        id: crypto.randomUUID(), role: 'assistant', content: response.answer, citations: response.citations,
        mode: response.mode, limitations: response.limitations, providerStatus: response.providerStatus,
      }]);
      if (response.conversationId) {
        setConversationId(response.conversationId);
        setSaved(null);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        setError(error instanceof Error ? error.message : 'Copilot could not answer.');
        setMessages((previous) => previous.filter((message) => message.id !== id));
        setPrompt(question);
      }
    } finally {
      if (activeRequest.current === abort) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  async function listSaved() {
    try {
      const data = await authenticatedFetch('/api/v1/ai/conversations').then((response) => readJson<{ conversations: SavedChat[] }>(response));
      setSaved(data.conversations);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load saved conversations.');
    }
  }

  async function openConversation(chat: SavedChat) {
    try {
      const data = await authenticatedFetch(`/api/v1/ai/conversations/${chat.id}`)
        .then((response) => readJson<{ messages: Message[] }>(response));
      setMessages(data.messages);
      setConversationId(chat.id);
      setSaveConversation(true);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open conversation.');
    }
  }

  const samePlaceSelection = (chat: SavedChat) => chat.placeIds?.join(',') === ids.join(',');
  const suggestions = language === 'hi'
    ? ['इस जगह के लिए कौन-से स्रोत उपलब्ध हैं?', 'आसपास कौन से रेलवे स्टेशन सूचीबद्ध हैं?']
    : language === 'hinglish'
      ? ['Is jagah ke liye kaun se sources available hain?', 'Paas ke railway stations kaun se hain?']
      : ['What evidence is available here?', 'Which railway stations are listed nearby?'];

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Sparkles className="h-6 w-6 text-emerald-600" /> AreaWise AI Copilot
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {ids.length > 1 ? `Selected comparison · ${ids.length} places` : selectedLocality.name}
        </p>
        <PlaceSearch onSelect={(place) => onSelectLocality(place.id)} />
      </header>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2 font-semibold">
          Answer language
          <select value={language} onChange={(event) => setLanguage(event.target.value as CopilotLanguage)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            {Object.entries(copilotLanguages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
        {user && (
          <>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={saveConversation} disabled={loading}
                onChange={(event) => { setSaveConversation(event.target.checked); if (!event.target.checked) setConversationId(undefined); }} />
              Save conversation to my account
            </label>
            <button className="underline" disabled={loading} onClick={() => void listSaved()}>Saved chats</button>
          </>
        )}
        {messages.length > 0 && <button disabled={loading} className="underline" onClick={() => {
          setMessages([]); setConversationId(undefined); setError('');
        }}>New chat</button>}
      </div>
      {saved && <section className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800" aria-label="Saved conversations">
        <div className="flex justify-between"><h2 className="font-semibold">Saved chats for this selection</h2><button className="underline" onClick={() => setSaved(null)}>Close</button></div>
        {!saved.some(samePlaceSelection) && <p>No saved chats for these places.</p>}
        {saved.filter(samePlaceSelection).map((chat) => <div className="flex items-baseline gap-3" key={chat.id}>
          <button disabled={loading} className="text-left underline" onClick={() => void openConversation(chat)}>{chat.title || 'Conversation'}</button>
          <button disabled={loading} className="text-xs underline" onClick={async () => {
            try {
              const result = await authenticatedFetch(`/api/v1/ai/conversations/${chat.id}`, { method: 'DELETE' });
              if (result.status !== 204) await readJson(result);
              if (conversationId === chat.id) { setConversationId(undefined); setMessages([]); }
              await listSaved();
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Could not delete chat.');
            }
          }}>Delete</button>
        </div>)}
      </section>}
      {!messages.length && <div className="flex flex-wrap gap-2">
        {suggestions.map((item) => <button className="rounded-full border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700" key={item} onClick={() => setPrompt(item)}>{item}</button>)}
      </div>}
      <div className="space-y-3" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500">
              {message.role === 'user' ? 'You' : message.providerStatus ? evidenceStatus[message.providerStatus] : message.mode === 'gemini' ? 'Gemini response' : 'Source results'}
            </p>
            {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
            {message.limitations?.length ? <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
              {message.limitations.map((item, index) => <li key={index}>{item}</li>)}
            </ul> : null}
            {message.citations?.length ? <details open={message.mode === 'evidence_only'} className="text-xs">
              <summary className="cursor-pointer font-semibold">Sources ({message.citations.length})</summary>
              <ul className="mt-2 space-y-2">
                {message.citations.map((citation) => <li key={citation.id} className="rounded bg-slate-50 p-2 dark:bg-slate-800/70">
                  <p><strong>{citation.id}</strong> · {citation.text}</p>
                  <p className="mt-1 text-slate-500">
                    <a href={citation.url} className="underline" target="_blank" rel="noreferrer">{citation.source}</a>
                    {' · '}<a href={citation.licenseUrl} className="underline" target="_blank" rel="noreferrer">Licence</a>
                    {citation.observationDate && ` · Observed ${citation.observationDate}`}
                    {citation.recordModifiedOn && ` · Publisher record edited ${citation.recordModifiedOn}`}
                  </p>
                </li>)}
              </ul>
            </details> : null}
            {message.role === 'assistant' && message.content && voice.supportsOutput && (
              <button className="inline-flex items-center gap-1 text-xs underline" onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(message.content)}>
                <Volume2 className="h-4 w-4" /> {voice.isSpeaking ? 'Stop audio' : 'Read aloud'}
              </button>
            )}
          </article>
        ))}
        {loading && <p role="status" className="text-sm text-slate-500">Retrieving locality evidence…</p>}
      </div>
      {(error || voice.errorMessage) && <p role="alert" className="text-sm text-rose-600">{error || voice.errorMessage}</p>}
      <form className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label className="block space-y-1 text-xs font-semibold">
          Question
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} required maxLength={2500}
            placeholder="Ask about the selected places" rows={3}
            className="block w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm font-normal dark:border-slate-700" />
        </label>
        <p className="text-xs text-slate-500">Avoid personal details. Live questions may be processed by Google Gemini.</p>
        <div className="flex gap-2">
          {voice.supportsInput && <button type="button" onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">
            <Mic className="h-4 w-4" /> {voice.isListening ? 'Stop recording' : 'Voice input'}
          </button>}
          <button disabled={loading || !prompt.trim()} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Ask Copilot</button>
        </div>
      </form>
    </div>
  );
}
