import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuthSession extends Document {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  deviceName: string;
  userAgent?: string;
  ip?: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<IAuthSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    deviceName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Device',
    },
    userAgent: { type: String, trim: true, maxlength: 400 },
    ip: { type: String, trim: true, maxlength: 80 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

authSessionSchema.index({ userId: 1, createdAt: -1 });

export const AuthSession = mongoose.model<IAuthSession>('AuthSession', authSessionSchema);
