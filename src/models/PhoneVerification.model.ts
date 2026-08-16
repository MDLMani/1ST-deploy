import mongoose, { Document, Schema } from 'mongoose';

export interface IPhoneVerification extends Document {
  user?: string;
  phone: string;
  code: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const phoneVerificationSchema = new Schema<IPhoneVerification>(
  {
    user: { type: String, index: true },
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

export const PhoneVerification = mongoose.model<IPhoneVerification>('PhoneVerification', phoneVerificationSchema);
