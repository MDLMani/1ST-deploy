import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  AccessLevel,
  ApprovalStatus,
  DEFAULT_ORGANIZATION_ID,
  InvitationStatus,
  UserRole,
} from '../constants';

export interface IInvitation extends Document {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  department?: Types.ObjectId;
  company?: string;
  district?: string;
  taluk?: string;
  city?: string;
  partyRole?: string;
  party?: string;
  departmentRole?: string;
  role: UserRole;
  accessLevel: AccessLevel;
  reportingManager?: Types.ObjectId;
  additionalInformation?: string;
  invitationStatus: InvitationStatus;
  approvalStatus: ApprovalStatus;
  tokenHash: string;
  expiresAt: Date;
  invitedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  invitedAt: Date;
  acceptedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  resolutionNote?: string;
  user?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    organizationId: {
      type: String,
      required: true,
      default: DEFAULT_ORGANIZATION_ID,
      index: true,
      trim: true,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    jobTitle: { type: String, trim: true, maxlength: 120 },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    company: { type: String, trim: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 80 },
    taluk: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 120 },
    partyRole: { type: String, trim: true, maxlength: 120 },
    party: { type: String, trim: true, maxlength: 120 },
    departmentRole: { type: String, trim: true, maxlength: 80 },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    accessLevel: {
      type: String,
      enum: Object.values(AccessLevel),
      default: AccessLevel.STANDARD,
    },
    reportingManager: { type: Schema.Types.ObjectId, ref: 'User' },
    additionalInformation: { type: String, trim: true, maxlength: 2000 },
    invitationStatus: {
      type: String,
      enum: Object.values(InvitationStatus),
      default: InvitationStatus.SENT,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: Object.values(ApprovalStatus),
      default: ApprovalStatus.PENDING,
      index: true,
    },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invitationSchema.index({ organizationId: 1, email: 1, invitationStatus: 1 });
invitationSchema.index({ organizationId: 1, approvalStatus: 1, invitedAt: -1 });
invitationSchema.index({ tokenHash: 1 }, { unique: true });

export const Invitation = mongoose.model<IInvitation>('Invitation', invitationSchema);
