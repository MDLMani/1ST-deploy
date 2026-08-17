import { TnLocation, TnLocationKind, TnPlaceType } from '../models/TnLocation.model';
import { TnLocationDoc } from '../data/tamilnadu/buildTnLocationDocs';
import { normalizePlaceName } from '../utils/csv';

export type TnLocationRecord = {
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

export class TnLocationRepository {
  async count(): Promise<number> {
    return TnLocation.estimatedDocumentCount().exec();
  }

  async countByKind(): Promise<Record<TnLocationKind, number>> {
    const rows = await TnLocation.aggregate<{ _id: TnLocationKind; n: number }>([
      { $group: { _id: '$kind', n: { $sum: 1 } } },
    ]);
    const out: Record<TnLocationKind, number> = { district: 0, taluk: 0, place: 0 };
    for (const row of rows) out[row._id] = row.n;
    return out;
  }

  async replaceAll(docs: TnLocationDoc[]): Promise<void> {
    const batchSize = 1000;
    await TnLocation.deleteMany({});
    for (let i = 0; i < docs.length; i += batchSize) {
      await TnLocation.insertMany(docs.slice(i, i + batchSize), { ordered: false });
    }
  }

  async listDistricts(): Promise<TnLocationRecord[]> {
    return TnLocation.find({ kind: 'district' }).sort({ name: 1 }).lean<TnLocationRecord[]>().exec();
  }

  async listTaluks(districtNormalized: string): Promise<TnLocationRecord[]> {
    return TnLocation.find({ kind: 'taluk', districtNormalized })
      .sort({ name: 1 })
      .lean<TnLocationRecord[]>()
      .exec();
  }

  async listPlaces(input: {
    districtNormalized: string;
    talukNormalized: string;
    q?: string;
    limit: number;
  }): Promise<TnLocationRecord[]> {
    const filter: Record<string, unknown> = {
      kind: 'place',
      districtNormalized: input.districtNormalized,
      talukNormalized: input.talukNormalized,
    };
    if (input.q) {
      const q = input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { nameTa: { $regex: q, $options: 'i' } },
        { nameNormalized: { $regex: normalizePlaceName(input.q), $options: 'i' } },
        { pincode: { $regex: `^${q}` } },
      ];
    }
    return TnLocation.find(filter).sort({ name: 1 }).limit(input.limit).lean<TnLocationRecord[]>().exec();
  }

  /** Search places by PIN (exact 6-digit or prefix). Prefer selected taluk, then district, then statewide. */
  async findByPincode(input: {
    pincodeQuery: string;
    districtNormalized?: string;
    talukNormalized?: string;
    limit: number;
  }): Promise<TnLocationRecord[]> {
    const q = input.pincodeQuery.trim();
    if (!/^\d{3,6}$/.test(q)) return [];

    const pinFilter =
      q.length === 6 ? { pincode: q } : { pincode: { $regex: `^${q}` } };

    const run = async (scope: Record<string, unknown>) =>
      TnLocation.find({ kind: 'place', ...pinFilter, ...scope })
        .sort({ name: 1 })
        .limit(input.limit)
        .lean<TnLocationRecord[]>()
        .exec();

    if (input.districtNormalized && input.talukNormalized) {
      const local = await run({
        districtNormalized: input.districtNormalized,
        talukNormalized: input.talukNormalized,
      });
      if (local.length > 0) return local;
    }

    if (input.districtNormalized) {
      const districtRows = await run({ districtNormalized: input.districtNormalized });
      if (districtRows.length > 0) return districtRows;
    }

    return run({});
  }

  async countPostalPlaces(): Promise<number> {
    return TnLocation.countDocuments({ key: { $regex: '^p:' } }).exec();
  }

  async countDistinctPincodes(): Promise<number> {
    const rows = await TnLocation.distinct('pincode', {
      kind: 'place',
      pincode: { $exists: true, $nin: [null, ''] },
    }).exec();
    return rows.filter((p) => typeof p === 'string' && /^\d{6}$/.test(p)).length;
  }

  async findDistrict(nameNormalized: string): Promise<TnLocationRecord | null> {
    return TnLocation.findOne({
      kind: 'district',
      $or: [{ nameNormalized }, { aliases: nameNormalized }],
    })
      .lean<TnLocationRecord>()
      .exec();
  }

  async findTaluk(districtNormalized: string, nameNormalized: string): Promise<TnLocationRecord | null> {
    return TnLocation.findOne({
      kind: 'taluk',
      districtNormalized,
      nameNormalized,
    })
      .lean<TnLocationRecord>()
      .exec();
  }

  async findPlace(
    districtNormalized: string,
    talukNormalized: string,
    nameNormalized: string
  ): Promise<TnLocationRecord | null> {
    return TnLocation.findOne({
      kind: 'place',
      districtNormalized,
      talukNormalized,
      $or: [{ nameNormalized }, { aliases: nameNormalized }],
    })
      .lean<TnLocationRecord>()
      .exec();
  }
}

export const tnLocationRepository = new TnLocationRepository();
