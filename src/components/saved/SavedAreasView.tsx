import React from 'react';
import { Locality } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Bookmark, ArrowRight, ArrowRightLeft, FileDown, Trash2 } from 'lucide-react';

interface SavedAreasViewProps {
  localities: Locality[];
  onSelectLocality: (id: string) => void;
  onOpenCompare: (selectedIds: string[]) => void;
  onOpenReport: (locality: Locality) => void;
}

export const SavedAreasView: React.FC<SavedAreasViewProps> = ({
  localities,
  onSelectLocality,
  onOpenCompare,
  onOpenReport,
}) => {
  const { user, toggleSaveLocality } = useAuth();
  const savedIds = user?.savedLocalityIds || [];
  const savedList = localities.filter((l) => savedIds.includes(l.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-emerald-500 fill-current" />
            Saved Localities & Portfolios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and monitor intelligence reports for areas of interest across Varanasi.
          </p>
        </div>

        {savedList.length >= 2 && (
          <button
            onClick={() => onOpenCompare(savedList.map((l) => l.id))}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-colors self-start sm:self-auto shadow-xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Compare All Saved ({savedList.length})
          </button>
        )}
      </div>

      {savedList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedList.map((locality) => (
            <div
              key={locality.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {locality.name}
                  </h3>
                  <button
                    onClick={() => toggleSaveLocality(locality.id)}
                    title="Remove from saved"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {locality.description}
                </p>

                <div className="flex items-baseline justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-4">
                  <span className="text-xs text-slate-500">Official AreaScore:</span>
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {locality.scores.overallScore !== null ? (
                      <>
                        {locality.scores.overallScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Withheld</span>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 mb-2">
                  <div>Coverage: <strong className="text-slate-700 dark:text-slate-300">{locality.scores.coverageScore}%</strong></div>
                  <div>Confidence: <strong className="text-slate-700 dark:text-slate-300">{locality.scores.confidenceScore !== null ? `${locality.scores.confidenceScore}%` : 'Unrated'}</strong></div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => onSelectLocality(locality.id)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onOpenReport(locality)}
                  title="Download Evidence Brief"
                  className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <Bookmark className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Saved Localities Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Browse our Varanasi pilot neighborhoods (Sigra, Lanka, Mahmoorganj) and click "Save Area" on any dashboard to track it here.
          </p>
        </div>
      )}
    </div>
  );
};
