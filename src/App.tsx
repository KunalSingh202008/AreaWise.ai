/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar, type Tab } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingView } from './components/landing/LandingView';
import { PlaceSearch } from './components/geography/PlaceSearch';
import { getJson, readJson } from './api';
import type { Locality, PlaceSummary } from './types';

const LocalityDashboard = lazy(() => import('./components/dashboard/LocalityDashboard').then((m) => ({ default: m.LocalityDashboard })));
const MapExplorerView = lazy(() => import('./components/map/MapExplorerView').then((m) => ({ default: m.MapExplorerView })));
const LocalityComparison = lazy(() => import('./components/comparison/LocalityComparison').then((m) => ({ default: m.LocalityComparison })));
const CommunityReportsView = lazy(() => import('./components/community/CommunityReportsView').then((m) => ({ default: m.CommunityReportsView })));
const AIAssistantView = lazy(() => import('./components/ai/AIAssistantView').then((m) => ({ default: m.AIAssistantView })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const SavedAreasView = lazy(() => import('./components/saved/SavedAreasView').then((m) => ({ default: m.SavedAreasView })));
const BillingView = lazy(() => import('./components/billing/BillingView').then((m) => ({ default: m.BillingView })));
const ProfessionalView = lazy(() => import('./components/professional/ProfessionalView').then((m) => ({ default: m.ProfessionalView })));
const PrintableReportModal = lazy(() => import('./components/reports/PrintableReportModal').then((m) => ({ default: m.PrintableReportModal })));

const paths: Record<Tab, string> = {
  landing: '/', dashboard: '/localities', explorer: '/map', compare: '/compare',
  community: '/community', assistant: '/copilot', admin: '/admin', saved: '/saved',
  professional: '/professional', billing: '/plans',
};
const tabs = Object.keys(paths) as Tab[];

function getRoute(): { tab: Tab; id: string | null } {
  const [, segment, id] = window.location.pathname.split('/');
  const tab = tabs.find((entry) => paths[entry] === `/${segment}`) ?? 'landing';
  const perPlace = tab === 'dashboard' || tab === 'explorer' || tab === 'assistant' || tab === 'community';
  return { tab, id: perPlace && id && /^[a-z0-9-]+$/i.test(id) ? id : null };
}

function PanelStatus({ message }: { message: string }) {
  return <p role="status" className="mx-auto max-w-7xl px-5 py-10 text-sm text-slate-600 dark:text-slate-400">{message}</p>;
}

function AppContent() {
  const { user } = useAuth();
  const [route, setRoute] = useState(getRoute);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [catalogueState, setCatalogueState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [localities, setLocalities] = useState<Record<string, Locality>>({});
  const [detailError, setDetailError] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<Locality | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantIds, setAssistantIds] = useState<string[]>([]);
  const [report, setReport] = useState<Locality | null>(null);
  const activeTab = route.tab;

  const refreshPlaces = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await getJson<{ results: PlaceSummary[] }>('/api/v1/locations/search', signal);
      if (!signal?.aborted) {
        setPlaces(data.results);
        setCatalogueState('ready');
      }
    } catch {
      if (!signal?.aborted) setCatalogueState('error');
    }
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void refreshPlaces(abort.signal);
    const onHistory = () => {
      setSelectedPoint(null);
      setRoute(getRoute());
    };
    window.addEventListener('popstate', onHistory);
    return () => {
      abort.abort();
      window.removeEventListener('popstate', onHistory);
    };
  }, [refreshPlaces]);

  const activeId = route.id ?? places[0]?.id;
  const currentLocality = selectedPoint ?? (activeId ? localities[activeId] : undefined);
  const detailsNeeded = ['dashboard', 'explorer', 'assistant', 'community'].includes(activeTab);
  const isLocalityReady = Boolean(currentLocality);

  useEffect(() => {
    if (!activeId || isLocalityReady || !detailsNeeded) return;
    const abort = new AbortController();
    getJson<Locality>(`/api/v1/locations/${encodeURIComponent(activeId)}`, abort.signal)
      .then((locality) => {
        if (abort.signal.aborted) return;
        setLocalities((previous) => ({ ...previous, [locality.id]: locality, [activeId]: locality }));
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setDetailError(error instanceof Error ? error.message : 'Location unavailable.');
      });
    return () => abort.abort();
  }, [activeId, isLocalityReady, detailsNeeded]);

  function navigate(tab: Tab, id: string | null = null, keepPoint = false) {
    const pathname = paths[tab] + (id ? `/${encodeURIComponent(id)}` : '');
    if (pathname !== window.location.pathname) history.pushState(null, '', pathname);
    if (!keepPoint) setSelectedPoint(null);
    setDetailError('');
    setRoute({ tab, id });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openLocality(id: string) {
    navigate('dashboard', id);
  }

  function openComparison(ids: string[] = []) {
    setComparisonIds(ids);
    navigate('compare');
  }

  function openAssistant(prompt = '') {
    setAssistantPrompt(prompt);
    setAssistantIds([]);
    navigate('assistant', currentLocality?.geography?.id ?? route.id);
  }

  async function resolveCoordinates(lat: number, lng: number) {
    const locality = await fetch('/api/v1/locations/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    }).then((response) => readJson<Locality>(response));
    setSelectedPoint(locality);
    navigate('dashboard', null, true);
  }

  const knownLocalities = [...new Map(Object.values(localities).map((locality) => [locality.id, locality])).values()];
  const chosenLocalities = currentLocality && !knownLocalities.includes(currentLocality)
    ? [currentLocality, ...knownLocalities] : knownLocalities;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigate(tab, ['dashboard', 'explorer', 'assistant', 'community'].includes(tab)
          ? currentLocality?.geography?.id ?? route.id : null)}
        selectedLocality={currentLocality}
      />
      <main className="flex-1" id="main">
        <Suspense fallback={<PanelStatus message="Loading view…" />}>
          {activeTab === 'landing' && (
            <>
              <LandingView
                places={places}
                onSelectLocality={openLocality}
                onOpenCompare={() => openComparison()}
                onOpenAssistant={() => openAssistant()}
                onResolveCoordinates={resolveCoordinates}
              />
              {catalogueState === 'error' && <PanelStatus message="The geography catalogue is temporarily unavailable." />}
            </>
          )}

          {detailsNeeded && !currentLocality && (
            <div>
              <PanelStatus message={detailError || (catalogueState === 'error' ? 'The geography catalogue is temporarily unavailable.'
                : activeId || catalogueState === 'loading' ? 'Loading locality…' : 'Search for a place to open its locality profile.')} />
              <div className="mx-auto max-w-7xl px-5 pb-8">
                <PlaceSearch onSelect={(place) => navigate(activeTab, place.id)} />
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && currentLocality && (
            <LocalityDashboard
              key={currentLocality.id}
              locality={currentLocality}
              allLocalities={chosenLocalities}
              onSelectLocality={openLocality}
              onOpenCompare={(ids) => openComparison(ids?.filter((id) => chosenLocalities.some((locality) => locality.geography?.id === id))
                ?? (currentLocality.geography ? [currentLocality.id] : []))}
              onOpenAssistantWithPrompt={openAssistant}
              onOpenReportModal={() => setReport(currentLocality)}
            />
          )}

          {activeTab === 'explorer' && currentLocality && (
            <MapExplorerView
              key={currentLocality.id}
              locality={currentLocality}
              onSelectLocality={(id) => navigate('explorer', id)}
            />
          )}

          {activeTab === 'compare' && (
            <LocalityComparison
              places={places}
              initialSelectedIds={comparisonIds}
              onSelectLocality={openLocality}
              onAskCopilot={(ids) => {
                setAssistantIds(ids);
                setAssistantPrompt('Compare the evidence for these places and explain the main information gaps.');
                navigate('assistant', ids[0]);
              }}
            />
          )}

          {activeTab === 'community' && currentLocality && (
            <CommunityReportsView
              key={currentLocality.id}
              locality={currentLocality}
              onSelectLocality={(id) => navigate('community', id)}
            />
          )}

          {activeTab === 'assistant' && currentLocality && (
            <AIAssistantView
              key={`${user?.id ?? 'guest'}:${currentLocality.id}`}
              selectedLocality={currentLocality}
              comparisonIds={assistantIds}
              onSelectLocality={(id) => {
                setAssistantIds([]);
                setAssistantPrompt('');
                navigate('assistant', id);
              }}
              initialPrompt={assistantPrompt}
            />
          )}

          {activeTab === 'admin' && (user?.role === 'admin'
            ? <AdminDashboard />
            : <PanelStatus message="Sign in with an administrator account to open this workspace." />)}

          {activeTab === 'saved' && (
            <SavedAreasView
              key={user?.id ?? 'guest'}
              onSelectLocality={openLocality}
              onOpenCompare={openComparison}
              onOpenReport={setReport}
            />
          )}
          {activeTab === 'billing' && <BillingView key={user?.id ?? 'guest'} />}
          {activeTab === 'professional' && <ProfessionalView key={user?.id ?? 'guest'} onOpenComparison={openComparison} />}
          {report && <PrintableReportModal locality={report} onClose={() => setReport(null)} />}
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
