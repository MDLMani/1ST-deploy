import mongoose, { Document, Schema, Types } from 'mongoose';
import { TicketPriority, TicketStatus } from '../constants';
import { IAttachment } from '../interfaces';

export interface ITicket extends Document {
  ticketNumber: string;
  user: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  attachments: IAttachment[];
  assignedTo?: Types.ObjectId;
  overdue: boolean;
  reminderCount: number;
  lastReminderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
  },
  { _id: false }
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    overdue: {
      type: Boolean,
      default: false,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    lastReminderAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ticketSchema.index({ user: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ overdue: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
