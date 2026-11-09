import React from 'react';
import { Locality } from '../../types';
import { Printer, X, Download, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PrintableReportModalProps {
  locality: Locality;
  onClose: () => void;
}

export const PrintableReportModal: React.FC<PrintableReportModalProps> = ({ locality, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto print:p-0 print:max-h-none print:shadow-none print:rounded-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            Official Locality Intelligence Brief
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Header */}
        <div className="space-y-3 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">
                AreaWise<span className="text-emerald-600">.ai</span>
              </div>
              <div className="text-xs text-slate-500">
                Independent Neighborhood Intelligence & Decision Support Platform
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-bold text-slate-800">Intelligence Dossier #{locality.id.toUpperCase()}-2026</div>
              <div className="text-slate-500">Generated: {new Date().toLocaleDateString()}</div>
              <div className="font-mono text-[10px] text-emerald-700 font-bold">Methodology: {locality.scores.methodologyVersion}</div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">{locality.name}</h1>
              <p className="text-sm font-medium text-slate-600">
                {locality.city}, {locality.state} · PIN {locality.pincode} · Coordinates: {locality.center.lat.toFixed(4)}°N, {locality.center.lng.toFixed(4)}°E
              </p>
            </div>
            <div className="flex items-baseline gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-3xl font-black font-mono text-slate-900">{locality.scores.overallScore}</span>
              <span className="text-xs text-slate-500 font-bold">/ 100 AreaScore</span>
            </div>
          </div>
        </div>

        {/* Data Reliability & Profile Summary */}
        <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <div className="text-slate-500 font-semibold">Data Coverage</div>
            <div className="text-base font-bold font-mono text-slate-900">{locality.scores.coverageScore}%</div>
            <div className="text-[10px] text-slate-400">22 of 24 indicators</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold">Data Confidence</div>
            <div className="text-base font-bold font-mono text-slate-900">{locality.scores.confidenceScore}%</div>
            <div className="text-[10px] text-slate-400">Statutory & SCADA tier</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold">FamilyScore Profile</div>
            <div className="text-base font-bold font-mono text-emerald-700">{locality.profileScores.familyScore} / 100</div>
            <div className="text-[10px] text-slate-400">Edu & Health weighted</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold">StudentScore Profile</div>
            <div className="text-base font-bold font-mono text-blue-700">{locality.profileScores.studentScore} / 100</div>
            <div className="text-[10px] text-slate-400">Campus & Transit weighted</div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
          <h3 className="font-bold text-slate-900 text-sm">Executive Overview</h3>
          <p>{locality.description}</p>
        </div>

        {/* Key Strengths & Cautions */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-1.5">
            <div className="font-bold text-emerald-900 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Key Strengths
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {locality.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 space-y-1.5">
            <div className="font-bold text-amber-900 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Documented Bottlenecks & Cautions
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {locality.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Category Indicators & Quantitative Observations */}
        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">Category Indicators & Underlying Metrics</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Category Module</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Key Metric Observed</th>
                  <th className="px-3 py-2">Statutory Source</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locality.indicators.map((ind) => (
                  <tr key={ind.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{ind.name}</td>
                    <td className="px-3 py-2 font-mono font-bold">{ind.score}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {ind.metrics[0]?.label}: <strong>{ind.metrics[0]?.value} {ind.metrics[0]?.unit || ''}</strong>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{ind.sources[0]?.organization || ind.sources[0]?.name}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{ind.metrics[0]?.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Missing Data Disclosure */}
        {locality.missingDataNotes.length > 0 && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-800">Disclosure of Limitations: </span>
            {locality.missingDataNotes.join(' ')}
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center space-y-1">
          <div>AreaWise AI · Independent Locality Research and Decision-Support Platform</div>
          <div>This brief is prepared using open data, official registries, and satellite records. Not intended as real estate brokerage advice.</div>
        </div>
      </div>
    </div>
  );
};
