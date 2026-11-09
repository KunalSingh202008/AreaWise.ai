import React, { useState, useEffect } from 'react';
import { CommunityReport, Locality } from '../../types';
import {
  AlertTriangle,
  Plus,
  ThumbsUp,
  Clock,
  CheckCircle2,
  Filter,
  Image,
  MapPin,
  Send,
  X,
} from 'lucide-react';

interface CommunityReportsViewProps {
  localities: Locality[];
  selectedLocalityId?: string;
}

export const CommunityReportsView: React.FC<CommunityReportsViewProps> = ({
  localities,
  selectedLocalityId,
}) => {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [filteredLocality, setFilteredLocality] = useState<string>(selectedLocalityId || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formLocality, setFormLocality] = useState(localities[0]?.id || 'sigra');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CommunityReport['category']>('drainage');
  const [formDescription, setFormDescription] = useState('');
  const [formName, setFormName] = useState('');
  const [formImagePreview, setFormImagePreview] = useState<string>('');

  const fetchReports = async () => {
    try {
      let url = '/api/v1/community/reports';
      const params = new URLSearchParams();
      if (filteredLocality !== 'all') params.append('localityId', filteredLocality);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error('Failed to fetch community reports:', err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filteredLocality, categoryFilter]);

  const handleUpvote = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/community/reports/${id}/vote`, {
        method: 'POST',
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r))
        );
      }
    } catch (err) {
      console.error('Failed to upvote report:', err);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formDescription) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/community/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localityId: formLocality,
          title: formTitle,
          category: formCategory,
          description: formDescription,
          submittedBy: formName || 'Local Resident',
          imageUrl: formImagePreview || undefined,
        }),
      });

      if (res.ok) {
        setIsSubmitModalOpen(false);
        setFormTitle('');
        setFormDescription('');
        setFormImagePreview('');
        fetchReports();
      }
    } catch (err) {
      console.error('Error submitting civic report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'drainage', label: 'Drainage & Waterlogging' },
    { id: 'roads', label: 'Roads & Traffic' },
    { id: 'water_supply', label: 'Piped Water Supply' },
    { id: 'street_lighting', label: 'Street Lighting' },
    { id: 'waste', label: 'Waste Disposal' },
    { id: 'air_noise', label: 'Air & Noise' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Resident Civic Intelligence
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ground-level civic reports verified by neighborhood residents and municipal monitors.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Report Civic Issue
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        {/* Locality Filter */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">Locality:</span>
          <select
            value={filteredLocality}
            onChange={(e) => setFilteredLocality(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <option value="all">All Pilot Localities</option>
            {localities.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div
            key={report.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div>
              {/* Status Header */}
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-500">
                  {report.localityName} · {report.category.replace('_', ' ')}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    report.status === 'action_taken'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : report.status === 'verified'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {report.status === 'action_taken'
                    ? 'Action Taken'
                    : report.status === 'verified'
                    ? 'Verified by Surveyor'
                    : 'Under Review'}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                {report.title}
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed mb-3">
                {report.description}
              </p>

              {/* Optional Photo Attachment */}
              {report.imageUrl && (
                <div className="mb-3 rounded-lg overflow-hidden h-32 w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <img
                    src={report.imageUrl}
                    alt={report.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Official Response Note */}
              {report.officialResponse && (
                <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-900 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Municipal Action Log:
                  </div>
                  <p>{report.officialResponse}</p>
                </div>
              )}
            </div>

            {/* Bottom Meta & Upvoting */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-[140px]">{report.submittedBy}</span>

              <button
                onClick={() => handleUpvote(report.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{report.upvotes} Confirmations</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-xs">
          No civic issues reported under the selected filters.
        </div>
      )}

      {/* Submit Civic Issue Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Submit Civic Issue / Infrastructure Report
              </h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Locality
                </label>
                <select
                  value={formLocality}
                  onChange={(e) => setFormLocality(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  {localities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (PIN {l.pincode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Issue Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="drainage">Drainage & Monsoon Waterlogging</option>
                  <option value="roads">Road Damage, Potholes & Traffic Flow</option>
                  <option value="water_supply">Municipal Water Supply & Pressure</option>
                  <option value="street_lighting">Street Lighting & Safety Visibility</option>
                  <option value="waste">Solid Waste Dumping & Irregular Pickup</option>
                  <option value="air_noise">High Acoustic Noise or Industrial Air Dust</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Silt accumulation causing waterlogging near crossroad"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Detailed Description & Landmark
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe location, severity, duration, and impact on residents..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Your Name / Resident Verification
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alok Verma (Resident, 4 yrs)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Attach Photo Evidence (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
                />
                {formImagePreview && (
                  <div className="mt-2 h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={formImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
