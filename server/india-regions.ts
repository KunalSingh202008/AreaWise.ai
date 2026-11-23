// State names follow the Government of India list in docs/release-readiness.md.
// Alternate names preserve the spellings found in the GeoNames India snapshots.
const regionAliases: Record<string, string[]> = {
  'Andaman and Nicobar Islands': ['Andaman & Nicobar Islands', 'Union Territory of Andaman and Nicobar Islands'],
  'Andhra Pradesh': ['State of Andhra Pradesh'],
  'Arunachal Pradesh': ['State of Arunāchal Pradesh'],
  Assam: [],
  Bihar: ['State of Bihar'],
  Chandigarh: ['Union Territory of Chandigarh'],
  Chhattisgarh: ['State of Chhattīsgarh'],
  'Dadra and Nagar Haveli and Daman and Diu': [],
  Goa: [],
  Gujarat: ['State of Gujarāt'],
  Haryana: ['State of Haryāna'],
  'Himachal Pradesh': ['State of Himāchal Pradesh'],
  'Jammu and Kashmir': ['Jammu & Kashmir', 'State of Jammu and Kashmīr'],
  Jharkhand: ['State of Jhārkhand'],
  Karnataka: ['State of Karnataka'],
  Kerala: ['State of Kerala'],
  Ladakh: [],
  Lakshadweep: ['Union Territory of Lakshadweep'],
  'Madhya Pradesh': [],
  Maharashtra: ['State of Mahārāshtra'],
  Manipur: [],
  Meghalaya: ['Meghālaya'],
  Mizoram: [],
  Nagaland: ['State of Nāgāland'],
  'National Capital Territory of Delhi': ['Delhi'],
  Odisha: ['State of Odisha'],
  Puducherry: ['Pondicherry', 'Union Territory of Puducherry'],
  Punjab: ['State of Punjab'],
  Rajasthan: ['State of Rājasthān'],
  Sikkim: [],
  'Tamil Nadu': ['State of Tamil Nādu'],
  Telangana: ['State of Telangāna'],
  Tripura: [],
  'Uttar Pradesh': [],
  Uttarakhand: ['State of Uttarākhand'],
  'West Bengal': [],
};

const regionEntries = Object.entries(regionAliases).flatMap(([region, aliases]) =>
  [region, ...aliases].map((sourceName) => [sourceName, region] as const));
const requestedRegions = new Map(regionEntries.map(([name, region]) => [name.normalize('NFC').toLowerCase(), region]));

export function resolveCoverageRegion(name: string) {
  return requestedRegions.get(name.normalize('NFC').toLowerCase());
}

export const regionNamesJson = JSON.stringify(Object.fromEntries(regionEntries));

// These precise postal label corrections follow the official sources cited in the release report.
export const postalRegionCorrectionsJson = JSON.stringify([
  { source_state: 'Jammu & Kashmir', source_district: 'Kargil', region: 'Ladakh' },
  { source_state: 'Jammu & Kashmir', source_district: 'Leh', region: 'Ladakh' },
  { source_state: 'Andhra Pradesh', source_district: 'Peddapalli', region: 'Telangana' },
]);
