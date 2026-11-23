import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { Sun, Moon, Shield, Bookmark, Sparkles, Globe, MapPin, ChevronDown } from 'lucide-react';
import { SupportedLanguage, Locality } from '../../types';

export type Tab = 'landing' | 'dashboard' | 'explorer' | 'compare' | 'community' | 'assistant' | 'admin' | 'saved' | 'professional' | 'billing';

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedLocality?: Locality;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, selectedLocality }) => {
  const { user, login, logout, setLanguagePreference } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [authError, setAuthError] = useState('');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const handleLangChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setLanguagePreference(lang);
    setIsLangMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-2 text-left group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md"
          >
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              AreaWise<span className="text-emerald-500 dark:text-emerald-400">.ai</span>
            </span>
          </button>

          {selectedLocality && <button
            onClick={() => setActiveTab('dashboard')}
            title="Current Active Locality"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500/50 transition-colors"
          >
            <MapPin className="w-3 h-3 text-emerald-500" />
            <span className="truncate max-w-[130px]">{selectedLocality.name}</span>
            {selectedLocality.pincode && <span className="text-slate-400 font-mono text-[10px]">({selectedLocality.pincode})</span>}
          </button>}
        </div>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav className="hidden xl:flex items-center gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <button
            onClick={() => setActiveTab('landing')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'landing'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-500'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.nav.overview}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'dashboard'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-500'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.nav.dashboard}
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'explorer'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-500'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.nav.explorer}
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'compare'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-500'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.nav.compare}
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === 'community'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-500'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.nav.community}
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 flex items-center gap-1 ${
              activeTab === 'assistant'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-500'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            {t.nav.assistant}
          </button>
          <button onClick={() => setActiveTab('professional')} className="whitespace-nowrap">Professional</button>
          <button onClick={() => setActiveTab('billing')} className="whitespace-nowrap">Plans</button>
        </nav>

        {/* Zone 3: 1 primary action area with language switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Multilingual Selector */}
          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span className="uppercase text-[11px]">{language}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isLangMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-50 text-xs">
                <button
                  onClick={() => handleLangChange('en')}
                  className={`w-full text-left px-3 py-1.5 font-semibold transition-colors flex items-center justify-between ${
                    language === 'en' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  English
                  {language === 'en' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
                <button
                  onClick={() => handleLangChange('hi')}
                  className={`w-full text-left px-3 py-1.5 font-semibold transition-colors flex items-center justify-between ${
                    language === 'hi' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  हिन्दी
                  {language === 'hi' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
                <button
                  onClick={() => handleLangChange('hinglish')}
                  className={`w-full text-left px-3 py-1.5 font-semibold transition-colors flex items-center justify-between ${
                    language === 'hinglish' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Hinglish
                  {language === 'hinglish' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
              </div>
            )}
          </div>

          {/* Saved Areas Bookmark */}
          <button
            onClick={() => setActiveTab('saved')}
            title="Saved Localities & Reports"
            className={`p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative ${
              activeTab === 'saved' ? 'text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-800' : ''
            }`}
          >
            <Bookmark className="w-4 h-4" />
            {(user?.savedLocalityIds.length || 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Admin Mode Toggle */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
          <button
            onClick={async () => {
              setAuthError('');
              try {
                if (user) {
                  await logout();
                  setActiveTab('landing');
                } else {
                  await login();
                }
              } catch {
                setAuthError(user ? 'Sign-out failed. Try again.' : 'Google sign-in failed. Try again.');
              }
            }}
            className="text-xs font-semibold whitespace-nowrap"
          >
            {user ? 'Sign out' : 'Sign in'}
          </button>
          {authError && <p role="alert" className="absolute top-full right-4 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-red-600">{authError}</p>}

        </div>
      </div>
      <nav aria-label="Mobile navigation" className="flex gap-4 overflow-x-auto border-t border-slate-200 px-4 py-2 text-xs dark:border-slate-800 xl:hidden">
        {([
          ['dashboard', t.nav.dashboard], ['explorer', t.nav.explorer], ['compare', t.nav.compare],
          ['community', t.nav.community], ['assistant', t.nav.assistant], ['saved', 'My research'],
          ['professional', 'Professional'], ['billing', 'Plans'],
        ] as const).map(([tab, label]) => (
          <button key={tab} aria-current={activeTab === tab ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap ${activeTab === tab ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab(tab)}>{label}</button>
        ))}
      </nav>
    </header>
  );
};
