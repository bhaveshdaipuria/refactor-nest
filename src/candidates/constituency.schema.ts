import { Schema } from 'mongoose';

export const ConstituencySchema = new Schema({
  name: { type: String, required: true },
  // Add other fields as needed
}); 