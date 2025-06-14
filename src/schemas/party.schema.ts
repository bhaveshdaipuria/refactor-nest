import mongoose from "mongoose";

export const partySchema = new mongoose.Schema({
  party: { type: String, required: true, unique: true },
  color_code: { type: String, default: "#000000", required: true },
  party_logo: { type: String },
});
