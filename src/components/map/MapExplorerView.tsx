import React, { useState } from 'react';
import { Locality, Facility } from '../../types';
import { InteractiveLocalityMap } from './InteractiveLocalityMap';
import { MapPin, Navigation, Eye, CheckCircle2 } from 'lucide-react';

interface MapExplorerViewProps {
  localities: Locality[];
  selectedLocalityId: string;
  onSelectLocality: (id: string) => void;
}

export const MapExplorerView: React.FC<MapExplorerViewProps> = ({
  localities,
  selectedLocalityId,
  onSelectLocality,
}) => {
  const currentLocality = localities.find((l) => l.id === selectedLocalityId) || localities[0];
  const [inspectedFacility, setInspectedFacility] = useState<Facility | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-emerald-500" />
            Geospatial Intelligence Explorer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Interactive multi-layer GIS inspection of schools, emergency hospitals, transit arteries, and open greens across Varanasi.
          </p>
        </div>

        {/* Locality Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold self-start sm:self-auto">
          {localities.map((loc) => (
            <button
              key={loc.id}
              onClick={() => {
                onSelectLocality(loc.id);
                setInspectedFacility(null);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                loc.id === currentLocality.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map Component */}
      <InteractiveLocalityMap
        center={currentLocality.center}
        bounds={currentLocality.bounds}
        localityName={currentLocality.name}
        facilities={currentLocality.facilities}
        onSelectFacility={(fac) => setInspectedFacility(fac)}
        className="h-[600px] w-full"
      />

      {/* Facility Inspection Drawer / Detail Card */}
      {inspectedFacility ? (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white text-base">
                {inspectedFacility.name}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {inspectedFacility.verificationStatus.replace('_', ' ')}
              </span>
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              {inspectedFacility.subcategory} · {inspectedFacility.address} · {inspectedFacility.distanceMeters} meters from {currentLocality.name} center
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Statutory Source: {inspectedFacility.source} (Verified: {inspectedFacility.lastVerifiedDate})
            </div>
          </div>

          <button
            onClick={() => setInspectedFacility(null)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-400" />
          Click any facility pin or civic warning marker on the map to inspect its verified address, distance, and statutory data source.
        </div>
      )}
    </div>
  );
};
