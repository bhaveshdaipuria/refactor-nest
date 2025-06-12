import { Schema, Types } from 'mongoose';

export const ConstituencySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    state: { type: String, required: true },
    constituencyId: { type: Number, required: true },
    candidates: [{ type: Types.ObjectId, ref: 'Candidate' }],
  },
  { strictPopulate: false, timestamps: true },
);
