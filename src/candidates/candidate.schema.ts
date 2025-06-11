import { Schema, Types } from 'mongoose';

export const CandidateSchema = new Schema({
  name: { type: String, required: true },
  constituency: { type: Types.ObjectId, ref: 'Constituency', required: true },
  party: { type: Types.ObjectId, ref: 'Party', required: true },
  hotCandidate: { type: Boolean, default: false },
  image: { type: String },
}); 