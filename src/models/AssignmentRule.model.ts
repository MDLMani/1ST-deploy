import mongoose, { Document, Schema, Types } from 'mongoose';
import { AssignmentStrategy, TicketPriority } from '../constants';

export interface IAssignmentRule extends Document {
  name: string;
  department: Types.ObjectId;
  strategy: AssignmentStrategy;
  category?: string;
  skillRequired?: string;
  priority?: TicketPriority;
  isActive: boolean;
  weight: number;
  lastAssignedIndex: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentRuleSchema = new Schema<IAssignmentRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    strategy: { type: String, enum: Object.values(AssignmentStrategy), required: true },
    category: { type: String, trim: true },
    skillRequired: { type: String, trim: true },
    priority: { type: String, enum: Object.values(TicketPriority) },
    isActive: { type: Boolean, default: true },
    weight: { type: Number, default: 0 },
    lastAssignedIndex: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

assignmentRuleSchema.index({ department: 1, isActive: 1 });

export const AssignmentRule = mongoose.model<IAssignmentRule>('AssignmentRule', assignmentRuleSchema);
