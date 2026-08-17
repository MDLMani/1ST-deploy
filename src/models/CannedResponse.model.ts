import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICannedResponse extends Document {
  title: string;
  content: string;
  shortcut: string;
  category: string;
  department?: Types.ObjectId;
  isGlobal: boolean;
  createdBy: Types.ObjectId;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const cannedResponseSchema = new Schema<ICannedResponse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    content: { type: String, required: true, maxlength: 5000 },
    shortcut: { type: String, required: true, trim: true, maxlength: 50 },
    category: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    isGlobal: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cannedResponseSchema.index({ shortcut: 1 });
cannedResponseSchema.index({ createdBy: 1, isGlobal: 1 });
cannedResponseSchema.index({ category: 1 });

export const CannedResponse = mongoose.model<ICannedResponse>('CannedResponse', cannedResponseSchema);
