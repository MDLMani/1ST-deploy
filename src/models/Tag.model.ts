import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITag extends Document {
  name: string;
  color: string;
  createdBy: Types.ObjectId;
  usageCount: number;
  createdAt: Date;
}

const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
    color: { type: String, default: '#6B7280', maxlength: 7 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

tagSchema.index({ name: 1 }, { unique: true });
tagSchema.index({ usageCount: -1 });

export const Tag = mongoose.model<ITag>('Tag', tagSchema);
