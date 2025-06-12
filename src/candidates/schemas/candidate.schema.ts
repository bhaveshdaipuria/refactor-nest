import { Schema, Types } from 'mongoose';

export const CandidateSchema = new Schema({
  name: { type: String, required: true },
  hindiName: { type: String },
  age: { type: Number, default: null },
  gender: { type: String, default: null },
  party: { type: Types.ObjectId, ref: 'Party', required: true }, // Reference to Party model
  hotCandidate: { type: Boolean, default: false },
  image: { type: String },
  constituency: [{ type: Types.ObjectId, ref: 'Constituency' }], // Reference to Constituency model
});
