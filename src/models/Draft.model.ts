import mongoose, { Document, Schema } from 'mongoose';

export interface IDraft extends Document {
  user: string;
  content: string;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const draftSchema = new Schema<IDraft>(
  {
    user: { type: String, required: true, index: true },
    content: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Draft = mongoose.model<IDraft>('Draft', draftSchema);
