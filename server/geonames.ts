import { createHash } from 'node:crypto';
import type { FacilityCategory } from '../src/types';

export const GEONAMES_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
export const GEONAMES_DATASETS = {
  gazetteer: {
    id: 'geonames-in',
    title: 'GeoNames India gazetteer',
    url: 'https://download.geonames.org/export/dump/IN.zip',
    documentation: 'https://download.geonames.org/export/dump/readme.txt',
  },
  postal: {
    id: 'geonames-in-postal',
    title: 'GeoNames India postal code index',
    url: 'https://download.geonames.org/export/zip/IN.zip',
    documentation: 'https://download.geonames.org/export/zip/readme.txt',
  },
} as const;

export type GeoDataset = keyof typeof GEONAMES_DATASETS;

const facilityCategories: Record<string, FacilityCategory> = {
  HSP: 'healthcare', HSPC: 'healthcare',
  SCH: 'education', SCHC: 'education', UNIV: 'education',
  RSTN: 'transport', RSTP: 'transport',
  PRK: 'parks', MALL: 'shopping', MKT: 'shopping',
};

export interface ImportPlace {
  id: string;
  name: string;
  search: string;
  state: string | null;
  district: string | null;
  pincode: string | null;
  feature: string;
  category: FacilityCategory | null;
  lat: number;
  lng: number;
  population: number;
  modified: string | null;
}

interface AdminNames {
  states: Map<string, string>;
  districts: Map<string, string>;
}

export function indexAdminName(line: string, names: AdminNames) {
  const fields = line.split('\t');
  if (fields.length !== 19 || fields[8] !== 'IN' || !fields[1] || !fields[10]) return;
  if (fields[7] === 'ADM1') names.states.set(fields[10], fields[1]);
  if (fields[7] === 'ADM2' && fields[11]) names.districts.set(`${fields[10]}.${fields[11]}`, fields[1]);
}

function coordinates(lat: string, lng: string) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { lat: latitude, lng: longitude };
}

function searchText(...fields: (string | null)[]) {
  return fields.filter(Boolean).join(' ').normalize('NFKC').toLowerCase().slice(0, 1500);
}

export function parseGeoNamesRow(line: string, dataset: GeoDataset, names: AdminNames): ImportPlace | null {
  const fields = line.split('\t');
  if (dataset === 'postal') {
    if (fields.length !== 12 || fields[0] !== 'IN' || !/^[1-9]\d{5}$/.test(fields[1]) || !fields[2]) return null;
    const [, pincode, name, state, , district, , , , lat, lng] = fields;
    const point = coordinates(lat, lng);
    if (!point) return null;
    const key = createHash('sha256').update([pincode, name, state, district, fields[8]].join('\t')).digest('hex').slice(0, 24);
    return {
      id: `pin-${key}`, name, state: state || null, district: district || null, pincode,
      search: searchText(name, state, district, pincode), feature: 'POSTAL',
      category: null, population: 0, modified: null, ...point,
    };
  }

  const [id, name, ascii, aliases, lat, lng, kind, feature, country, , stateCode, districtCode, , , population, , , , modified] = fields;
  if (fields.length !== 19 || country !== 'IN' || !/^\d{1,12}$/.test(id) || !name ||
      !/^\d{4}-\d{2}-\d{2}$/.test(modified)) return null;
  const category = facilityCategories[feature] ?? null;
  if (!category && kind !== 'P' && !(kind === 'A' && /^ADM[1-5]$/.test(feature))) return null;
  const point = coordinates(lat, lng);
  if (!point) return null;
  const state = names.states.get(stateCode) ?? null;
  const district = names.districts.get(`${stateCode}.${districtCode}`) ?? null;
  return {
    id: `geo-${id}`, name, state, district, pincode: null,
    search: searchText(name, ascii, aliases.replaceAll(',', ' '), state, district),
    feature, category, population: /^\d{1,12}$/.test(population) ? Number(population) : 0,
    modified, ...point,
  };
}
