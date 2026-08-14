import mongoose, { Document, Schema } from 'mongoose';

export const TN_LOCATION_KINDS = ['district', 'taluk', 'place'] as const;
export type TnLocationKind = (typeof TN_LOCATION_KINDS)[number];

export const TN_PLACE_TYPES = [
  'district',
  'taluk',
  'city',
  'municipality',
  'town',
  'town_panchayat',
  'census_town',
  'village',
  'panchayat',
] as const;
export type TnPlaceType = (typeof TN_PLACE_TYPES)[number];

export interface ITnLocation extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}

const tnLocationSchema = new Schema<ITnLocation>(
  {
    key: { type: String, required: true, unique: true, index: true },
    kind: { type: String, required: true, enum: TN_LOCATION_KINDS, index: true },
    type: { type: String, required: true, enum: TN_PLACE_TYPES, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameTa: { type: String, trim: true, maxlength: 160 },
    nameNormalized: { type: String, required: true, index: true },
    district: { type: String, trim: true, maxlength: 80, index: true },
    districtNormalized: { type: String, index: true },
    taluk: { type: String, trim: true, maxlength: 80, index: true },
    talukNormalized: { type: String, index: true },
    lgdCode: { type: String, trim: true, index: true },
    pincode: { type: String, trim: true, maxlength: 12 },
    aliases: { type: [String], default: [] },
  },
  { timestamps: true }
);

tnLocationSchema.index({ kind: 1, districtNormalized: 1, nameNormalized: 1 });
tnLocationSchema.index({ kind: 1, districtNormalized: 1, talukNormalized: 1, nameNormalized: 1 });
tnLocationSchema.index({ kind: 1, nameNormalized: 1, nameTa: 1 });

export const TnLocation = mongoose.model<ITnLocation>('TnLocation', tnLocationSchema);
