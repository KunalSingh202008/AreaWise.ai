import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Facility, Coordinates, CommunityReport } from '../../types';
import { Layers, Crosshair, Filter } from 'lucide-react';

interface InteractiveLocalityMapProps {
  center: Coordinates;
  bounds?: [number, number][];
  localityName: string;
  facilities: Facility[];
  communityReports?: CommunityReport[];
  selectedCategory?: string;
  onSelectFacility?: (facility: Facility) => void;
  className?: string;
}

export const InteractiveLocalityMap: React.FC<InteractiveLocalityMapProps> = ({
  center,
  bounds,
  localityName,
  facilities,
  communityReports = [],
  selectedCategory: initialCategory = 'all',
  onSelectFacility,
  className = 'h-[460px] w-full',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [selectedRadius, setSelectedRadius] = useState<number>(2000); // 2km radius circle
  const [showReports, setShowReports] = useState<boolean>(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: 15,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Standard OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update center, bounds, polygon when locality changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([center.lat, center.lng], 15, { animate: true });

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
    }

    if (bounds && bounds.length > 2) {
      const polygon = L.polygon(bounds, {
        color: '#059669', // Emerald
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.12,
        dashArray: '4, 6',
      }).addTo(map);
      polygonLayerRef.current = polygon;
    }
  }, [center, bounds]);

  // Update Markers based on Category, Radius, and Reports
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // Locality Center Anchor Marker
    const centerIcon = L.divIcon({
      className: 'custom-center-marker',
      html: `
        <div style="background-color: #0f172a; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 2px solid #10b981; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
          ${localityName} Center
        </div>
      `,
      iconSize: [120, 30],
      iconAnchor: [60, 15],
    });

    L.marker([center.lat, center.lng], { icon: centerIcon })
      .bindPopup(`<strong>${localityName} Geographic Center</strong><br/>Lat: ${center.lat.toFixed(4)}, Lng: ${center.lng.toFixed(4)}`)
      .addTo(markersGroup);

    // Filter facilities
    const filtered = facilities.filter((f) => {
      if (activeCategory !== 'all' && f.category !== activeCategory) return false;
      return f.distanceMeters <= selectedRadius;
    });

    const categoryColors: Record<string, string> = {
      healthcare: '#e11d48', // rose
      education: '#2563eb', // blue
      transport: '#d97706', // amber
      shopping: '#7c3aed', // purple
      parks: '#059669', // emerald
      civic: '#0891b2', // cyan
      environment: '#16a34a', // green
    };

    filtered.forEach((facility) => {
      const color = categoryColors[facility.category] || '#475569';
      const icon = L.divIcon({
        className: 'facility-marker',
        html: `
          <div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([facility.lat, facility.lng], { icon });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; max-width: 220px;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${facility.name}</div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">${facility.subcategory} · ${facility.distanceMeters}m away</div>
          <div style="font-size: 11px; color: #334155; margin-bottom: 6px;">${facility.address}</div>
          <div style="padding: 2px 6px; background: #f1f5f9; border-radius: 4px; font-size: 10px; color: #475569;">
            Source: ${facility.source}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        if (onSelectFacility) onSelectFacility(facility);
      });

      marker.addTo(markersGroup);
    });

    // Add Community Reports if enabled
    if (showReports && communityReports.length > 0) {
      communityReports.forEach((report) => {
        const reportIcon = L.divIcon({
          className: 'report-marker',
          html: `
            <div style="background-color: #f43f5e; width: 20px; height: 20px; transform: rotate(45deg); border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
              <span style="transform: rotate(-45deg); color: white; font-size: 9px; font-weight: bold;">!</span>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([report.lat, report.lng], { icon: reportIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; max-width: 220px;">
            <div style="font-weight: 700; color: #9f1239; margin-bottom: 2px;">Civic Report: ${report.category}</div>
            <div style="font-weight: 600; color: #0f172a; font-size: 11px;">${report.title}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 4px;">Status: <strong>${report.status.replace('_', ' ')}</strong></div>
            <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">${report.upvotes} resident confirmations</div>
          </div>
        `);
        marker.addTo(markersGroup);
      });
    }
  }, [facilities, activeCategory, selectedRadius, showReports, center, localityName, communityReports, onSelectFacility]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
      {/* Map Filter Controls Bar */}
      <div className="p-3 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Layers' },
            { id: 'healthcare', label: 'Healthcare' },
            { id: 'education', label: 'Education' },
            { id: 'transport', label: 'Transit' },
            { id: 'parks', label: 'Parks & Sports' },
            { id: 'shopping', label: 'Shopping' },
            { id: 'civic', label: 'Civic' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Radius Selector */}
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Crosshair className="w-3.5 h-3.5" />
            <span>Radius:</span>
            <select
              value={selectedRadius}
              onChange={(e) => setSelectedRadius(Number(e.target.value))}
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
            >
              <option value={500}>500m</option>
              <option value={1000}>1.0 km</option>
              <option value={2000}>2.0 km</option>
              <option value={5000}>5.0 km</option>
            </select>
          </div>

          {/* Civic Issues Toggle */}
          <button
            onClick={() => setShowReports(!showReports)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              showReports
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3 h-3" />
            Civic Issues ({communityReports.length})
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className={className} />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] shadow-sm flex items-center gap-3 text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Health
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> Edu
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Transit
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Parks
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rotate-45 bg-rose-500 inline-block"></span> Civic Issue
        </span>
      </div>
    </div>
  );
};
