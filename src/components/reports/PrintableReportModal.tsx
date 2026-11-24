import { useEffect, useRef } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import type { Locality } from '../../types';
import { PlaceProvenance } from '../geography/PlaceProvenance';

export function PrintableReportModal({ locality, onClose }: { locality: Locality; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  const pathname = `/api/v1/locations/${encodeURIComponent(locality.id)}/report.html`;

  return (
    <dialog ref={dialog} onCancel={onClose}
      className="m-auto max-h-[90vh] w-[min(92vw,46rem)] space-y-4 overflow-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 backdrop:bg-slate-950/60 sm:p-7"
      aria-labelledby="brief-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><FileText className="h-4 w-4" /> Locality evidence brief</p>
          <h1 id="brief-heading" className="mt-1 text-2xl font-extrabold">{locality.name}</h1>
        </div>
        <button aria-label="Close report" onClick={onClose} className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <p className="text-sm">AreaScore <strong>{locality.scores.overallScore ?? 'Withheld'}</strong> · Score evidence coverage {locality.scores.coverageScore}%</p>
      <PlaceProvenance locality={locality} />
      <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
        {locality.missingDataNotes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      {locality.geography ? (
        <a href={pathname} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          target="_blank" rel="noreferrer">
          <Printer className="h-4 w-4" /> Open printable report
        </a>
      ) : <p className="text-xs text-slate-500">Printable briefs are available for catalogue locations.</p>}
    </dialog>
  );
}
