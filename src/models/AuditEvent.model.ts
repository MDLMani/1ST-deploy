import mongoose, { Document, Schema, Types } from 'mongoose';
import { AuditAction, DEFAULT_ORGANIZATION_ID } from '../constants';

export type AuditTargetType = 'invitation' | 'user';

export interface IAuditEvent extends Document {
  organizationId: string;
  actor?: Types.ObjectId;
  actorEmail: string;
  actorRole: string;
  targetType: AuditTargetType;
  targetId: Types.ObjectId;
  targetEmail: string;
  action: AuditAction;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const auditEventSchema = new Schema<IAuditEvent>(
  {
    organizationId: {
      type: String,
      required: true,
      default: DEFAULT_ORGANIZATION_ID,
      index: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, required: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    targetType: { type: String, enum: ['invitation', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    targetEmail: { type: String, required: true, trim: true },
    action: { type: String, enum: Object.values(AuditAction), required: true },
    previousStatus: { type: String, trim: true },
    newStatus: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditEventSchema.index({ organizationId: 1, createdAt: -1 });
auditEventSchema.index({ targetId: 1, createdAt: -1 });

export const AuditEvent = mongoose.model<IAuditEvent>('AuditEvent', auditEventSchema);
