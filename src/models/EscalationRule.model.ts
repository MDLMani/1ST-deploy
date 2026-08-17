import mongoose, { Document, Schema, Types } from 'mongoose';
import { TicketPriority, TicketStatus, EscalationTrigger, UserRole } from '../constants';

export interface IEscalationRule extends Document {
  name: string;
  trigger: EscalationTrigger;
  conditions: {
    department?: Types.ObjectId;
    priority?: TicketPriority[];
    status?: TicketStatus[];
    timeElapsedMinutes?: number;
    slaMetric?: 'response' | 'resolution';
  };
  actions: {
    assignTo?: Types.ObjectId;
    changePriority?: TicketPriority;
    addTag?: string;
    notifyUsers?: Types.ObjectId[];
    notifyRoles?: UserRole[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const escalationRuleSchema = new Schema<IEscalationRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    trigger: { type: String, required: true, enum: Object.values(EscalationTrigger) },
    conditions: {
      department: { type: Schema.Types.ObjectId, ref: 'Department' },
      priority: [{ type: String, enum: Object.values(TicketPriority) }],
      status: [{ type: String, enum: Object.values(TicketStatus) }],
      timeElapsedMinutes: { type: Number },
      slaMetric: { type: String, enum: ['response', 'resolution'] },
    },
    actions: {
      assignTo: { type: Schema.Types.ObjectId, ref: 'User' },
      changePriority: { type: String, enum: Object.values(TicketPriority) },
      addTag: { type: String, trim: true },
      notifyUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      notifyRoles: [{ type: String, enum: Object.values(UserRole) }],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

escalationRuleSchema.index({ isActive: 1, trigger: 1 });

export const EscalationRule = mongoose.model<IEscalationRule>('EscalationRule', escalationRuleSchema);
