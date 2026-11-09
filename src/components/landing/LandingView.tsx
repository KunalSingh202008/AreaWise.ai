import React, { useState } from 'react';
import { Search, ArrowRight, ShieldCheck, Database, MapPin, Compass, CheckCircle2, AlertTriangle, Sparkles, Navigation, Globe } from 'lucide-react';
import { Locality } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface LandingViewProps {
  localities: Locality[];
  onSelectLocality: (id: string) => void;
  onOpenCompare: () => void;
  onOpenAssistant: () => void;
  onResolveCoordinates?: (lat: number, lng: number, label?: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  localities,
  onSelectLocality,
  onOpenCompare,
  onOpenAssistant,
  onResolveCoordinates,
}) => {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [customLat, setCustomLat] = useState('25.3015');
  const [customLng, setCustomLng] = useState('82.9925');
  const [showCoordinateModal, setShowCoordinateModal] = useState(false);

  const filteredLocalities = localities.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.hindiName && l.hindiName.includes(searchQuery)) ||
      l.pincode.includes(searchQuery) ||
      l.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tagline.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const modules = [
    { title: 'Connectivity Intelligence', desc: 'Transit nodes, railway and highway proximity, actual commute congestion logs.' },
    { title: 'Healthcare Accessibility', desc: 'Bed counts, ICU density, emergency hospital drive-times, 24/7 pharmacies.' },
    { title: 'Education Accessibility', desc: 'NIRF-ranked universities, CBSE/ICSE schools, preschools and libraries.' },
    { title: 'Environmental Intelligence', desc: '30-day continuous CPCB AQI sensors, ISRO Bhuvan satellite canopy %, acoustic noise.' },
    { title: 'Civic Infrastructure', desc: 'UP Jal Nigam piped water coverage, underground power cabling, flood runoff clearance.' },
    { title: 'Daily Amenities', desc: 'Walkable grocery, banking branches, sports facilities, local produce mandis.' },
    { title: 'Property Transparency', desc: 'Official IGRS circle rates, RERA project compliance ratio, title dispute density.' },
    { title: 'Resident Intelligence', desc: 'Verified local resident issue submissions, photo evidence, and municipal resolution tracking.' },
  ];

  const handleCustomResolve = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (!isNaN(lat) && !isNaN(lng) && onResolveCoordinates) {
      onResolveCoordinates(lat, lng, `Custom Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      setShowCoordinateModal(false);
    }
  };

  return (
    <div className="space-y-20 pb-16">
      {/* 1. Hero Section with Glassmorphism Search */}
      <section className="relative overflow-hidden bg-slate-900 text-white rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 border border-slate-800 shadow-2xl">
        {/* Background Image with Scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/hero_varanasi_urban_1794054119447.jpg"
            alt="Varanasi Urban Landscape"
            className="w-full h-full object-cover object-center opacity-35 mix-blend-luminosity"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-900/60" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 sm:py-28 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {t.pilotBadge} · 15+ Localities Supported
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight max-w-3xl">
            {t.tagline}
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed">
            {language === 'hi'
              ? 'ब्रोकरों के भ्रामक दावों से बचें। एरियावाइज एआई सीपीसीबी वायु गुणवत्ता सेंसरों, इसरो भुवन सैटेलाइट और नगर निगम के वास्तविक डेटा से इलाकों का सटीक मूल्यांकन करता है।'
              : 'Stop relying on biased broker claims. AreaWise AI calculates objective, evidence-grounded locality scores for Varanasi using statutory sensors, municipal records, and satellite telemetry.'}
          </p>

          {/* Search Bar with Autocomplete dropdown */}
          <div className="relative max-w-2xl mb-6">
            <div className="flex items-center bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-2 border border-slate-200 dark:border-slate-700">
              <Search className="w-5 h-5 text-slate-400 ml-3 mr-2 shrink-0" />
              <input
                type="text"
                placeholder={t.search.placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none text-xs sm:text-sm py-2"
              />
              <button
                onClick={() => {
                  if (filteredLocalities.length > 0) {
                    onSelectLocality(filteredLocalities[0].id);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-md"
              >
                {t.search.inspectBtn}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchFocused && searchQuery.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-30 text-left max-h-80 overflow-y-auto">
                {filteredLocalities.length > 0 ? (
                  filteredLocalities.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        onSelectLocality(loc.id);
                        setIsSearchFocused(false);
                      }}
                      className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between border-b last:border-0 border-slate-100 dark:border-slate-700 text-left transition-colors"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                          {loc.name} {loc.hindiName ? `(${loc.hindiName})` : ''}, {loc.city}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          PIN {loc.pincode} · {loc.tagline}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {loc.scores.overallScore}
                        </span>
                        <div className="text-[10px] text-slate-400">AreaScore</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-xs text-slate-500 text-center">
                    {t.search.noResults}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Pilot Locality Tags & Custom Pin Resolver Button */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-bold text-slate-300">{t.search.popularAreas}</span>
            {localities.slice(0, 7).map((loc) => (
              <button
                key={loc.id}
                onClick={() => onSelectLocality(loc.id)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors border border-white/10"
              >
                {loc.name} ({loc.pincode})
              </button>
            ))}

            <button
              onClick={() => setShowCoordinateModal(true)}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold hover:bg-emerald-500/30 transition-colors flex items-center gap-1 ml-auto"
            >
              <Navigation className="w-3 h-3" />
              Pin Exact Coordinates
            </button>
          </div>
        </div>
      </section>

      {/* Coordinate Resolver Modal */}
      {showCoordinateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-500" />
                Resolve Custom Varanasi Point
              </h3>
              <button onClick={() => setShowCoordinateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter any GPS coordinates within the Varanasi Metropolitan Area. The spatial engine will calculate real haversine distance to hospitals, schools, CPCB air monitors, and railway hubs.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={customLng}
                  onChange={(e) => setCustomLng(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowCoordinateModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomResolve}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Resolve & Inspect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Independent Positioning Banner: NOT a Property Listing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-50 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1.5 max-w-3xl">
            <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
              Core Proposition & Ethics
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              AreaWise is strictly NOT a property listing or broker directory.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Listing portals are incentivized to sell you apartments by hiding waterlogging, power outages, and poor water quality. AreaWise operates as an independent geospatial research firm providing unbiased locality indicators.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenCompare}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              {t.comparison.title}
            </button>
            <button
              onClick={onOpenAssistant}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t.dashboard.askAI}
            </button>
          </div>
        </div>
      </section>

      {/* 3. Varanasi Localities Showcase Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mb-1">
              Varanasi City Coverage
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Explore Varanasi Neighborhood Intelligence
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
            Click any locality card to inspect interactive map layers, category metrics, and download the verified intelligence brief.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {localities.slice(0, 9).map((locality) => (
            <div
              key={locality.id}
              onClick={() => onSelectLocality(locality.id)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-xl transition-all cursor-pointer flex flex-col hover:border-emerald-500/50"
            >
              <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={locality.previewImage}
                  alt={locality.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-xs font-black font-mono border border-white/20">
                  {locality.scores.overallScore} / 100
                </div>
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                  PIN {locality.pincode}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {language === 'hi' && locality.hindiName ? locality.hindiName : locality.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                    {language === 'hi' && locality.hindiDescription ? locality.hindiDescription : locality.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 mb-4 pt-3 border-t border-slate-100 dark:border-slate-800 font-medium">
                    <div>Transit: <span className="font-bold text-slate-900 dark:text-slate-200">{locality.scores.categoryScores.connectivity}/100</span></div>
                    <div>Health: <span className="font-bold text-slate-900 dark:text-slate-200">{locality.scores.categoryScores.healthcare}/100</span></div>
                    <div>Environment: <span className="font-bold text-slate-900 dark:text-slate-200">{locality.scores.categoryScores.environment}/100</span></div>
                    <div>Civic: <span className="font-bold text-slate-900 dark:text-slate-200">{locality.scores.categoryScores.civicInfrastructure}/100</span></div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 mb-4">
                    <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400 line-clamp-1">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{locality.strengths[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>Coverage: <strong>{locality.scores.coverageScore}%</strong></span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    {t.search.inspectBtn} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. The 8 Area Intelligence Modules */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mb-1">
            Comprehensive Analytical Scope
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
            The 8 Area Intelligence Modules
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Each locality is evaluated across eight distinct pillars with normalized, reproducible algorithms grounded in open data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m, index) => (
            <div
              key={index}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 hover:border-emerald-500/50 transition-all shadow-xs"
            >
              <div className="text-xs font-bold text-slate-400 font-mono">0{index + 1}.</div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{m.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
