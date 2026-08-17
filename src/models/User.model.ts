import mongoose, { Document, Schema, Types } from 'mongoose';
import { AccessLevel, DEFAULT_ORGANIZATION_ID, UserRole } from '../constants';

export interface IIdentityDefaults {
  fullName?: string;
  fatherName?: string;
  idType?: string;
}

export interface INotificationPrefs {
  ticketUpdates: boolean;
  staffReplies: boolean;
  overdue: boolean;
  system: boolean;
}

export interface ISavedAddress {
  _id: Types.ObjectId;
  label: string;
  street?: string;
  villageTown?: string;
  taluk?: string;
  district?: string;
  isDefault?: boolean;
}

export interface IFamilyMember {
  _id: Types.ObjectId;
  name: string;
  relation: string;
  phone?: string;
  district?: string;
  notes?: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneVerified?: boolean;
  jobTitle?: string;
  company?: string;
  district?: string;
  taluk?: string;
  city?: string;
  ward?: string;
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
  resetOtpLastSentAt?: Date;
  phoneOtpHash?: string;
  phoneOtpExpires?: Date;
  phoneOtpAttempts?: number;
  identityDefaults?: IIdentityDefaults;
  notificationPrefs?: INotificationPrefs;
  preferredDepartmentId?: string;
  savedAddresses?: ISavedAddress[];
  familyMembers?: IFamilyMember[];
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const identityDefaultsSchema = new Schema<IIdentityDefaults>(
  {
    fullName: { type: String, trim: true, maxlength: 120 },
    fatherName: { type: String, trim: true, maxlength: 120 },
    idType: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false }
);

const notificationPrefsSchema = new Schema<INotificationPrefs>(
  {
    ticketUpdates: { type: Boolean, default: true },
    staffReplies: { type: Boolean, default: true },
    overdue: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
  },
  { _id: false }
);

const savedAddressSchema = new Schema<ISavedAddress>(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    street: { type: String, trim: true, maxlength: 200 },
    villageTown: { type: String, trim: true, maxlength: 120 },
    taluk: { type: String, trim: true, maxlength: 80 },
    district: { type: String, trim: true, maxlength: 80 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: false }
);

const familyMemberSchema = new Schema<IFamilyMember>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    relation: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 30 },
    district: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: false }
);

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
    phoneVerified: { type: Boolean, default: false },
    jobTitle: { type: String, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 80 },
    taluk: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 120 },
    ward: { type: String, trim: true, maxlength: 120 },
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
    resetOtpLastSentAt: {
      type: Date,
      select: false,
    },
    phoneOtpHash: {
      type: String,
      select: false,
    },
    phoneOtpExpires: {
      type: Date,
      select: false,
    },
    phoneOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    identityDefaults: {
      type: identityDefaultsSchema,
      default: () => ({}),
    },
    notificationPrefs: {
      type: notificationPrefsSchema,
      default: () => ({
        ticketUpdates: true,
        staffReplies: true,
        overdue: true,
        system: true,
      }),
    },
    preferredDepartmentId: { type: String, trim: true, maxlength: 64 },
    savedAddresses: { type: [savedAddressSchema], default: [] },
    familyMembers: { type: [familyMemberSchema], default: [] },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
