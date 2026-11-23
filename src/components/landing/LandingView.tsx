import { useState } from 'react';
import { ArrowRight, MapPin, Navigation, Sparkles } from 'lucide-react';
import type { PlaceSummary } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { PlaceSearch } from '../geography/PlaceSearch';

interface Props {
  places: PlaceSummary[];
  onSelectLocality: (id: string) => void;
  onOpenCompare: () => void;
  onOpenAssistant: () => void;
  onResolveCoordinates: (lat: number, lng: number) => Promise<void>;
}

export function LandingView({ places, onSelectLocality, onOpenCompare, onOpenAssistant, onResolveCoordinates }: Props) {
  const { language, t } = useLanguage();
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [coordinateError, setCoordinateError] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  return (
    <div className="space-y-12 pb-16">
      <section className="relative isolate mx-4 mt-6 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl sm:mx-6 lg:mx-8">
        <img
          src="/assets/images/hero_varanasi_urban_1794054119447.jpg"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20" />
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">{t.tagline}</h1>
          <p className="mt-5 max-w-xl text-base text-slate-200 sm:text-lg">
            {language === 'hi'
              ? 'भारत में जगहें खोजें, आसपास की सुविधाएँ देखें और उपलब्ध जानकारी के स्रोत जाँचें।'
              : 'Find places across India, explore nearby facilities, and check the evidence behind each locality profile.'}
          </p>
          <div className="mt-8">
            <PlaceSearch onSelect={(place) => onSelectLocality(place.id)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => setShowCoordinates(!showCoordinates)}
              aria-expanded={showCoordinates}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Navigation aria-hidden className="h-4 w-4" /> Look up coordinates
            </button>
            <button onClick={onOpenCompare} className="rounded-xl border border-white/25 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              {t.comparison.title}
            </button>
            <button onClick={onOpenAssistant} className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              <Sparkles aria-hidden className="h-4 w-4" /> AreaWise Copilot
            </button>
          </div>
          {showCoordinates && (
            <form
              className="mt-4 flex max-w-2xl flex-wrap items-end gap-3 rounded-xl border border-white/20 bg-slate-900 p-3 text-sm"
              onSubmit={async (event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                setCoordinateError('');
                setIsResolving(true);
                try {
                  await onResolveCoordinates(Number(values.get('latitude')), Number(values.get('longitude')));
                } catch (error) {
                  setCoordinateError(error instanceof Error ? error.message : 'Could not look up this point.');
                } finally {
                  setIsResolving(false);
                }
              }}
            >
              <label className="flex min-w-28 flex-1 flex-col gap-1 text-xs">
                Latitude
                <input name="latitude" required min={-90} max={90} step="any" type="number" className="rounded-md border border-slate-600 bg-slate-950 p-2 text-sm" />
              </label>
              <label className="flex min-w-28 flex-1 flex-col gap-1 text-xs">
                Longitude
                <input name="longitude" required min={-180} max={180} step="any" type="number" className="rounded-md border border-slate-600 bg-slate-950 p-2 text-sm" />
              </label>
              <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold" disabled={isResolving}>
                {isResolving ? 'Looking up…' : 'Open map point'}
              </button>
              {coordinateError && <p role="alert" className="w-full text-xs text-rose-200">{coordinateError}</p>}
            </form>
          )}
        </div>
      </section>

      {places.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold">Explore Indian cities</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Coverage varies by place. Each profile shows which evidence is available.</p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
                  onClick={() => onSelectLocality(place.id)}
                >
                  <MapPin aria-hidden className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{place.name}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{place.region}</span>
                  </span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
