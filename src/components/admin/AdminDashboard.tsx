import React, { useState, useEffect } from 'react';
import { DataSourceStatus, Locality, CommunityReport } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Sliders,
  FileSpreadsheet,
  Activity,
  History,
  Shield,
  RotateCcw,
} from 'lucide-react';

interface AdminDashboardProps {
  localities: Locality[];
  onRefreshData?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ localities, onRefreshData }) => {
  const { user, switchRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'weights' | 'import' | 'moderation' | 'sources' | 'logs'>('weights');

  // Weights Config
  const [weights, setWeights] = useState({
    connectivity: 0.20,
    healthcare: 0.10,
    education: 0.10,
    environment: 0.20,
    civicInfrastructure: 0.20,
    dailyAmenities: 0.10,
    propertyMarketTransparency: 0.10,
  });
  const [isUpdatingWeights, setIsUpdatingWeights] = useState(false);
  const [weightSuccessMsg, setWeightSuccessMsg] = useState('');

  // Data Sources
  const [sources, setSources] = useState<DataSourceStatus[]>([]);

  // Moderation Reports
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [moderationNote, setModerationNote] = useState<Record<string, string>>({});

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // CSV Import Simulator State
  const [importLocality, setImportLocality] = useState(localities[0]?.id || 'sigra');
  const [importCategory, setImportCategory] = useState('civic');
  const [csvContent, setCsvContent] = useState(
    `name,lat,lng,subcategory,address
"Sigra Smart Municipal Dispensary",25.3188,82.9862,"Public Health Post","Lane 2, Sigra"
"Vidyapeeth Metro Feeder Terminal",25.3155,82.9820,"Transit Stop","Station Link Road"
"Mahmoorganj Green Community Kiosk",25.3082,82.9798,"Civic Help Desk","Colony Gate 1"`
  );
  const [importResult, setImportResult] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    // Fetch weights
    fetch('/api/v1/admin/scoring-weights')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') setWeights(data);
      })
      .catch(console.error);

    // Fetch data sources
    fetch('/api/v1/admin/data-sources')
      .then((res) => res.json())
      .then((data) => setSources(data || []))
      .catch(console.error);

    // Fetch reports for moderation
    fetch('/api/v1/community/reports')
      .then((res) => res.json())
      .then((data) => setReports(data.reports || []))
      .catch(console.error);

    // Fetch audit logs
    fetch('/api/v1/admin/audit-logs')
      .then((res) => res.json())
      .then((data) => setAuditLogs(data || []))
      .catch(console.error);
  }, []);

  const handleWeightChange = (key: keyof typeof weights, value: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveWeights = async () => {
    setIsUpdatingWeights(true);
    setWeightSuccessMsg('');
    try {
      const res = await fetch('/api/v1/admin/scoring-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      });
      const data = await res.json();
      if (res.ok) {
        setWeights(data.weights);
        setWeightSuccessMsg(`Recalculated scores across all ${data.recalculatedCount} localities!`);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Failed to update scoring weights:', err);
    } finally {
      setIsUpdatingWeights(false);
    }
  };

  const handleModerateReport = async (reportId: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/community/reports/${reportId}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          officialResponse: moderationNote[reportId] || 'Reviewed and recorded in municipal civic register.',
          moderator: user?.name || 'Senior Civic Auditor',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      }
    } catch (err) {
      console.error('Failed to moderate report:', err);
    }
  };

  const handleImportCsv = async () => {
    setIsImporting(true);
    setImportResult(null);

    // Parse CSV lines
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      setImportResult({ error: 'Please provide CSV header and at least one record row.' });
      setIsImporting(false);
      return;
    }

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 3) {
        records.push({
          name: parts[0],
          lat: parseFloat(parts[1]),
          lng: parseFloat(parts[2]),
          subcategory: parts[3] || 'Civic Infrastructure',
          address: parts[4] || 'Varanasi',
        });
      }
    }

    try {
      const res = await fetch('/api/v1/admin/import-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localityId: importLocality,
          category: importCategory,
          records,
          sourceName: 'Admin CSV Ingestion Batch',
        }),
      });
      const data = await res.json();
      setImportResult(data);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('CSV Import failed:', err);
      setImportResult({ error: 'Failed to import CSV dataset.' });
    } finally {
      setIsImporting(false);
    }
  };

  const totalWeightPercent = Math.round(
    Object.values(weights).reduce((a, b) => a + b, 0) * 100
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            Administrative Operations & Data Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            AreaWise System Administration
          </h1>
        </div>

        {/* User Role Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg text-xs">
          <span className="text-slate-500 font-medium pl-1">Role:</span>
          {(['citizen', 'student', 'consultant', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => switchRole(r)}
              className={`px-2.5 py-1 rounded font-semibold capitalize transition-colors ${
                user?.role === r
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs overflow-x-auto pb-1">
        {[
          { id: 'weights', label: 'Scoring Weight Config', icon: Sliders },
          { id: 'import', label: 'Dataset CSV Ingestion', icon: FileSpreadsheet },
          { id: 'moderation', label: 'Community Moderation', icon: AlertCircle },
          { id: 'sources', label: 'Data Source Health', icon: Activity },
          { id: 'logs', label: 'Audit Log Trail', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-bold whitespace-nowrap rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Scoring Weights Configuration */}
      {activeTab === 'weights' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                AreaScore Multi-Category Weight Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjust category weights. When saved, weights are normalized to sum to 1.0 (100%) and all localities are recalibrated.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                totalWeightPercent === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                Current Sum: {totalWeightPercent}%
              </span>
              <button
                onClick={handleSaveWeights}
                disabled={isUpdatingWeights}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-xs"
              >
                {isUpdatingWeights ? 'Recalibrating...' : 'Save & Recalibrate Engine'}
              </button>
            </div>
          </div>

          {weightSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {weightSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(
              [
                ['connectivity', 'Connectivity & Transit', '20% baseline'],
                ['healthcare', 'Healthcare Accessibility', '10% baseline'],
                ['education', 'Education Access', '10% baseline'],
                ['environment', 'Environmental Intelligence', '20% baseline'],
                ['civicInfrastructure', 'Civic Infrastructure', '20% baseline'],
                ['dailyAmenities', 'Daily Amenities', '10% baseline'],
                ['propertyMarketTransparency', 'Property Market Transparency', '10% baseline'],
              ] as const
            ).map(([key, label, desc]) => (
              <div key={key} className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{label}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {Math.round((weights as any)[key] * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.40"
                  step="0.01"
                  value={(weights as any)[key]}
                  onChange={(e) => handleWeightChange(key as any, parseFloat(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="text-[10px] text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Dataset CSV Ingestion */}
      {activeTab === 'import' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 text-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Batch Facility Ingestion & Coordinate Validation
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Upload or paste CSV rows containing POI names, coordinates, and categories. The validator deduplicates names and validates bounding box coordinates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Target Pilot Locality
              </label>
              <select
                value={importLocality}
                onChange={(e) => setImportLocality(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
              >
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                Default Layer Category
              </label>
              <select
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
              >
                <option value="civic">Civic Infrastructure</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="transport">Transit</option>
                <option value="parks">Parks & Greenery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
              CSV Text Payload (Format: name, lat, lng, subcategory, address)
            </label>
            <textarea
              rows={5}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full font-mono text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
            />
          </div>

          <button
            onClick={handleImportCsv}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white font-bold transition-colors flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            {isImporting ? 'Validating & Importing...' : 'Validate & Import Batch'}
          </button>

          {importResult && (
            <div className={`p-4 rounded-xl border text-xs ${
              importResult.success ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              {importResult.success ? (
                <div>
                  <div className="font-bold">Successfully Ingested {importResult.importedFacilities} Points!</div>
                  <div className="text-[11px] mt-1">Skipped {importResult.skippedDuplicates} duplicates · Locality facility count: {importResult.currentFacilityTotal}</div>
                </div>
              ) : (
                <div className="font-bold">{importResult.error || 'Import failed'}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Community Moderation */}
      {activeTab === 'moderation' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Civic Report Moderation Queue ({reports.length} submissions)
          </h2>

          <div className="space-y-4">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm mr-2">{rep.title}</span>
                    <span className="text-slate-500">in {rep.localityName} ({rep.category})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white dark:bg-slate-800 border">
                    Status: {rep.status}
                  </span>
                </div>

                <p className="text-slate-600 dark:text-slate-400">{rep.description}</p>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter official resolution or verification note..."
                    value={moderationNote[rep.id] || ''}
                    onChange={(e) => setModerationNote({ ...moderationNote, [rep.id]: e.target.value })}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleModerateReport(rep.id, 'verified')}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleModerateReport(rep.id, 'action_taken')}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      Action Taken
                    </button>
                    <button
                      onClick={() => handleModerateReport(rep.id, 'rejected')}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Data Sources */}
      {activeTab === 'sources' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Connected Open Data & Statutory Sensor Sources
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sources.map((src) => (
              <div
                key={src.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white">{src.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    {src.status}
                  </span>
                </div>
                <div className="text-slate-500">{src.category} · {src.coverage}</div>
                <div className="text-[11px] font-mono text-slate-400">Sync: {src.lastSync}</div>
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{src.reliabilityTier}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Audit Logs */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            System & Modification Audit Logs
          </h2>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{log.action}</div>
                  <div className="text-slate-500">{log.details}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-slate-400 font-mono text-[11px]">{log.actor}</div>
                  <div className="text-slate-400 font-mono text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
