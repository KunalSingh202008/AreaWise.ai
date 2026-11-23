export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900 px-5 py-8 text-xs text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">AreaWise<span className="text-emerald-400">.ai</span></p>
          <p>Independent locality research for India</p>
        </div>
        <ul className="flex flex-wrap gap-4">
          <li><a href="https://www.geonames.org/" className="underline" target="_blank" rel="noreferrer">GeoNames</a></li>
          <li><a href="https://creativecommons.org/licenses/by/4.0/" className="underline" target="_blank" rel="noreferrer">CC BY 4.0</a></li>
          <li><a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noreferrer">OpenStreetMap</a></li>
        </ul>
      </div>
    </footer>
  );
}
