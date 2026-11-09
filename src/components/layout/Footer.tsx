import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="text-base font-bold text-white tracking-tight">
              AreaWise<span className="text-emerald-400">.ai</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Know the Area Before You Own the Address. Independent neighborhood geospatial analytics and decision-support platform for India.
            </p>
            <div className="text-[11px] text-slate-500">
              Pilot Hub: Varanasi, Uttar Pradesh (PIN 221001 – 221010)
            </div>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3">Pilot Localities</h4>
            <ul className="space-y-2">
              <li><span className="hover:text-white transition-colors">Sigra (PIN 221010) - Commercial & Sports</span></li>
              <li><span className="hover:text-white transition-colors">Lanka (PIN 221005) - Academic & Health</span></li>
              <li><span className="hover:text-white transition-colors">Mahmoorganj (PIN 221010) - Residential Prime</span></li>
              <li><span className="text-slate-600">Assi & Godowlia (Phase 2 Ingestion)</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3">Statutory & Open Data Sources</h4>
            <ul className="space-y-2">
              <li>Central Pollution Control Board (CPCB)</li>
              <li>ISRO Bhuvan High-Res Geospatial Portal</li>
              <li>Varanasi Nagar Nigam & Smart City SCADA</li>
              <li>UP Jal Nigam Water Directorate</li>
              <li>OpenStreetMap Contributors (ODbL)</li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3">Methodology & Ethics</h4>
            <p className="text-slate-400 leading-relaxed mb-3">
              AreaWise is strictly not a property broker or listing directory. Scores represent normalized, verifiable civic and geospatial indicators. We never fabricate speculative prices or unverified crime claims.
            </p>
            <div className="text-[11px] text-emerald-400 font-mono">
              Engine Version: v1.2.0-pilot
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
          <div>
            © {new Date().getFullYear()} AreaWise AI Technologies Pvt. Ltd. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Methodology</span>
            <span>·</span>
            <span>Data Transparency</span>
            <span>·</span>
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Open Data Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
