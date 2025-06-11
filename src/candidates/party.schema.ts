import { Schema } from 'mongoose';

export const PartySchema = new Schema({
  name: { type: String, required: true },
  // Add other fields as needed
}); 