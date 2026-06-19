import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComment extends Document {
  ticket: Types.ObjectId;
  sender: Types.ObjectId;
  message: string;
  createdAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

commentSchema.index({ ticket: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
