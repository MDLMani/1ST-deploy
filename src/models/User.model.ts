import mongoose, { Document, Schema, Types } from 'mongoose';
import { AccessLevel, DEFAULT_ORGANIZATION_ID, UserRole } from '../constants';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  district?: string;
  taluk?: string;
  city?: string;
  partyRole?: string;
  party?: string;
  departmentRole?: string;
  accessLevel?: AccessLevel;
  reportingManager?: Types.ObjectId;
  additionalInformation?: string;
  department?: Types.ObjectId;
  skills?: string[];
  isActive?: boolean;
  maxTicketLoad?: number;
  invitation?: Types.ObjectId;
  resetOtpHash?: string;
  resetOtpExpires?: Date;
  resetOtpAttempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    organizationId: {
      type: String,
      default: DEFAULT_ORGANIZATION_ID,
      index: true,
      trim: true,
    },
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
    jobTitle: { type: String, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 80 },
    taluk: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 120 },
    partyRole: { type: String, trim: true, maxlength: 120 },
    party: { type: String, trim: true, maxlength: 120 },
    departmentRole: { type: String, trim: true, maxlength: 80 },
    accessLevel: {
      type: String,
      enum: Object.values(AccessLevel),
    },
    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    additionalInformation: { type: String, trim: true, maxlength: 2000 },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    invitation: {
      type: Schema.Types.ObjectId,
      ref: 'Invitation',
    },
    skills: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    maxTicketLoad: {
      type: Number,
      default: 20,
    },
    resetOtpHash: {
      type: String,
      select: false,
    },
    resetOtpExpires: {
      type: Date,
      select: false,
    },
    resetOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
