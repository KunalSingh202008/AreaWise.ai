import React, { useState } from 'react';
import { Locality, Facility } from '../../types';
import { InteractiveLocalityMap } from '../map/InteractiveLocalityMap';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Bookmark,
  FileDown,
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  Compass,
  SlidersHorizontal,
  Mic,
  TrendingUp,
} from 'lucide-react';
import { PropertyMarketTrends } from './PropertyMarketTrends';

interface LocalityDashboardProps {
  locality: Locality;
  allLocalities: Locality[];
  onSelectLocality: (id: string) => void;
  onOpenCompare: (selectedIds?: string[]) => void;
  onOpenAssistantWithPrompt?: (prompt: string) => void;
  onOpenReportModal: () => void;
  onResolveCoordinates?: (lat: number, lng: number, label?: string) => void;
}

export const LocalityDashboard: React.FC<LocalityDashboardProps> = ({
  locality,
  allLocalities,
  onSelectLocality,
  onOpenCompare,
  onOpenAssistantWithPrompt,
  onOpenReportModal,
  onResolveCoordinates,
}) => {
  const { isLocalitySaved, toggleSaveLocality, user, setPreferredProfile } = useAuth();
  const { language, t } = useLanguage();

  const [activeProfile, setActiveProfile] = useState<'overall' | 'family' | 'student' | 'commuter' | 'investor'>(
    user?.preferredProfile || 'overall'
  );
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(locality.indicators[0]?.id || null);
  const [facilityRadius, setFacilityRadius] = useState<number>(3000);

  const isSaved = isLocalitySaved(locality.id);

  // Compute profile score display
  let displayedScore = locality.scores.overallScore;
  let displayedScoreLabel = t.dashboard.areaScore;
  let profileDescription =
    language === 'hi'
      ? 'समग्र सात श्रेणियों का संतुलित सांख्यिकीय भार।'
      : language === 'hinglish'
      ? 'Sabhi 7 categories ka balanced weighted score.'
      : 'Comprehensive multi-category weighted empirical assessment.';

  if (activeProfile === 'family') {
    displayedScore = locality.profileScores.familyScore;
    displayedScoreLabel = t.dashboard.familyScore;
    profileDescription =
      language === 'hi'
        ? 'शिक्षा (30%), स्वास्थ्य (25%) और शांत पर्यावरण (20%) पर केंद्रित।'
        : language === 'hinglish'
        ? 'Education (30%), Healthcare (25%) aur Environment (20%) par weighted.'
        : 'Weighted for School Quality (30%), Healthcare access (25%), and Environmental serenity (20%).';
  } else if (activeProfile === 'student') {
    displayedScore = locality.profileScores.studentScore;
    displayedScoreLabel = t.dashboard.studentScore;
    profileDescription =
      language === 'hi'
        ? 'विश्वविद्यालय एवं कॉलेज (35%), किफायती खानपान (25%), और पब्लिक ट्रांजिट (25%)।'
        : language === 'hinglish'
        ? 'College access (35%), Affordable amenities (25%), aur Transit (25%).'
        : 'Optimized for University access (35%), Affordable amenities (25%), and Public Transit (25%).';
  } else if (activeProfile === 'commuter') {
    displayedScore = locality.profileScores.commuterScore;
    displayedScoreLabel = t.dashboard.commuterScore;
    profileDescription =
      language === 'hi'
        ? 'मुख्य सड़कें एवं रेलवे स्टेशन निकटता (45%), और नागरिक सुविधाएं (25%)।'
        : language === 'hinglish'
        ? 'Transit corridors & Station connectivity (45%), Civic uptime (25%).'
        : 'Optimized for Transit arteries (45%), Railway station access, and Civic uptime (25%).';
  } else if (activeProfile === 'investor') {
    displayedScore = locality.profileScores.investorScore;
    displayedScoreLabel = t.dashboard.investorScore;
    profileDescription =
      language === 'hi'
        ? 'सर्किल रेट व टाइटल स्पष्टता (40%), और भविष्य के बुनियादी ढांचे (25%)।'
        : language === 'hinglish'
        ? 'Property title transparency (40%), Infra pipeline (25%).'
        : 'Optimized for Property Title Transparency (40%), Infra pipeline (25%), and Civic upgrades (20%).';
  }

  const categoryScoreList = [
    { key: 'connectivity', name: 'Connectivity & Transit', score: locality.scores.categoryScores.connectivity, weight: '20%' },
    { key: 'healthcare', name: 'Healthcare Accessibility', score: locality.scores.categoryScores.healthcare, weight: '10%' },
    { key: 'education', name: 'Education Access', score: locality.scores.categoryScores.education, weight: '10%' },
    { key: 'environment', name: 'Environmental Intelligence', score: locality.scores.categoryScores.environment, weight: '20%' },
    { key: 'civicInfrastructure', name: 'Civic Infrastructure', score: locality.scores.categoryScores.civicInfrastructure, weight: '20%' },
    { key: 'dailyAmenities', name: 'Daily Amenities', score: locality.scores.categoryScores.dailyAmenities, weight: '10%' },
    { key: 'propertyMarketTransparency', name: 'Property Market Transparency', score: locality.scores.categoryScores.propertyMarketTransparency, weight: '10%' },
  ];

  // Filter facilities by radius
  const filteredFacilities = locality.facilities.filter((f) => f.distanceMeters <= facilityRadius);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header with Glassmorphism Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 backdrop-blur-2xl border border-slate-800/80 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            {/* Quick Locality Switcher */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Varanasi Locality:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/10 dark:bg-slate-800/80 rounded-xl backdrop-blur-sm border border-white/10">
                {allLocalities.slice(0, 7).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLocality(l.id)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      l.id === locality.id
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {language === 'hi' && l.hindiName ? l.hindiName : l.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                {language === 'hi' && locality.hindiName ? locality.hindiName : locality.name}
              </h1>
              <span className="text-sm font-semibold text-slate-300">
                {locality.city}, {locality.state} · PIN {locality.pincode}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                {locality.center.lat.toFixed(4)}°N, {locality.center.lng.toFixed(4)}°E
              </span>
              {locality.isCustomResolved && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {t.dashboard.customResolvedNotice}
                </span>
              )}
            </div>

            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              {language === 'hi' && locality.hindiDescription ? locality.hindiDescription : locality.description}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => toggleSaveLocality(locality.id)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 border transition-all ${
                isSaved
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? t.dashboard.savedArea : t.dashboard.saveArea}
            </button>

            <button
              onClick={() => onOpenCompare([locality.id])}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 flex items-center gap-1.5 transition-all"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {t.dashboard.compareArea}
            </button>

            <button
              onClick={onOpenReportModal}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-all shadow-md"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
              {t.dashboard.downloadReport}
            </button>

            <button
              onClick={() => {
                if (onOpenAssistantWithPrompt) {
                  onOpenAssistantWithPrompt(
                    language === 'hi'
                      ? `${locality.hindiName || locality.name} का विस्तृत सांख्यिकीय विश्लेषण बताएं।`
                      : `Give me a detailed evidence breakdown for ${locality.name}, Varanasi.`
                  );
                }
              }}
              className="px-4 py-2 text-xs font-black rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white flex items-center gap-2 transition-all shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              {t.dashboard.askAI}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary Score Card + Data Integrity Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Summary Box (Glassmorphic) */}
        <div className="lg:col-span-1 p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {displayedScoreLabel}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Methodology {locality.scores.methodologyVersion}
              </span>
            </div>

            {/* Personalized Profile Selector Tabs */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold mb-5">
              {[
                { id: 'overall', label: 'Overall' },
                { id: 'family', label: 'Family' },
                { id: 'student', label: 'Student' },
                { id: 'commuter', label: 'Commute' },
                { id: 'investor', label: 'Investor' },
              ].map((prof) => (
                <button
                  key={prof.id}
                  onClick={() => {
                    setActiveProfile(prof.id as any);
                    if (prof.id !== 'overall') {
                      setPreferredProfile(prof.id as any);
                    }
                  }}
                  className={`py-1.5 rounded-lg text-center transition-all text-[11px] ${
                    activeProfile === prof.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {prof.label}
                </button>
              ))}
            </div>

            {/* Large Score Metric with Animated Feel */}
            {locality.scores.isEligibleForOverallScore && displayedScore !== null ? (
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-6xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {displayedScore}
                </span>
                <span className="text-xl text-slate-400 font-bold">/ 100</span>
                <span className="ml-auto px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {displayedScore >= 80 ? 'Grade A (High)' : 'Grade B (Fair)'}
                </span>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-300 text-xs mb-3">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" /> Score Withheld
                </div>
                Evidence coverage ({locality.scores.coverageScore}%) is below the mandatory 50% threshold. AreaWise strictly avoids generating deceptive composite scores for unobserved areas.
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {profileDescription}
            </p>

            {activeProfile === 'investor' && (
              <div className="pt-1">
                <a
                  href="#property-market-trends"
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>View Property Market Transparency & Scenario Simulator ↓</span>
                </a>
              </div>
            )}
          </div>

          {/* Key Strengths & Cautions */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <div className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t.dashboard.verifiedStrengths}
              </div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-300 pl-4 list-disc marker:text-emerald-500">
                {locality.strengths.slice(0, 3).map((s, i) => (
                  <li key={i} className="leading-snug">{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" /> {t.dashboard.knownCautions}
              </div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-300 pl-4 list-disc marker:text-amber-500">
                {locality.cautions.slice(0, 2).map((c, i) => (
                  <li key={i} className="leading-snug">{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Data Reliability & Category Bars */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reliability Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.dashboard.coverage}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {locality.scores.coverageScore}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {Math.round((locality.scores.coverageScore / 100) * 24)} of 24 core indicators observed
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.dashboard.confidence}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {locality.scores.confidenceScore !== null ? `${locality.scores.confidenceScore}%` : 'Unrated'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {locality.scores.confidenceScore !== null ? 'Statutory CPCB & SCADA tier' : 'No source verification'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t.dashboard.freshness}</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {locality.scores.dataFreshnessDays !== null ? (
                  `${locality.scores.dataFreshnessDays} ${language === 'hi' ? 'दिन' : 'days'}`
                ) : (
                  <span className="text-base text-slate-400 font-sans">Pending Data</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Avg observation recency</div>
            </div>
          </div>

          {/* Category Scores Overview */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
              <span>{t.dashboard.indicatorsTitle}</span>
              <span className="text-xs font-normal text-slate-400">7 Core Pillars</span>
            </h3>
            <div className="space-y-3.5">
              {categoryScoreList.map((cat) => (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {cat.name} <span className="text-slate-400 font-normal">({cat.weight})</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {cat.score !== null ? (
                        `${cat.score}/100`
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-normal italic">
                          Unavailable
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {cat.score !== null ? (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cat.score >= 85
                            ? 'bg-emerald-500'
                            : cat.score >= 70
                            ? 'bg-blue-500'
                            : cat.score >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${cat.score}%` }}
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-200/50 dark:bg-slate-700/50 border-r-2 border-dashed border-slate-400 dark:border-slate-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Property Market Trends & Infrastructure Growth Module (Recharts) */}
      <div id="property-market-trends">
        <PropertyMarketTrends locality={locality} />
      </div>

      {/* 4. Interactive Map & Facility Radius Explorer */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t.dashboard.mapTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive OpenStreetMap GIS layer. Click anywhere on the map to analyze custom coordinates!
            </p>
          </div>

          {/* Radius Filter Slider */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Radius Filter:</span>
              <select
                value={facilityRadius}
                onChange={(e) => setFacilityRadius(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
              >
                <option value={1000}>1.0 km</option>
                <option value={2000}>2.0 km</option>
                <option value={3000}>3.0 km</option>
                <option value={5000}>5.0 km</option>
              </select>
            </div>

            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {filteredFacilities.length} Facilities in buffer
            </span>
          </div>
        </div>

        <InteractiveLocalityMap
          center={locality.center}
          bounds={locality.bounds}
          localityName={locality.name}
          facilities={filteredFacilities}
          onSelectFacility={(fac) => setSelectedFacility(fac)}
          className="h-[520px] w-full"
        />

        {selectedFacility && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-md">
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {selectedFacility.name}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {selectedFacility.subcategory} · {selectedFacility.address} · {selectedFacility.distanceMeters}m from {locality.name} center
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                {selectedFacility.verificationStatus.replace('_', ' ')}: {selectedFacility.source}
              </span>
              <button
                onClick={() => setSelectedFacility(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Detailed Empirical Indicators Drilldown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t.dashboard.indicatorsTitle}
          </h2>
          <span className="text-xs text-slate-500">
            Click any pillar to inspect underlying quantitative readings
          </span>
        </div>

        <div className="space-y-3">
          {locality.indicators.map((ind) => {
            const isExpanded = expandedCategory === ind.id;
            return (
              <div
                key={ind.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs transition-colors"
              >
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : ind.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {ind.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
                      {ind.score}/100
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {isExpanded ? t.dashboard.hideData : t.dashboard.inspectData}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4 text-xs">
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {ind.summary}
                    </p>

                    {/* Metrics Table */}
                    <div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Quantitative Sensor & Registry Readings:
                      </div>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="px-4 py-2">{t.dashboard.observedMetric}</th>
                              <th className="px-4 py-2">{t.dashboard.observedValue}</th>
                              <th className="px-4 py-2">{t.dashboard.source}</th>
                              <th className="px-4 py-2">{t.dashboard.dataDate}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {ind.metrics.map((m, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="px-4 py-2.5 font-semibold">{m.label}</td>
                                <td className="px-4 py-2.5 font-mono font-black text-slate-900 dark:text-white">
                                  {m.value} {m.unit || ''}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">{m.source}</td>
                                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{m.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Missing Data Transparency Warning Banner */}
      {locality.missingDataNotes && locality.missingDataNotes.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <div className="font-bold text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            {t.dashboard.missingDataTitle}
          </div>
          <ul className="space-y-1 pl-5 list-disc marker:text-amber-500 text-slate-600 dark:text-slate-400">
            {locality.missingDataNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
