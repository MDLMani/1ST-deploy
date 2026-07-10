import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IKnowledgeBase extends Document {
  title: string;
  slug: string;
  content: string;
  category: string;
  tags: string[];
  department?: Types.ObjectId;
  author: Types.ObjectId;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true }],
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    viewCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

knowledgeBaseSchema.index({ slug: 1 }, { unique: true });
knowledgeBaseSchema.index({ category: 1, isPublished: 1 });
knowledgeBaseSchema.index({ tags: 1 });
knowledgeBaseSchema.index({ title: 'text', content: 'text' });

export const KnowledgeBase = mongoose.model<IKnowledgeBase>('KnowledgeBase', knowledgeBaseSchema);
