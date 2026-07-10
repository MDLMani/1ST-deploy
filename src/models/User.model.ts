import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../constants';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: Types.ObjectId;
  skills?: string[];
  isActive?: boolean;
  maxTicketLoad?: number;
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
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
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
