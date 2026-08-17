import mongoose, { Document, Schema, Types } from 'mongoose';
import { SatisfactionRating } from '../constants';

export interface ISatisfactionResponse extends Document {
  ticket: Types.ObjectId;
  user: Types.ObjectId;
  rating: SatisfactionRating;
  comment?: string;
  createdAt: Date;
}

const satisfactionSchema = new Schema<ISatisfactionResponse>(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Satisfaction = mongoose.model<ISatisfactionResponse>('Satisfaction', satisfactionSchema);
