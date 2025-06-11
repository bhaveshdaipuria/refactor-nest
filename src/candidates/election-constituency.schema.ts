import { Schema, Types } from 'mongoose';

export const ElectionConstituencySchema = new Schema({
  election: { type: Types.ObjectId, ref: 'Election', required: true },
  constituency: { type: Types.ObjectId, ref: 'Constituency', required: true },
  status: { type: String },
}); 