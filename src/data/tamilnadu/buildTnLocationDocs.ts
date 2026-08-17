import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { normalizePlaceName, parseCsv } from '../../utils/csv';
import { TnLocationKind, TnPlaceType } from '../../models/TnLocation.model';

export type TnLocationDoc = {
  key: string;
  kind: TnLocationKind;
  type: TnPlaceType;
  name: string;
  nameTa?: string;
  nameNormalized: string;
  district?: string;
  districtNormalized?: string;
  taluk?: string;
  talukNormalized?: string;
  lgdCode?: string;
  pincode?: string;
  aliases: string[];
};

export type TnSeedStats = {
  districts: number;
  taluks: number;
  places: number;
  villages: number;
  cities: number;
  municipalities: number;
  townPanchayats: number;
  extraUlbPlaces: number;
  ulbMatched: number;
  ulbUnmatched: number;
  postalOffices: number;
  postalMatched: number;
  postalInserted: number;
  uniquePincodes: number;
};

const TYPE_RANK: Record<TnPlaceType, number> = {
  city: 80,
  municipality: 70,
  town: 60,
  town_panchayat: 50,
  census_town: 40,
  panchayat: 30,
  village: 20,
  taluk: 10,
  district: 0,
};

const ULB_TYPE: Record<string, TnPlaceType> = {
  '4': 'city',
  '5': 'municipality',
  '7': 'town_panchayat',
};

function dataDir(): string {
  const candidates = [
    path.resolve(__dirname),
    path.resolve(process.cwd(), 'src/data/tamilnadu'),
    path.resolve(process.cwd(), 'data/tamilnadu'),
  ];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'tamil_nadu_villages.csv.gz')));
  if (!found) {
    throw new Error(`Tamil Nadu seed files not found. Looked in: ${candidates.join(', ')}`);
  }
  return found;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function stripUlbSuffix(name: string): string {
  return name
    .replace(/\b(greater\s+)?(.+?)\s+municipal\s+corporation\b/i, '$2')
    .replace(/\bmunicipal\s+corporation\b/gi, '')
    .replace(/\bmunicipality\b/gi, '')
    .replace(/\b(town|nagar)\s+panchayat\b/gi, '')
    .replace(/\bcorporation\b/gi, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function basePlaceName(nameNormalized: string): string {
  return nameNormalized
    .replace(/\b(north|south|east|west|town|rural|urban|part|bit|rf|r f)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function preferType(current: TnPlaceType, next: TnPlaceType): TnPlaceType {
  return TYPE_RANK[next] > TYPE_RANK[current] ? next : current;
}

function pickTaluk(
  district: string,
  taluksByDistrict: Map<string, { name: string; nameNormalized: string }[]>
): string | undefined {
  const taluks = taluksByDistrict.get(normalizePlaceName(district)) ?? [];
  const hq = taluks.find((t) => t.nameNormalized === normalizePlaceName(district));
  return hq?.name ?? taluks[0]?.name;
}

function cleanPostalOfficeName(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(B\.?\s*O\.?|S\.?\s*O\.?|H\.?\s*O\.?|G\.?\s*P\.?\s*O\.?)\b/gi, ' ')
    .replace(/\b(BO|SO|HO|GPO)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function postalOfficeType(officeType: string): TnPlaceType {
  const t = officeType.replace(/\./g, '').toUpperCase().trim();
  if (t === 'HO' || t === 'GPO') return 'town';
  if (t === 'SO' || t === 'PO') return 'town';
  return 'village';
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length];
}

function uniqueDistrict(matches: TnLocationDoc[]): boolean {
  return new Set(matches.map((m) => m.districtNormalized)).size === 1;
}

export function buildTnLocationDocs(): { docs: TnLocationDoc[]; stats: TnSeedStats } {
  const dir = dataDir();
  const villageCsv = gunzipSync(fs.readFileSync(path.join(dir, 'tamil_nadu_villages.csv.gz'))).toString('utf8');
  const villages = parseCsv(villageCsv);
  const ulbs = parseCsv(fs.readFileSync(path.join(dir, 'urban_local_bodies_tn.csv'), 'utf8'));
  const aliases = readJson<Record<string, string>>(path.join(dir, 'district-aliases.json'));
  const districtsTa = readJson<Record<string, string>>(path.join(dir, 'districts-ta.json'));
  const native = readJson<{
    districts: Record<string, string>;
    mandals: Record<string, string>;
  }>(path.join(dir, 'regions_native.json'));
  const extraCorps = readJson<Array<{ name: string; district: string; type: TnPlaceType }>>(
    path.join(dir, 'extra-corporations.json')
  );

  const docs = new Map<string, TnLocationDoc>();
  const villagesByNorm = new Map<string, TnLocationDoc[]>();
  const taluksByDistrict = new Map<string, { name: string; nameNormalized: string }[]>();
  const taluksByNorm = new Map<string, { district: string; taluk: string }[]>();

  const upsert = (doc: TnLocationDoc): TnLocationDoc => {
    const existing = docs.get(doc.key);
    if (!existing) {
      docs.set(doc.key, doc);
      return doc;
    }
    existing.type = preferType(existing.type, doc.type);
    if (!existing.nameTa && doc.nameTa) existing.nameTa = doc.nameTa;
    if (!existing.pincode && doc.pincode) existing.pincode = doc.pincode;
    for (const alias of doc.aliases) {
      if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
    }
    return existing;
  };

  for (const row of villages) {
    const district = row.District?.trim();
    const taluk = row.Mandal?.trim();
    const name = row.Village?.trim();
    if (!district || !taluk || !name) continue;

    const districtCode = row['District Code']?.trim();
    const talukCode = row['Mandal Code']?.trim();
    const villageCode = row['Village Code']?.trim();
    const districtTa = districtsTa[district] || native.districts[districtCode] || undefined;
    const talukTa = native.mandals[talukCode] || undefined;
    const nameTa = row['Village (Native)']?.trim() || undefined;
    const pincode = row.Pincode?.trim() || undefined;
    const districtNorm = normalizePlaceName(district);
    const talukNorm = normalizePlaceName(taluk);
    const nameNorm = normalizePlaceName(name);

    upsert({
      key: `d:${districtCode || districtNorm}`,
      kind: 'district',
      type: 'district',
      name: district,
      nameTa: districtTa,
      nameNormalized: districtNorm,
      lgdCode: districtCode || undefined,
      aliases: Object.entries(aliases)
        .filter(([, canonical]) => canonical === district)
        .map(([alias]) => alias),
    });

    const talukKey = `t:${talukCode || `${districtNorm}:${talukNorm}`}`;
    upsert({
      key: talukKey,
      kind: 'taluk',
      type: 'taluk',
      name: taluk,
      nameTa: talukTa,
      nameNormalized: talukNorm,
      district,
      districtNormalized: districtNorm,
      lgdCode: talukCode || undefined,
      aliases: [],
    });

    const place: TnLocationDoc = {
      key: `v:${villageCode || `${districtNorm}:${talukNorm}:${nameNorm}`}`,
      kind: 'place',
      type: nameNorm === talukNorm || nameNorm === districtNorm ? 'town' : 'village',
      name,
      nameTa,
      nameNormalized: nameNorm,
      district,
      districtNormalized: districtNorm,
      taluk,
      talukNormalized: talukNorm,
      lgdCode: villageCode || undefined,
      pincode,
      aliases: [],
    };
    upsert(place);
    const bucket = villagesByNorm.get(nameNorm) ?? [];
    bucket.push(place);
    villagesByNorm.set(nameNorm, bucket);
  }

  for (const doc of docs.values()) {
    if (doc.kind !== 'taluk' || !doc.district || !doc.districtNormalized) continue;
    const list = taluksByDistrict.get(doc.districtNormalized) ?? [];
    list.push({ name: doc.name, nameNormalized: doc.nameNormalized });
    taluksByDistrict.set(doc.districtNormalized, list);
    const tBucket = taluksByNorm.get(doc.nameNormalized) ?? [];
    tBucket.push({ district: doc.district, taluk: doc.name });
    taluksByNorm.set(doc.nameNormalized, tBucket);
  }

  let ulbMatched = 0;
  let ulbUnmatched = 0;
  let extraUlbPlaces = 0;

  const attachUlb = (rawName: string, nameTa: string | undefined, type: TnPlaceType, lgdCode?: string, preferredDistrict?: string) => {
    const displayName = stripUlbSuffix(rawName) || rawName;
    const nameNorm = normalizePlaceName(displayName);
    if (!nameNorm) return;

    const preferredDistrictNorm = preferredDistrict ? normalizePlaceName(preferredDistrict) : undefined;
    const scope = (rows: TnLocationDoc[]) =>
      preferredDistrictNorm ? rows.filter((m) => m.districtNormalized === preferredDistrictNorm) : rows;

    let matches = scope(villagesByNorm.get(nameNorm) ?? []);
    let exactName = matches.length > 0;

    if (!matches.length && nameNorm.length >= 5) {
      const base = basePlaceName(nameNorm);
      const loose: TnLocationDoc[] = [];
      for (const [vn, list] of villagesByNorm) {
        if (vn === nameNorm || basePlaceName(vn) === nameNorm || (base && basePlaceName(vn) === base)) {
          loose.push(...list);
        } else if (vn.startsWith(`${nameNorm} `) || nameNorm.startsWith(`${vn} `)) {
          loose.push(...list);
        }
      }
      const scopedLoose = scope(loose);
      if (scopedLoose.length && uniqueDistrict(scopedLoose)) {
        matches = scopedLoose;
      } else if (!scopedLoose.length) {
        const near: TnLocationDoc[] = [];
        for (const [vn, list] of villagesByNorm) {
          if (Math.abs(vn.length - nameNorm.length) > 2) continue;
          if (editDistance(vn, nameNorm) <= 1) near.push(...list);
        }
        const scopedNear = scope(near);
        if (scopedNear.length && uniqueDistrict(scopedNear)) matches = scopedNear;
      }
    }

    if (matches.length > 1) {
      const hq = matches.filter(
        (m) =>
          m.districtNormalized === nameNorm ||
          m.talukNormalized === nameNorm ||
          m.talukNormalized === basePlaceName(nameNorm)
      );
      matches = hq.length ? [hq[0]] : [];
    }

    if (matches.length > 0 && exactName) {
      ulbMatched += 1;
      const match = matches[0];
      match.type = preferType(match.type, type);
      if (nameTa && !match.nameTa) match.nameTa = nameTa;
      const rawNorm = normalizePlaceName(rawName);
      if (rawNorm && rawNorm !== match.nameNormalized && !match.aliases.includes(rawNorm)) {
        match.aliases.push(rawNorm);
      }
      if (nameNorm !== match.nameNormalized && !match.aliases.includes(nameNorm)) {
        match.aliases.push(nameNorm);
      }
      return;
    }

    if (matches.length > 0 && !exactName) {
      const match = matches[0];
      extraUlbPlaces += 1;
      ulbMatched += 1;
      upsert({
        key: `u:${nameNorm}:${match.districtNormalized}:${match.talukNormalized}`,
        kind: 'place',
        type,
        name: displayName,
        nameTa,
        nameNormalized: nameNorm,
        district: match.district,
        districtNormalized: match.districtNormalized,
        taluk: match.taluk,
        talukNormalized: match.talukNormalized,
        lgdCode,
        aliases: rawName !== displayName ? [normalizePlaceName(rawName)] : [],
      });
      return;
    }

    const talukHits = (taluksByNorm.get(nameNorm) ?? []).filter((hit) =>
      preferredDistrictNorm ? normalizePlaceName(hit.district) === preferredDistrictNorm : true
    );
    const resolvedDistrict =
      preferredDistrict ||
      talukHits[0]?.district ||
      [...docs.values()].find((d) => d.kind === 'district' && d.nameNormalized === preferredDistrictNorm)?.name;

    if (!resolvedDistrict) {
      ulbUnmatched += 1;
      return;
    }

    const talukName = talukHits[0]?.taluk || pickTaluk(resolvedDistrict, taluksByDistrict);
    if (!talukName) {
      ulbUnmatched += 1;
      return;
    }

    extraUlbPlaces += 1;
    ulbMatched += 1;
    upsert({
      key: `u:${nameNorm}:${normalizePlaceName(resolvedDistrict)}:${normalizePlaceName(talukName)}`,
      kind: 'place',
      type,
      name: displayName,
      nameTa,
      nameNormalized: nameNorm,
      district: resolvedDistrict,
      districtNormalized: normalizePlaceName(resolvedDistrict),
      taluk: talukName,
      talukNormalized: normalizePlaceName(talukName),
      lgdCode,
      aliases: rawName !== displayName ? [normalizePlaceName(rawName)] : [],
    });
  };

  for (const ulb of ulbs) {
    const type = ULB_TYPE[ulb.typeCode] ?? 'town';
    attachUlb(ulb.name, ulb.nameTa || undefined, type, ulb.lgdCode || undefined);
  }

  for (const corp of extraCorps) {
    attachUlb(corp.name, undefined, corp.type || 'city', undefined, corp.district);
  }

  // India Post directory — every Tamil Nadu pincode / delivery office.
  const postalCsv = gunzipSync(fs.readFileSync(path.join(dir, 'tamil_nadu_pincodes.csv.gz'))).toString('utf8');
  const postalRows = parseCsv(postalCsv);
  const districtNameByNorm = new Map<string, string>();
  for (const doc of docs.values()) {
    if (doc.kind === 'district') districtNameByNorm.set(doc.nameNormalized, doc.name);
  }

  const resolveCanonicalDistrict = (raw: string): string | undefined => {
    const norm = normalizePlaceName(raw);
    if (!norm) return undefined;
    const aliased = aliases[norm] || raw.trim();
    const aliasedNorm = normalizePlaceName(aliased);
    return districtNameByNorm.get(aliasedNorm) || districtNameByNorm.get(norm);
  };

  let postalOffices = 0;
  let postalMatched = 0;
  let postalInserted = 0;
  const pincodeSet = new Set<string>();

  for (const row of postalRows) {
    const pincode = (row.pincode || '').trim();
    const rawOffice = (row.officename || '').trim();
    if (!/^\d{6}$/.test(pincode) || !rawOffice) continue;
    postalOffices += 1;
    pincodeSet.add(pincode);

    const displayName = cleanPostalOfficeName(rawOffice) || rawOffice;
    const nameNorm = normalizePlaceName(displayName);
    if (!nameNorm) continue;

    const districtName = resolveCanonicalDistrict(row.district || '');
    if (!districtName) continue;
    const districtNorm = normalizePlaceName(districtName);

    let talukName: string | undefined;
    const postalTaluk = (row.taluk || '').trim();
    if (postalTaluk) {
      const postalTalukNorm = normalizePlaceName(postalTaluk);
      const districtTaluks = taluksByDistrict.get(districtNorm) ?? [];
      const exact = districtTaluks.find((t) => t.nameNormalized === postalTalukNorm);
      talukName = exact?.name;
      if (!talukName) {
        const loose = districtTaluks.find(
          (t) =>
            t.nameNormalized.startsWith(postalTalukNorm) ||
            postalTalukNorm.startsWith(t.nameNormalized) ||
            editDistance(t.nameNormalized, postalTalukNorm) <= 1
        );
        talukName = loose?.name;
      }
    }

    const scopedMatches = (villagesByNorm.get(nameNorm) ?? []).filter(
      (m) => m.districtNormalized === districtNorm
    );
    let match = scopedMatches.find((m) => !talukName || m.taluk === talukName) || scopedMatches[0];

    if (match) {
      postalMatched += 1;
      if (!match.pincode) {
        match.pincode = pincode;
        const rawNorm = normalizePlaceName(rawOffice);
        if (rawNorm && rawNorm !== match.nameNormalized && !match.aliases.includes(rawNorm)) {
          match.aliases.push(rawNorm);
        }
        continue;
      }
      if (match.pincode === pincode) {
        const rawNorm = normalizePlaceName(rawOffice);
        if (rawNorm && rawNorm !== match.nameNormalized && !match.aliases.includes(rawNorm)) {
          match.aliases.push(rawNorm);
        }
        continue;
      }
      // Same locality, different PIN — keep a dedicated postal row so every PIN is searchable.
      talukName = match.taluk;
    }

    if (!talukName) {
      talukName = pickTaluk(districtName, taluksByDistrict);
    }
    if (!talukName) continue;

    postalInserted += 1;
    upsert({
      key: `p:${pincode}:${districtNorm}:${normalizePlaceName(talukName)}:${nameNorm}`,
      kind: 'place',
      type: postalOfficeType(row.officeType || ''),
      name: displayName,
      nameNormalized: nameNorm,
      district: districtName,
      districtNormalized: districtNorm,
      taluk: talukName,
      talukNormalized: normalizePlaceName(talukName),
      pincode,
      aliases: rawOffice !== displayName ? [normalizePlaceName(rawOffice)] : [],
    });
  }

  // Unique pincodes already present on LGD villages (may include codes missing from postal dump).
  for (const doc of docs.values()) {
    if (doc.kind === 'place' && doc.pincode && /^\d{6}$/.test(doc.pincode)) {
      pincodeSet.add(doc.pincode);
    }
  }

  const all = [...docs.values()];
  const places = all.filter((d) => d.kind === 'place');
  const stats: TnSeedStats = {
    districts: all.filter((d) => d.kind === 'district').length,
    taluks: all.filter((d) => d.kind === 'taluk').length,
    places: places.length,
    villages: places.filter((d) => d.type === 'village').length,
    cities: places.filter((d) => d.type === 'city').length,
    municipalities: places.filter((d) => d.type === 'municipality').length,
    townPanchayats: places.filter((d) => d.type === 'town_panchayat').length,
    extraUlbPlaces,
    ulbMatched,
    ulbUnmatched,
    postalOffices,
    postalMatched,
    postalInserted,
    uniquePincodes: pincodeSet.size,
  };

  return { docs: all, stats };
}
