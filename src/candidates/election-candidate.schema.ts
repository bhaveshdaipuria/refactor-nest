import { Schema, Types } from 'mongoose';

export const ElectionCandidateSchema = new Schema({
  election: { type: Types.ObjectId, ref: 'Election', required: true },
  candidate: { type: Types.ObjectId, ref: 'Candidate', required: true },
  votesReceived: { type: Number, default: 0 },
}); 