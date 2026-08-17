import { buildTnLocationDocs, TnSeedStats } from '../data/tamilnadu/buildTnLocationDocs';
import { tnLocationRepository, TnLocationRecord } from '../repositories/tnLocation.repository';
import { normalizePlaceName } from '../utils/csv';
import { isServerlessRuntime } from '../config/runtime';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import districtAliases from '../data/tamilnadu/district-aliases.json';

const EXPECTED_MIN_DOCS = 16000;
const EXPECTED_MIN_PINCODES = 2000;
const EXPECTED_MIN_POSTAL_PLACES = 500;

type DistrictAliasMap = Record<string, string>;

let aliasMap: DistrictAliasMap | null = null;
let seedPromise: Promise<TnSeedStats> | null = null;

function loadAliasMap(): DistrictAliasMap {
  if (aliasMap) return aliasMap;
  aliasMap = districtAliases as DistrictAliasMap;
  return aliasMap;
}

function canonicalDistrictInput(raw: string): string {
  const aliases = loadAliasMap();
  const norm = normalizePlaceName(raw);
  return aliases[norm] || raw.trim();
}

function toDistrictDto(row: TnLocationRecord) {
  return { name: row.name, nameTa: row.nameTa || undefined };
}

function toTalukDto(row: TnLocationRecord) {
  return {
    name: row.name,
    nameTa: row.nameTa || undefined,
    district: row.district || '',
  };
}

function toPlaceDto(row: TnLocationRecord) {
  return {
    name: row.name,
    nameTa: row.nameTa || undefined,
    type: row.type,
    pincode: row.pincode || undefined,
    district: row.district || '',
    taluk: row.taluk || '',
  };
}

export class LocationService {
  async seed(options: { force?: boolean } = {}): Promise<TnSeedStats & { inserted: number }> {
    const existing = await tnLocationRepository.count();
    const postalPlaces = existing > 0 ? await tnLocationRepository.countPostalPlaces() : 0;
    const distinctPins = existing > 0 ? await tnLocationRepository.countDistinctPincodes() : 0;
    if (
      !options.force &&
      (isServerlessRuntime() ||
        (existing >= EXPECTED_MIN_DOCS &&
          postalPlaces >= EXPECTED_MIN_POSTAL_PLACES &&
          distinctPins >= EXPECTED_MIN_PINCODES))
    ) {
      const counts = await tnLocationRepository.countByKind();
      return {
        districts: counts.district,
        taluks: counts.taluk,
        places: counts.place,
        villages: 0,
        cities: 0,
        municipalities: 0,
        townPanchayats: 0,
        extraUlbPlaces: 0,
        ulbMatched: 0,
        ulbUnmatched: 0,
        postalOffices: 0,
        postalMatched: 0,
        postalInserted: postalPlaces,
        uniquePincodes: distinctPins,
        inserted: existing,
      };
    }

    const { docs, stats } = buildTnLocationDocs();
    await tnLocationRepository.replaceAll(docs);
    logger.info('Tamil Nadu locations seeded', { ...stats, inserted: docs.length });
    return { ...stats, inserted: docs.length };
  }

  async ensureSeeded(): Promise<void> {
    if (!seedPromise) {
      seedPromise = this.seed().catch((error) => {
        seedPromise = null;
        throw error;
      });
    }
    await seedPromise;
  }

  async listDistricts() {
    await this.ensureSeeded();
    const rows = await tnLocationRepository.listDistricts();
    return rows.map(toDistrictDto);
  }

  async listTaluks(districtRaw: string) {
    await this.ensureSeeded();
    const district = await this.requireDistrict(districtRaw);
    const rows = await tnLocationRepository.listTaluks(district.nameNormalized);
    return rows.map(toTalukDto);
  }

  async listPlaces(input: { district: string; taluk: string; q?: string; limit?: number }) {
    await this.ensureSeeded();
    const district = await this.requireDistrict(input.district);
    const taluk = await this.requireTaluk(district.nameNormalized, input.taluk, district.name);
    const limit = Math.min(Math.max(input.limit ?? 400, 1), 1000);
    const q = input.q?.trim() || undefined;
    const rank: Record<string, number> = {
      city: 0,
      municipality: 1,
      town: 2,
      town_panchayat: 3,
      census_town: 4,
      panchayat: 5,
      village: 6,
    };

    const rows =
      q && /^\d{3,6}$/.test(q)
        ? await tnLocationRepository.findByPincode({
            pincodeQuery: q,
            districtNormalized: district.nameNormalized,
            talukNormalized: taluk.nameNormalized,
            limit,
          })
        : await tnLocationRepository.listPlaces({
            districtNormalized: district.nameNormalized,
            talukNormalized: taluk.nameNormalized,
            q,
            limit,
          });

    return [...rows]
      .sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || a.name.localeCompare(b.name))
      .map(toPlaceDto);
  }

  async resolvePosting(districtRaw: string, talukRaw: string, cityRaw: string) {
    await this.ensureSeeded();
    const district = await this.requireDistrict(districtRaw);
    const taluk = await this.requireTaluk(district.nameNormalized, talukRaw, district.name);
    const place = await tnLocationRepository.findPlace(
      district.nameNormalized,
      taluk.nameNormalized,
      normalizePlaceName(cityRaw)
    );
    if (!place) {
      throw new ApiError(400, `Unknown city / village / town "${cityRaw.trim()}" in ${taluk.name}, ${district.name}`);
    }
    return {
      district: district.name,
      taluk: taluk.name,
      city: place.name,
    };
  }

  private async requireDistrict(raw: string) {
    const canonical = canonicalDistrictInput(raw);
    const district = await tnLocationRepository.findDistrict(normalizePlaceName(canonical));
    if (!district) {
      throw new ApiError(400, `Unknown Tamil Nadu district "${raw.trim()}"`);
    }
    return district;
  }

  private async requireTaluk(districtNormalized: string, raw: string, districtName: string) {
    const taluk = await tnLocationRepository.findTaluk(districtNormalized, normalizePlaceName(raw));
    if (!taluk) {
      throw new ApiError(400, `Unknown taluk "${raw.trim()}" in ${districtName}`);
    }
    return taluk;
  }
}

export const locationService = new LocationService();
