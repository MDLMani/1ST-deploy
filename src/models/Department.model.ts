import mongoose, { Document, Schema } from 'mongoose';
import { TicketPriority, AssignmentStrategy } from '../constants';

export interface IDepartment extends Document {
  name: string;
  slug: string;
  description?: string;
  defaultPriority: TicketPriority;
  assignmentStrategy: AssignmentStrategy;
  slaPolicy: {
    responseTimeHours: Record<TicketPriority, number>;
    resolutionTimeHours: Record<TicketPriority, number>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    defaultPriority: { type: String, enum: Object.values(TicketPriority), default: TicketPriority.MEDIUM },
    assignmentStrategy: { type: String, enum: Object.values(AssignmentStrategy), default: AssignmentStrategy.MANUAL },
    slaPolicy: {
      responseTimeHours: {
        type: Map,
        of: Number,
        default: { CRITICAL: 1, HIGH: 4, MEDIUM: 8, LOW: 24 },
      },
      resolutionTimeHours: {
        type: Map,
        of: Number,
        default: { CRITICAL: 12, HIGH: 24, MEDIUM: 48, LOW: 72 },
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ slug: 1 }, { unique: true });
departmentSchema.index({ isActive: 1 });

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
