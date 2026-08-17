import mongoose, { Document, Schema, Types } from 'mongoose';
import { TicketPriority, TicketStatus } from '../constants';
import { IAttachment } from '../interfaces';

export interface ITicket extends Document {
  ticketNumber: string;
  user: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  customCategory?: string;
  priority: TicketPriority;
  status: TicketStatus;
  attachments: IAttachment[];
  assignedTo?: Types.ObjectId;
  overdue: boolean;
  reminderCount: number;
  lastReminderAt?: Date;
  department?: Types.ObjectId;
  district?: string;
  taluk?: string;
  city?: string;
  tags: Types.ObjectId[];
  isInternal: boolean;
  mergedInto?: Types.ObjectId;
  relatedTickets: Types.ObjectId[];
  customFields: Map<string, any>;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  sla: {
    responseDeadline?: Date;
    resolutionDeadline?: Date;
    responseBreached: boolean;
    resolutionBreached: boolean;
  };
  escalationLevel: number;
  knowledgeBaseLinks: Types.ObjectId[];
  identity?: {
    fullName: string;
    fatherName: string;
    idType: string;
  };
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
    customCategory: {
      type: String,
      trim: true,
      maxlength: 120,
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
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    district: { type: String, trim: true, maxlength: 80 },
    taluk: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 120 },
    tags: [{
      type: Schema.Types.ObjectId,
      ref: 'Tag',
    }],
    isInternal: {
      type: Boolean,
      default: false,
    },
    mergedInto: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
    },
    relatedTickets: [{
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
    }],
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    firstResponseAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    sla: {
      responseDeadline: { type: Date },
      resolutionDeadline: { type: Date },
      responseBreached: { type: Boolean, default: false },
      resolutionBreached: { type: Boolean, default: false },
    },
    escalationLevel: {
      type: Number,
      default: 0,
    },
    knowledgeBaseLinks: [{
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeBase',
    }],
    identity: {
      fullName: { type: String, trim: true, maxlength: 120 },
      fatherName: { type: String, trim: true, maxlength: 120 },
      idType: { type: String, trim: true, maxlength: 40 },
    },
  },
  {
    timestamps: true,
  }
);

ticketSchema.index({ user: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ overdue: 1 });
ticketSchema.index({ department: 1, status: 1 });
ticketSchema.index({ district: 1, taluk: 1, city: 1 });
ticketSchema.index({ tags: 1 });
ticketSchema.index({ 'sla.responseDeadline': 1, 'sla.responseBreached': 1 });
ticketSchema.index({ 'sla.resolutionDeadline': 1, 'sla.resolutionBreached': 1 });
ticketSchema.index({ mergedInto: 1 });
ticketSchema.index({ escalationLevel: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
