import { useEffect, useId, useState } from 'react';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import type { PlaceSummary } from '../../types';
import { getJson } from '../../api';

interface Props {
  onSelect: (place: PlaceSummary) => void;
  label?: string;
  showRecordDetails?: boolean;
}

export function PlaceSearch({ onSelect, label = 'Place name or six-digit PIN', showRecordDetails = false }: Props) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PlaceSummary[]>([]);
  const [status, setStatus] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (!isOpen || term.length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<{ results: PlaceSummary[] }>(
          '/api/v1/locations/search?' + new URLSearchParams({ q: term }),
          abort.signal,
        );
        if (abort.signal.aborted) return;
        setMatches(data.results);
        setStatus(data.results.length ? '' : 'No places found in the current catalogue.');
      } catch (error) {
        if (abort.signal.aborted) return;
        setMatches([]);
        setStatus(error instanceof Error ? error.message : 'Could not search places.');
      }
    }, 180);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [term, isOpen]);

  function select(place: PlaceSummary) {
    setIsOpen(false);
    setQuery(place.name);
    onSelect(place);
  }

  return (
    <div className="relative w-full max-w-2xl text-left text-slate-900 dark:text-slate-100">
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <form
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        onSubmit={(event) => {
          event.preventDefault();
          if (isOpen && matches[0]) select(matches[0]);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setIsOpen(false);
        }}
      >
        <Search aria-hidden className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
        <input
          id={inputId}
          type="search"
          maxLength={150}
          autoComplete="off"
          placeholder={label}
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none"
          value={query}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => { if (event.key === 'Escape') setIsOpen(false); }}
          onChange={(event) => {
            setQuery(event.target.value);
            setMatches([]);
            setStatus('Searching places…');
            setIsOpen(true);
          }}
        />
        <button
          type="submit"
          disabled={!isOpen || !matches.length}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          Open <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </form>
      {isOpen && term.length >= 2 && (
        <ul
          aria-label="Place search results"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {matches.map((place) => (
            <li key={place.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => select(place)}
                onBlur={(event) => {
                  if (!event.currentTarget.closest('ul')?.parentElement?.contains(event.relatedTarget)) setIsOpen(false);
                }}
              >
                <MapPin aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="block text-sm font-semibold">{place.name}</span>
                  <span className="block text-xs text-slate-500">
                    {[place.district, place.region, place.pincode && `PIN ${place.pincode}`].filter(Boolean).join(' · ')}
                    {place.kind === 'administrative' ? ' · Administrative area' : ''}
                  </span>
                  {showRecordDetails && <span className="block text-xs text-slate-500">
                    {place.source.publisher} · {place.id} · {place.center.lat}, {place.center.lng}
                  </span>}
                </span>
              </button>
            </li>
          ))}
          {status && <li role="status" className="px-4 py-3 text-sm text-slate-500">{status}</li>}
        </ul>
      )}
    </div>
  );
}
