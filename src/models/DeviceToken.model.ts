import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceToken extends Document {
  user: string;
  token: string;
  platform: 'android' | 'ios' | 'web' | string;
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    user: { type: String, required: true, index: true },
    token: { type: String, required: true, index: true },
    platform: { type: String, default: 'android' },
  },
  { timestamps: true }
);

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);
