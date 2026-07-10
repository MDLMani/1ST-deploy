import mongoose, { Document, Schema, Types } from 'mongoose';

export type CustomFieldType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'boolean';

export interface ICustomField extends Document {
  name: string;
  key: string;
  type: CustomFieldType;
  options?: string[];
  department?: Types.ObjectId;
  isRequired: boolean;
  defaultValue?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

const customFieldSchema = new Schema<ICustomField>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    key: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, enum: ['text', 'number', 'select', 'multi_select', 'date', 'boolean'] },
    options: [{ type: String, trim: true }],
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    isRequired: { type: Boolean, default: false },
    defaultValue: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

customFieldSchema.index({ key: 1 }, { unique: true });
customFieldSchema.index({ department: 1, isActive: 1 });

export const CustomField = mongoose.model<ICustomField>('CustomField', customFieldSchema);
