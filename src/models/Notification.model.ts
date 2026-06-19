import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
  user: Types.ObjectId;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema
);
