import React, { useState } from 'react';
import { Locality } from '../../types';
import { Check, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

interface LocalityComparisonProps {
  localities: Locality[];
  initialSelectedIds?: string[];
  onSelectLocality: (id: string) => void;
  onOpenAssistantWithPrompt?: (prompt: string) => void;
}

export const LocalityComparison: React.FC<LocalityComparisonProps> = ({
  localities,
  initialSelectedIds = ['sigra', 'lanka'],
  onSelectLocality,
  onOpenAssistantWithPrompt,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds.length >= 2 ? initialSelectedIds : ['sigra', 'lanka']
  );
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 2) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      }
    } else {
      if (selectedIds.length < 3) {
        setSelectedIds([...selectedIds, id]);
      } else {
        // replace last
        setSelectedIds([selectedIds[0], selectedIds[1], id]);
      }
    }
  };

  const selectedLocalities = localities.filter((l) => selectedIds.includes(l.id));

  const categories = [
    { key: 'connectivity', name: 'Connectivity & Transit' },
    { key: 'healthcare', name: 'Healthcare Accessibility' },
    { key: 'education', name: 'Education Access' },
    { key: 'environment', name: 'Environmental Intelligence' },
    { key: 'civicInfrastructure', name: 'Civic Infrastructure' },
    { key: 'dailyAmenities', name: 'Daily Amenities' },
    { key: 'propertyMarketTransparency', name: 'Property Market Transparency' },
  ];

  const handleGenerateAISummary = async () => {
    setIsLoadingAI(true);
    try {
      const response = await fetch('/api/v1/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Compare ${selectedLocalities.map((l) => l.name).join(' and ')} in Varanasi. Explain which is superior for families, which for students, and what the key environmental trade-offs are based on retrieved evidence.`,
          comparisonIds: selectedIds,
        }),
      });
      const data = await response.json();
      setAiSummary(data.answer);
    } catch (err) {
      console.error('Failed to generate AI comparison:', err);
      setAiSummary('Error contacting AI engine. Please check local records.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Locality Comparison Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compare up to 3 pilot areas side-by-side using normalized empirical indicators.
          </p>
        </div>

        {/* Locality Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Select Areas:</span>
          {localities.map((loc) => {
            const isSelected = selectedIds.includes(loc.id);
            return (
              <button
                key={loc.id}
                onClick={() => toggleSelect(loc.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                {loc.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric Labels Column */}
        <div className="hidden md:flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div className="font-bold text-slate-900 dark:text-white text-sm mb-6">
            Metric / Category
          </div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">Overall AreaScore</div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">FamilyScore Profile</div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">StudentScore Profile</div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">CommuterScore Profile</div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">InvestorScore Profile</div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">Data Coverage</div>
          <div className="py-2.5 border-b border-slate-200 dark:border-slate-800">Data Confidence</div>
          <div className="py-2.5 font-bold text-slate-900 dark:text-white">Category Scores</div>
        </div>

        {/* Selected Localities Columns */}
        {selectedLocalities.map((loc) => (
          <div
            key={loc.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
          >
            {/* Header */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {loc.name}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-500">
                  PIN {loc.pincode}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-4">
                {loc.tagline}
              </p>

              {/* Large Score */}
              <div className="py-2 border-b border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                <span className="md:hidden text-xs text-slate-400">AreaScore:</span>
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {loc.scores.overallScore}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </span>
              </div>

              {/* Profiles */}
              <div className="space-y-2 py-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">FamilyScore:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{loc.profileScores.familyScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">StudentScore:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{loc.profileScores.studentScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CommuterScore:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{loc.profileScores.commuterScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">InvestorScore:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{loc.profileScores.investorScore}</span>
                </div>
              </div>

              {/* Data Reliability */}
              <div className="space-y-1.5 py-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{loc.scores.coverageScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confidence:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{loc.scores.confidenceScore}%</span>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-2 py-3 text-xs">
                {categories.map((c) => {
                  const score = (loc.scores.categoryScores as any)[c.key] || 0;
                  return (
                    <div key={c.key} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500 truncate max-w-[140px]">{c.name}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{score}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => onSelectLocality(loc.id)}
              className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white transition-colors flex items-center justify-center gap-1"
            >
              Inspect {loc.name} Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* AI Comparative Synthesis Section */}
      <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Evidence-Grounded AI Synthesis
            </div>
            <h3 className="text-lg font-bold text-white">
              AI Comparative Trade-Off Analysis
            </h3>
            <p className="text-xs text-slate-300">
              Generates an evidence-backed comparative assessment grounded in statutory records and resident logs.
            </p>
          </div>

          <button
            onClick={handleGenerateAISummary}
            disabled={isLoadingAI}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-2 shrink-0 shadow-sm"
          >
            {isLoadingAI ? 'Synthesizing Evidence...' : 'Generate AI Comparison'}
          </button>
        </div>

        {aiSummary && (
          <div className="mt-4 p-5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3 whitespace-pre-line">
            {aiSummary}
          </div>
        )}
      </div>
    </div>
  );
};
