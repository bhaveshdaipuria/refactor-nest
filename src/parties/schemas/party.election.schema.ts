import { Schema, Types } from 'mongoose';

export const ElectionPartyResultSchema = new Schema({
  election: { type: Types.ObjectId, ref: 'Election', required: true },
  party: { type: Types.ObjectId, ref: 'Party', required: true },
  seatsWon: { type: Number, default: 0 },
});
