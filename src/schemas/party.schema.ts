import { Schema } from 'mongoose';

export const PartySchema = new Schema(
  {
    party: { type: String, required: true, unique: true },
    color_code: { type: String, default: '#000000', required: true },
    party_logo: { type: String },
  },
  { strictPopulate: false, timestamps: true },
);
