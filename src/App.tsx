/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingView } from './components/landing/LandingView';
import { LocalityDashboard } from './components/dashboard/LocalityDashboard';
import { MapExplorerView } from './components/map/MapExplorerView';
import { LocalityComparison } from './components/comparison/LocalityComparison';
import { CommunityReportsView } from './components/community/CommunityReportsView';
import { AIAssistantView } from './components/ai/AIAssistantView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SavedAreasView } from './components/saved/SavedAreasView';
import { PrintableReportModal } from './components/reports/PrintableReportModal';
import { Locality } from './types';
import { VARANASI_LOCALITIES } from '../server/data';

function AppContent() {
  const [localities, setLocalities] = useState<Locality[]>(VARANASI_LOCALITIES);
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>('sigra');
  const [activeTab, setActiveTab] = useState<
    'landing' | 'dashboard' | 'explorer' | 'compare' | 'community' | 'assistant' | 'admin' | 'saved'
  >('landing');
  const [comparisonIds, setComparisonIds] = useState<string[]>(['sigra', 'lanka', 'mahmoorganj']);
  const [assistantPrompt, setAssistantPrompt] = useState<string>('');
  const [reportModalLocality, setReportModalLocality] = useState<Locality | null>(null);

  // Fetch localities from backend API
  const refreshLocalities = async () => {
    try {
      const res = await fetch('/api/v1/locations/search?city=varanasi');
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const fullList: Locality[] = [];
          for (const item of data.results) {
            const locRes = await fetch(`/api/v1/locations/${item.id}`);
            if (locRes.ok) {
              const fullLoc = await locRes.json();
              fullList.push(fullLoc);
            }
          }
          if (fullList.length > 0) {
            setLocalities(fullList);
          }
        }
      }
    } catch (err) {
      console.warn('Backend API warming up, using local attributable pilot data:', err);
    }
  };

  useEffect(() => {
    refreshLocalities();
  }, []);

  // Selected Locality object
  const currentLocality =
    localities.find((l) => l.id.toLowerCase() === selectedLocalityId.toLowerCase()) ||
    localities[0] ||
    VARANASI_LOCALITIES[0];

  const handleSelectLocality = (id: string) => {
    setSelectedLocalityId(id);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCompare = (ids?: string[]) => {
    if (ids && ids.length > 0) {
      setComparisonIds(ids);
    }
    setActiveTab('compare');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAssistantWithPrompt = (prompt: string) => {
    setAssistantPrompt(prompt);
    setActiveTab('assistant');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic Geographic Point Resolver
  const handleResolveCoordinates = async (lat: number, lng: number, label?: string) => {
    try {
      const res = await fetch('/api/v1/locations/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, label }),
      });

      if (res.ok) {
        const resolved = await res.json();
        // Add to localities if not present
        if (!localities.some((l) => l.id === resolved.id)) {
          setLocalities([resolved, ...localities]);
        }
        setSelectedLocalityId(resolved.id);
        setActiveTab('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error resolving coordinates:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedLocality={currentLocality}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'landing' && (
          <LandingView
            localities={localities}
            onSelectLocality={handleSelectLocality}
            onOpenCompare={() => handleOpenCompare(['sigra', 'lanka', 'mahmoorganj'])}
            onOpenAssistant={() => {
              setAssistantPrompt('What are the key differences between Sigra, Lanka, and Mahmoorganj in Varanasi?');
              setActiveTab('assistant');
            }}
            onResolveCoordinates={handleResolveCoordinates}
          />
        )}

        {activeTab === 'dashboard' && (
          <LocalityDashboard
            locality={currentLocality}
            allLocalities={localities}
            onSelectLocality={setSelectedLocalityId}
            onOpenCompare={(ids) => handleOpenCompare(ids || [currentLocality.id, 'lanka'])}
            onOpenAssistantWithPrompt={handleOpenAssistantWithPrompt}
            onOpenReportModal={() => setReportModalLocality(currentLocality)}
            onResolveCoordinates={handleResolveCoordinates}
          />
        )}

        {activeTab === 'explorer' && (
          <MapExplorerView
            localities={localities}
            selectedLocalityId={selectedLocalityId}
            onSelectLocality={setSelectedLocalityId}
          />
        )}

        {activeTab === 'compare' && (
          <LocalityComparison
            localities={localities}
            initialSelectedIds={comparisonIds}
            onSelectLocality={handleSelectLocality}
            onOpenAssistantWithPrompt={handleOpenAssistantWithPrompt}
          />
        )}

        {activeTab === 'community' && (
          <CommunityReportsView
            localities={localities}
            selectedLocalityId={selectedLocalityId}
          />
        )}

        {activeTab === 'assistant' && (
          <AIAssistantView
            localities={localities}
            selectedLocality={currentLocality}
            onSelectLocality={setSelectedLocalityId}
            initialPrompt={assistantPrompt}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            localities={localities}
            onRefreshData={refreshLocalities}
          />
        )}

        {activeTab === 'saved' && (
          <SavedAreasView
            localities={localities}
            onSelectLocality={handleSelectLocality}
            onOpenCompare={handleOpenCompare}
            onOpenReport={(loc) => setReportModalLocality(loc)}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Downloadable / Printable PDF Evidence Brief Modal */}
      {reportModalLocality && (
        <PrintableReportModal
          locality={reportModalLocality}
          onClose={() => setReportModalLocality(null)}
        />
      )}
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
