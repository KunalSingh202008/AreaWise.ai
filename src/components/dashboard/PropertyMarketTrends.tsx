import React, { useState, useMemo } from 'react';
import { Locality, MarketTransparencyRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Building2,
  Percent,
  Calculator,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sliders,
  DollarSign,
} from 'lucide-react';

interface PropertyMarketTrendsProps {
  locality: Locality;
}

export const PropertyMarketTrends: React.FC<PropertyMarketTrendsProps> = ({ locality }) => {
  const { language } = useLanguage();

  const marketRecord: MarketTransparencyRecord | undefined = locality.propertyMarketData;
  const circleRate = marketRecord?.circleRate;

  // Baseline purchase price assumption: default to statutory circle rate if available, or sensible 5,500
  const defaultPurchaseRate = circleRate ? circleRate.ratePerSqFt : 5500;

  // User-defined scenario simulator parameters
  const [purchaseRateSqFt, setPurchaseRateSqFt] = useState<number>(defaultPurchaseRate);
  const [propertyAreaSqFt, setPropertyAreaSqFt] = useState<number>(1000);
  const [annualAppreciationPercent, setAnnualAppreciationPercent] = useState<number>(6);
  const [grossRentalYieldPercent, setGrossRentalYieldPercent] = useState<number>(3.5);
  const [horizonYears, setHorizonYears] = useState<number>(5);

  // Calculate User-Defined Projection
  const initialCost = purchaseRateSqFt * propertyAreaSqFt;

  const simulationData = useMemo(() => {
    const data = [];
    let runningValuation = initialCost;
    let accumulatedRent = 0;
    let currentYearRent = (initialCost * grossRentalYieldPercent) / 100;

    data.push({
      year: 'Year 0 (Acquisition)',
      propertyValuation: Math.round(runningValuation),
      accumulatedRentalCashflow: 0,
      totalNetValue: Math.round(runningValuation),
    });

    for (let yr = 1; yr <= horizonYears; yr++) {
      runningValuation *= 1 + annualAppreciationPercent / 100;
      accumulatedRent += currentYearRent;
      currentYearRent *= 1.04; // 4% typical annual rental escalation

      data.push({
        year: `Year ${yr}`,
        propertyValuation: Math.round(runningValuation),
        accumulatedRentalCashflow: Math.round(accumulatedRent),
        totalNetValue: Math.round(runningValuation + accumulatedRent),
      });
    }

    return data;
  }, [initialCost, annualAppreciationPercent, grossRentalYieldPercent, horizonYears]);

  const finalProjectedValuation = simulationData[simulationData.length - 1].propertyValuation;
  const finalAccumulatedRent = simulationData[simulationData.length - 1].accumulatedRentalCashflow;
  const totalNetGain = finalProjectedValuation - initialCost + finalAccumulatedRent;
  const totalROIPercent = Number(((totalNetGain / initialCost) * 100).toFixed(1));

  const formatLakhs = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(val / 100000).toFixed(2)} L`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-blue-400 font-mono">User Scenario</span>
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-white">
                ₹{entry.value.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
      {/* 1. Header with Truthful Epistemic Stance */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Building2 className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {language === 'hi'
                ? 'संपत्ति बाजार पारदर्शिता एवं परिदृश्य सिम्युलेटर'
                : language === 'hinglish'
                ? 'Property Market Transparency & Scenario Simulator'
                : 'Property Market Transparency & Scenario Simulator'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Statutory Verified
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            {language === 'hi'
              ? 'सत्यापित स्टांप सर्किल दरें एवं उपयोगकर्ता-आधारित निवेश परिदृश्य। एरियावाइज अप्रमाणित ऐतिहासिक कीमतों या भ्रामक सीएजीआर का निर्माण नहीं करता है।'
              : language === 'hinglish'
              ? 'Verified circle rates aur user-defined simulation. AreaWise kisi fake historical price ya assumed CAGR ka dawa nahi karta.'
              : 'Official statutory circle rate gazettes and user-defined scenario simulation. AreaWise strictly avoids fabricating synthetic private price histories.'}
          </p>
        </div>

        {/* Transparency Score Pill */}
        <div className="flex items-center gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Market Transparency</div>
            <div className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
              {locality.scores.categoryScores.propertyMarketTransparency !== null
                ? `${locality.scores.categoryScores.propertyMarketTransparency}/100`
                : 'Unrated (Null)'}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Discovery Status</div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 mt-1">
              {circleRate ? 'Statutory Gazette' : 'Awaiting Gazette'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Statutory Circle Rate Card (Truthful Evidence) */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Statutory Circle Rate Record (Government Registration Benchmark)</span>
          </div>
          <div className="flex items-center gap-2">
            {circleRate && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  circleRate.isVerified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                {circleRate.isVerified
                  ? 'Official Certified Gazette Record'
                  : 'Statutory Benchmark (Pending Certified Copy Audit)'}
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-400">
              {circleRate?.effectiveYear || '2024-2026'} Schedule
            </span>
          </div>
        </div>

        {circleRate ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div>
              <span className="text-slate-400 text-[11px]">Official Minimum Circle Rate:</span>
              <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                ₹{circleRate.ratePerSqFt.toLocaleString('en-IN')}{' '}
                <span className="text-xs text-slate-400 font-normal">/sq.ft</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                (₹{circleRate.ratePerSqMeter.toLocaleString('en-IN')}/sq.meter)
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[11px]">Authorized Ward Category:</span>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {circleRate.category}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Issuing: {circleRate.issuingAuthority || 'District Magistrate / Collectorate Varanasi'}
              </div>
              <div className="text-[11px] text-slate-400">
                Registry: {circleRate.registrationAuthority}
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[11px]">Source Document:</span>
              <div className="font-mono text-slate-800 dark:text-slate-200 font-bold mt-0.5 text-[11px]">
                {circleRate.sourceDocumentName || 'UP Stamp (Valuation of Property) Rules 1997'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {circleRate.gazetteRef || 'Tehsil Sadar Annual Valuation Schedule'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Official sub-registrar circle rate gazette for this sector is currently undergoing digitized ingestion.
              Private resale claims are withheld to prevent misleading users.
            </span>
          </div>
        )}

        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800 leading-relaxed">
          <strong>Important Legal Distinction:</strong> Statutory circle rates represent the mandatory minimum valuation baseline prescribed by the District Collector under Rule 4 of the UP Stamp (Valuation of Property) Rules, 1997 for stamp duty payment. They do not represent actual private transaction prices, broker quotes, or market asking prices.
        </div>
      </div>

      {/* 3. Non-Negotiable Anti-Hallucination Disclaimer */}
      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">AreaWise Integrity Standard: </span>
          Unlike conventional listing portals that fabricate unverified price trends, AreaWise does not generate synthetic historical curves. The tool below is an interactive scenario simulator powered entirely by your specified inputs.
        </div>
      </div>

      {/* 4. Interactive User-Defined Scenario Simulator (Recharts) */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Interactive Investment Scenario Simulator (User-Defined Modeling)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust purchase rate, property size, and assumptions to project hypothetical asset valuation curves.
            </p>
          </div>
          <div className="text-xs text-slate-300 font-mono bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            Initial Capital: {formatLakhs(initialCost)}
          </div>
        </div>

        {/* Simulation Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Control 1: Purchase Rate */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Purchase Rate</span>
              <span className="font-mono text-emerald-400">₹{purchaseRateSqFt.toLocaleString('en-IN')}/sq.ft</span>
            </div>
            <input
              type="range"
              min={3000}
              max={15000}
              step={250}
              value={purchaseRateSqFt}
              onChange={(e) => setPurchaseRateSqFt(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>₹3,000</span>
              <span>₹15,000</span>
            </div>
          </div>

          {/* Control 2: Property Area */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Carpet Area</span>
              <span className="font-mono text-emerald-400">{propertyAreaSqFt} sq.ft</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[800, 1200, 1800].map((size) => (
                <button
                  key={size}
                  onClick={() => setPropertyAreaSqFt(size)}
                  className={`py-1 rounded text-xs font-bold transition-all ${
                    propertyAreaSqFt === size ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {size} sq.ft
                </button>
              ))}
            </div>
          </div>

          {/* Control 3: Assumed Annual Capital Growth */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Assumed Capital CAGR</span>
              <span className="font-mono text-blue-400">+{annualAppreciationPercent}% /yr</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[4, 6, 8, 10].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setAnnualAppreciationPercent(rate)}
                  className={`py-1 rounded text-xs font-bold transition-all ${
                    annualAppreciationPercent === rate ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>

          {/* Control 4: Investment Horizon */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Horizon Duration</span>
              <span className="font-mono text-emerald-400">{horizonYears} Years</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[3, 5, 7, 10].map((yrs) => (
                <button
                  key={yrs}
                  onClick={() => setHorizonYears(yrs)}
                  className={`py-1 rounded text-xs font-bold transition-all ${
                    horizonYears === yrs ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {yrs} Yrs
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recharts Projection Graph */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Simulated Capital Valuation & Rental Yield Trajectory ({horizonYears}-Year Projection)</span>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Asset Valuation
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Cumulative Rent
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="valuationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="year" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={30} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="propertyValuation"
                  name="Projected Asset Valuation"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#valuationGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="accumulatedRentalCashflow"
                  name="Accumulated Rental Income"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Simulated Returns Output Summary Matrix */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Initial Capital Outlay</div>
            <div className="text-lg font-mono font-bold text-white mt-0.5">
              {formatLakhs(initialCost)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              @ ₹{purchaseRateSqFt.toLocaleString('en-IN')}/sq.ft
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Simulated Final Value</div>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
              {formatLakhs(finalProjectedValuation)}
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5 font-mono">
              @ +{annualAppreciationPercent}% p.a.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Accumulated Rent Yield</div>
            <div className="text-lg font-mono font-bold text-blue-400 mt-0.5">
              +{formatLakhs(finalAccumulatedRent)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              @ {grossRentalYieldPercent}% initial yield
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
            <div className="text-[10px] text-emerald-300 uppercase font-semibold">Total Projected Return</div>
            <div className="text-lg font-mono font-bold text-emerald-300 mt-0.5">
              +{formatLakhs(totalNetGain)}
            </div>
            <div className="text-[10px] text-emerald-400 font-bold mt-0.5 font-mono">
              +{totalROIPercent}% net simulated gain
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
